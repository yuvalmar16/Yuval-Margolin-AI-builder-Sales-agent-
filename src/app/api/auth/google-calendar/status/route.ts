import { NextResponse } from "next/server";

import { getCalendarConnection, getGoogleOAuthConfig } from "@/lib/calendar/google-calendar-adapter";

const WORKSPACE_ID = "personal-workspace";

export async function GET() {
  const configured = getGoogleOAuthConfig() !== null;
  const connection = configured ? await getCalendarConnection(WORKSPACE_ID) : null;

  return NextResponse.json({
    configured,
    connected: connection !== null,
    googleAccountEmail: connection?.googleAccountEmail ?? null,
  });
}
