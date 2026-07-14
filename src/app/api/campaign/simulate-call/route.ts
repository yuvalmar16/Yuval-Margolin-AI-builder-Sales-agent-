import { NextResponse } from "next/server";

import { simulateLeadCall } from "@/lib/crm/demo-campaign";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phoneNumber = typeof body?.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
    const leadSource = typeof body?.leadSource === "string" ? body.leadSource.trim() : "Demo campaign";

    if (!name || !phoneNumber || !email) {
      return NextResponse.json(
        { error: "A lead name, phone number, and email are required." },
        { status: 400 },
      );
    }

    const result = await simulateLeadCall({ name, phoneNumber, email, companyName, leadSource });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("simulate-call route error", error);

    return NextResponse.json(
      { error: "Unable to simulate the campaign call right now." },
      { status: 500 },
    );
  }
}
