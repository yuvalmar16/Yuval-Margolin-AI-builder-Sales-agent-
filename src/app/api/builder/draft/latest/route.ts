import { NextResponse } from "next/server";

import { loadLatestWorkspaceDraft } from "@/lib/builder/assistant-workspace";

export async function GET() {
  try {
    const saved = await loadLatestWorkspaceDraft();

    if (!saved) {
      return NextResponse.json({ saved: null });
    }

    return NextResponse.json({ saved });
  } catch {
    return NextResponse.json(
      { error: "Unable to load the latest draft right now." },
      { status: 500 },
    );
  }
}
