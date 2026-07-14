import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabaseClient } from "@/lib/supabase/client";

export type AuditAction =
  | "prompt_request"
  | "prompt_blocked"
  | "draft_generated"
  | "version_saved"
  | "version_approved"
  | "lead_call_simulated"
  | "voice_call_completed"
  | "calendar_connected"
  | "calendar_event_created";

export type AuditResult = "success" | "blocked" | "failure";

export type AuditEventInput = {
  workspaceId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  result: AuditResult;
  riskLevel: string;
  requestId: string;
};

const AUDIT_DIR = path.join(process.cwd(), ".data");
const AUDIT_FILE = path.join(AUDIT_DIR, "audit-log.jsonl");

async function appendLocalAuditEvent(event: Record<string, unknown>): Promise<void> {
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const event = {
      id: randomUUID(),
      workspace_id: input.workspaceId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      result: input.result,
      risk_level: input.riskLevel,
      request_id: input.requestId,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();

    if (supabase) {
      const { error } = await supabase.from("audit_logs").insert(event);

      if (!error) {
        return;
      }

      console.error("[audit-log] Supabase insert failed", error.message, error.details, error.hint);
    }

    await appendLocalAuditEvent(event);
  } catch (error) {
    console.error("[audit-log] failed to record audit event", error);
  }
}
