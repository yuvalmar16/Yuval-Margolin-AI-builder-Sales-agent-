"use client";

import { useEffect, useState } from "react";

type Status = {
  configured: boolean;
  connected: boolean;
  googleAccountEmail: string | null;
};

export function GoogleCalendarConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [callbackNotice, setCallbackNotice] = useState<"connected" | "error" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarParam = params.get("calendar");

    if (calendarParam === "connected" || calendarParam === "error") {
      setCallbackNotice(calendarParam);
      params.delete("calendar");
      const nextUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState(null, "", nextUrl);
    }

    async function loadStatus() {
      try {
        const response = await fetch("/api/auth/google-calendar/status");
        const payload = (await response.json()) as Status;
        setStatus(payload);
      } catch {
        setStatus({ configured: false, connected: false, googleAccountEmail: null });
      }
    }

    void loadStatus();
  }, []);

  if (!status) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm text-zinc-600">Google Calendar</span>

      {!status.configured ? (
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500">
          Not configured — meetings stay mock-only
        </span>
      ) : status.connected ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
          Connected{status.googleAccountEmail ? ` as ${status.googleAccountEmail}` : ""} — meetings create real events
        </span>
      ) : (
        <a
          href="/api/auth/google-calendar/connect"
          className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
        >
          Connect Google Calendar
        </a>
      )}

      {callbackNotice === "connected" ? (
        <span className="text-xs text-emerald-600">Calendar connected successfully.</span>
      ) : null}
      {callbackNotice === "error" ? (
        <span className="text-xs text-rose-600">Couldn&apos;t connect Google Calendar. Check the server log.</span>
      ) : null}
    </div>
  );
}
