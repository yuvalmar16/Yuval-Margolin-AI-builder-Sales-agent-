import { NextResponse } from "next/server";

import { getGoogleOAuthConfig } from "@/lib/calendar/google-calendar-adapter";

export async function GET() {
  const config = getGoogleOAuthConfig();

  if (!config) {
    return NextResponse.json(
      {
        error:
          "Google Calendar isn't configured. Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI in .env.local.",
      },
      { status: 400 },
    );
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events email");

  return NextResponse.redirect(authUrl.toString());
}
