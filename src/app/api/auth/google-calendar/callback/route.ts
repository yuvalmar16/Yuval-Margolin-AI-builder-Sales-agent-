import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { getGoogleOAuthConfig, saveCalendarConnection } from "@/lib/calendar/google-calendar-adapter";

const WORKSPACE_ID = "personal-workspace";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const builderUrl = new URL("/builder", url.origin);

  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    builderUrl.searchParams.set("calendar", "error");
    return NextResponse.redirect(builderUrl.toString());
  }

  const code = url.searchParams.get("code");
  const config = getGoogleOAuthConfig();

  if (!code || !config) {
    builderUrl.searchParams.set("calendar", "error");
    return NextResponse.redirect(builderUrl.toString());
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("[google-calendar] token exchange failed", await tokenResponse.text());
      builderUrl.searchParams.set("calendar", "error");
      return NextResponse.redirect(builderUrl.toString());
    }

    const tokenPayload = (await tokenResponse.json()) as {
      refresh_token?: string;
      access_token?: string;
    };

    if (!tokenPayload.refresh_token) {
      console.error(
        "[google-calendar] no refresh_token in response -- the account may have already granted consent without 'prompt=consent', or offline access wasn't returned",
      );
      builderUrl.searchParams.set("calendar", "error");
      return NextResponse.redirect(builderUrl.toString());
    }

    let googleAccountEmail: string | null = null;

    if (tokenPayload.access_token) {
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as { email?: string };
        googleAccountEmail = userInfo.email ?? null;
      }
    }

    await saveCalendarConnection({
      workspaceId: WORKSPACE_ID,
      refreshToken: tokenPayload.refresh_token,
      googleAccountEmail,
    });

    await recordAuditEvent({
      workspaceId: WORKSPACE_ID,
      entityType: "calendar_connection",
      entityId: googleAccountEmail ?? "unknown",
      action: "calendar_connected",
      result: "success",
      riskLevel: "n/a",
      requestId: randomUUID(),
    });

    builderUrl.searchParams.set("calendar", "connected");
    return NextResponse.redirect(builderUrl.toString());
  } catch (error) {
    console.error("google-calendar callback error", error);
    builderUrl.searchParams.set("calendar", "error");
    return NextResponse.redirect(builderUrl.toString());
  }
}
