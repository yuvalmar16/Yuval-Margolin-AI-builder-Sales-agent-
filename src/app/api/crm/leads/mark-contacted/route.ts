import { NextResponse } from "next/server";

import { markDemoLeadContacted } from "@/lib/crm/demo-leads";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "A lead id is required." }, { status: 400 });
    }

    await markDemoLeadContacted(id, "personal-workspace");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("crm leads mark-contacted route error", error);

    return NextResponse.json(
      { error: "Unable to update the lead status right now." },
      { status: 500 },
    );
  }
}
