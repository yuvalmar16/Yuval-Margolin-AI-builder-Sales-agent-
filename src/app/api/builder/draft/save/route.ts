import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { normalizeAssistantDraft } from "@/lib/builder/assistant-draft";
import { saveWorkspaceDraft } from "@/lib/builder/assistant-workspace";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const draft = normalizeAssistantDraft(body?.draft ?? body);

    if (!draft) {
      return NextResponse.json(
        { error: "A valid assistant draft is required to save." },
        { status: 400 },
      );
    }

    const saved = await saveWorkspaceDraft(draft);

    if (!saved) {
      await recordAuditEvent({
        workspaceId: "personal-workspace",
        entityType: "assistant_version",
        entityId: "unknown",
        action: "version_saved",
        result: "failure",
        riskLevel: "n/a",
        requestId: randomUUID(),
      });

      return NextResponse.json(
        { error: "Unable to save the assistant draft." },
        { status: 500 },
      );
    }

    await recordAuditEvent({
      workspaceId: saved.workspaceId,
      entityType: "assistant_version",
      entityId: saved.id,
      action: "version_saved",
      result: "success",
      riskLevel: "n/a",
      requestId: randomUUID(),
    });

    return NextResponse.json({ saved });
  } catch {
    return NextResponse.json(
      { error: "Unable to save the assistant draft right now." },
      { status: 500 },
    );
  }
}
