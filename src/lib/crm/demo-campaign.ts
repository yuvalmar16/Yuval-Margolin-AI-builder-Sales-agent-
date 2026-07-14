import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { recordAuditEvent, type AuditAction } from "@/lib/audit/audit-log";
import { loadLatestWorkspaceDraft } from "@/lib/builder/assistant-workspace";
import { createRealCalendarEvent } from "@/lib/calendar/google-calendar-adapter";
import { getSupabaseClient } from "@/lib/supabase/client";
import { syncMockHubSpotContact, type MockCrmSyncResult } from "@/lib/crm/hubspot-mock-adapter";

export type LeadInput = {
  name: string;
  phoneNumber: string;
  email: string;
  companyName: string;
  leadSource: string;
};

export type QualificationOutcome = {
  state: "qualified" | "not_qualified";
  reason: string;
};

export type BookedMeeting = {
  time: string;
  meetingReference: string;
  calendarEventUrl?: string;
};

export type SimulatedCallResult = {
  lead: LeadInput & { id: string };
  qualification: QualificationOutcome;
  bookedMeeting: BookedMeeting | null;
  crmSync: MockCrmSyncResult;
};

const DATA_DIR = path.join(process.cwd(), ".data");

async function persistRow(table: string, localFile: string, row: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { error } = await supabase.from(table).insert(row);

    if (!error) {
      return;
    }

    console.error(`[demo-campaign] Supabase insert into ${table} failed`, error.message, error.details, error.hint);
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(path.join(DATA_DIR, localFile), `${JSON.stringify(row)}\n`, "utf8");
  } catch (fileError) {
    console.error(`[demo-campaign] local append to ${localFile} failed`, fileError);
  }
}

function qualifyLead(lead: LeadInput): QualificationOutcome {
  if (!lead.companyName.trim()) {
    return {
      state: "not_qualified",
      reason: "No company name provided, so the first qualification question was not answered.",
    };
  }

  return {
    state: "qualified",
    reason: `Company confirmed (${lead.companyName}); qualification questions passed.`,
  };
}

function nextWeekdaySlot(from: Date): Date {
  const slot = new Date(from);
  slot.setDate(slot.getDate() + 1);
  slot.setHours(10, 0, 0, 0);

  while (slot.getDay() === 0 || slot.getDay() === 6) {
    slot.setDate(slot.getDate() + 1);
  }

  return slot;
}

export async function requireApprovedWorkspace(): Promise<{ workspaceId: string } | { error: string }> {
  const latestDraft = await loadLatestWorkspaceDraft();

  if (!latestDraft || latestDraft.status !== "approved") {
    return { error: "Approve an assistant version before running a demo campaign." };
  }

  return { workspaceId: latestDraft.workspaceId };
}

export async function finalizeLeadOutcome(input: {
  workspaceId: string;
  lead: LeadInput;
  qualification: QualificationOutcome;
  bookedMeeting: BookedMeeting | null;
  transcriptRef: string | null;
  auditAction: AuditAction;
}): Promise<SimulatedCallResult> {
  const { workspaceId, lead, qualification, transcriptRef, auditAction } = input;
  const qualified = qualification.state === "qualified";
  const leadId = randomUUID();
  const now = new Date().toISOString();

  await persistRow("leads", "leads.jsonl", {
    id: leadId,
    workspace_id: workspaceId,
    phone_number: lead.phoneNumber,
    email: lead.email,
    company_name: lead.companyName || null,
    lead_source: lead.leadSource,
    qualification_state: qualification.state,
    created_at: now,
  });

  let bookedMeeting = input.bookedMeeting;

  if (bookedMeeting) {
    const calendarEvent = await createRealCalendarEvent({
      workspaceId,
      summary: `Sales call meeting with ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ""}`,
      description: `Booked automatically after a qualification call. Reason: ${qualification.reason}`,
      startTime: bookedMeeting.time,
      attendeeEmail: lead.email,
    });

    if (calendarEvent) {
      bookedMeeting = { ...bookedMeeting, calendarEventUrl: calendarEvent.htmlLink };

      await recordAuditEvent({
        workspaceId,
        entityType: "calendar_event",
        entityId: calendarEvent.eventId,
        action: "calendar_event_created",
        result: "success",
        riskLevel: "n/a",
        requestId: randomUUID(),
      });
    }
  }

  const crmSync = syncMockHubSpotContact(qualified);

  await persistRow("call_results", "call-results.jsonl", {
    id: randomUUID(),
    workspace_id: workspaceId,
    campaign_id: "demo-sandbox",
    lead_id: leadId,
    call_status: "completed",
    qualification_result: qualification.state,
    booked_meeting: bookedMeeting,
    transcript_ref: transcriptRef,
    created_at: now,
  });

  await persistRow("crm_sync_events", "crm-sync-events.jsonl", {
    id: randomUUID(),
    workspace_id: workspaceId,
    lead_id: leadId,
    event_type: qualified ? "meeting_booked" : "qualification_failed",
    status: crmSync.status,
    payload_json: crmSync,
    created_at: now,
  });

  await recordAuditEvent({
    workspaceId,
    entityType: "lead",
    entityId: leadId,
    action: auditAction,
    result: "success",
    riskLevel: "n/a",
    requestId: randomUUID(),
  });

  return {
    lead: { ...lead, id: leadId },
    qualification,
    bookedMeeting,
    crmSync,
  };
}

export async function simulateLeadCall(
  input: LeadInput,
): Promise<SimulatedCallResult | { error: string }> {
  const workspace = await requireApprovedWorkspace();

  if ("error" in workspace) {
    return workspace;
  }

  const qualification = qualifyLead(input);
  const bookedMeeting: BookedMeeting | null =
    qualification.state === "qualified"
      ? {
          time: nextWeekdaySlot(new Date()).toISOString(),
          meetingReference: `mock-meeting-${randomUUID()}`,
        }
      : null;

  return finalizeLeadOutcome({
    workspaceId: workspace.workspaceId,
    lead: input,
    qualification,
    bookedMeeting,
    transcriptRef: null,
    auditAction: "lead_call_simulated",
  });
}
