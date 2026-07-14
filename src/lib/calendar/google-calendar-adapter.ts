import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabaseClient } from "@/lib/supabase/client";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONNECTION_FILE = path.join(DATA_DIR, "calendar-connection.json");

type CalendarConnection = {
  workspaceId: string;
  refreshToken: string;
  googleAccountEmail: string | null;
};

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

async function readLocalConnection(): Promise<CalendarConnection | null> {
  try {
    const raw = await fs.readFile(CONNECTION_FILE, "utf8");
    return JSON.parse(raw) as CalendarConnection;
  } catch {
    return null;
  }
}

async function writeLocalConnection(connection: CalendarConnection): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONNECTION_FILE, JSON.stringify(connection, null, 2), "utf8");
}

export async function saveCalendarConnection(input: {
  workspaceId: string;
  refreshToken: string;
  googleAccountEmail: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  if (supabase) {
    const { error } = await supabase.from("calendar_connections").upsert({
      workspace_id: input.workspaceId,
      provider: "google",
      refresh_token: input.refreshToken,
      google_account_email: input.googleAccountEmail,
      updated_at: now,
    });

    if (!error) {
      return;
    }

    console.error("[google-calendar] Supabase upsert failed", error.message, error.details, error.hint);
  }

  await writeLocalConnection(input);
}

export async function getCalendarConnection(workspaceId: string): Promise<CalendarConnection | null> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("calendar_connections")
      .select("workspace_id, refresh_token, google_account_email")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) {
      console.error("[google-calendar] Supabase select failed", error.message, error.details, error.hint);
    } else if (data) {
      return {
        workspaceId: data.workspace_id,
        refreshToken: data.refresh_token,
        googleAccountEmail: data.google_account_email,
      };
    }
  }

  return readLocalConnection();
}

export async function isCalendarConnected(workspaceId: string): Promise<boolean> {
  const connection = await getCalendarConnection(workspaceId);
  return connection !== null;
}

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const config = getGoogleOAuthConfig();

  if (!config) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("[google-calendar] token refresh failed", await response.text());
    return null;
  }

  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

export type CreatedCalendarEvent = {
  eventId: string;
  htmlLink: string;
};

export async function createRealCalendarEvent(input: {
  workspaceId: string;
  summary: string;
  description: string;
  startTime: string;
  attendeeEmail: string;
}): Promise<CreatedCalendarEvent | null> {
  const connection = await getCalendarConnection(input.workspaceId);

  if (!connection) {
    return null;
  }

  const accessToken = await getAccessToken(connection.refreshToken);

  if (!accessToken) {
    return null;
  }

  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: input.attendeeEmail }],
      }),
    },
  );

  if (!response.ok) {
    console.error("[google-calendar] event creation failed", await response.text());
    return null;
  }

  const event = (await response.json()) as { id: string; htmlLink: string };

  return { eventId: event.id, htmlLink: event.htmlLink };
}
