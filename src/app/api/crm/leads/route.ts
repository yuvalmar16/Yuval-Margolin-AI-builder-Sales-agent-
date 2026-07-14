import { NextResponse } from "next/server";

import { listDemoLeads } from "@/lib/crm/demo-leads";

export async function GET() {
  try {
    const leads = await listDemoLeads("personal-workspace");
    return NextResponse.json({ leads });
  } catch (error) {
    console.error("crm leads route error", error);

    return NextResponse.json(
      { error: "Unable to load demo leads right now." },
      { status: 500 },
    );
  }
}
