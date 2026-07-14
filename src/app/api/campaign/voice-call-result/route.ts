import { NextResponse } from "next/server";

import { finalizeLeadOutcome, requireApprovedWorkspace, type LeadInput } from "@/lib/crm/demo-campaign";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phoneNumber = typeof body?.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
    const leadSource = typeof body?.leadSource === "string" ? body.leadSource.trim() : "Voice call demo";
    const qualified = body?.qualified === true;
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "No reason captured from the call.";
    const meetingTime = typeof body?.meetingTime === "string" ? body.meetingTime.trim() : "";
    const transcriptRef = typeof body?.transcriptSummary === "string" ? body.transcriptSummary.slice(0, 4000) : null;

    if (!name || !phoneNumber || !email) {
      return NextResponse.json(
        { error: "A lead name, phone number, and email are required." },
        { status: 400 },
      );
    }

    const workspace = await requireApprovedWorkspace();

    if ("error" in workspace) {
      return NextResponse.json({ error: workspace.error }, { status: 400 });
    }

    const lead: LeadInput = { name, phoneNumber, email, companyName, leadSource };

    // Never trust the model's proposed date fully -- it can hallucinate a
    // date unmoored from "now" despite the system prompt telling it today's
    // date. Reject anything unparseable or already in the past rather than
    // booking a meeting that already happened.
    const parsedMeetingTime = meetingTime ? new Date(meetingTime) : null;
    const meetingTimeIsValid =
      parsedMeetingTime !== null && !Number.isNaN(parsedMeetingTime.getTime()) && parsedMeetingTime.getTime() > Date.now();

    if (meetingTime && !meetingTimeIsValid) {
      console.warn("[voice-call-result] rejected an invalid or past meeting time from the model", meetingTime);
    }

    const result = await finalizeLeadOutcome({
      workspaceId: workspace.workspaceId,
      lead,
      qualification: { state: qualified ? "qualified" : "not_qualified", reason },
      bookedMeeting:
        qualified && meetingTimeIsValid
          ? { time: parsedMeetingTime.toISOString(), meetingReference: `voice-call-meeting-${Date.now()}` }
          : null,
      transcriptRef,
      auditAction: "voice_call_completed",
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("voice-call-result route error", error);

    return NextResponse.json(
      { error: "Unable to record the voice call result right now." },
      { status: 500 },
    );
  }
}
