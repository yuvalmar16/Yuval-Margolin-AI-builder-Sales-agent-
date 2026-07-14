import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { approveLatestDraft } from "@/lib/builder/assistant-workspace";

export async function POST() {
  try {
    const saved = await approveLatestDraft();

    if (!saved) {
      await recordAuditEvent({
        workspaceId: "personal-workspace",
        entityType: "assistant_version",
        entityId: "unknown",
        action: "version_approved",
        result: "failure",
        riskLevel: "n/a",
        requestId: randomUUID(),
      });

      return NextResponse.json(
        { error: "No saved draft is available to approve." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      workspaceId: saved.workspaceId,
      entityType: "assistant_version",
      entityId: saved.id,
      action: "version_approved",
      result: "success",
      riskLevel: "n/a",
      requestId: randomUUID(),
    });

    return NextResponse.json({ saved });
  } catch {
    return NextResponse.json(
      { error: "Unable to approve the assistant draft right now." },
      { status: 500 },
    );
  }
}
