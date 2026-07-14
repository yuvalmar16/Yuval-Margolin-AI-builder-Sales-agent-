"use client";

import { useState } from "react";

type SimulatedCallResult = {
  lead: {
    id: string;
    name: string;
    phoneNumber: string;
    email: string;
    companyName: string;
    leadSource: string;
  };
  qualification: {
    state: "qualified" | "not_qualified";
    reason: string;
  };
  bookedMeeting: {
    time: string;
    meetingReference: string;
    calendarEventUrl?: string;
  } | null;
  crmSync: {
    provider: "hubspot-mock";
    status: "success";
    contactId: string;
    dealId: string | null;
    syncedAt: string;
  };
};

type CrmDemoPanelProps = {
  savedStatus: "draft" | "approved" | null;
};

const initialLeadForm = {
  name: "",
  phoneNumber: "",
  email: "",
  companyName: "",
};

export function CrmDemoPanel({ savedStatus }: CrmDemoPanelProps) {
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulatedCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSimulate = savedStatus === "approved";

  const onSimulate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSimulate || isSimulating) return;

    setIsSimulating(true);
    setError(null);

    try {
      const response = await fetch("/api/campaign/simulate-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...leadForm, leadSource: "Demo campaign" }),
      });

      const payload = (await response.json()) as {
        result?: SimulatedCallResult;
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Unable to simulate the campaign call.");
      }

      setResult(payload.result);
    } catch (caughtError) {
      const fallbackMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to simulate the campaign call right now.";

      setError(fallbackMessage);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
        <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Demo campaign — mock CRM sync</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">
            HubSpot (mocked)
          </span>
        </div>

        {!canSimulate ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Approve an assistant draft above before running a demo campaign.
          </div>
        ) : (
          <form onSubmit={onSimulate} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={leadForm.name}
              onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })}
              placeholder="Lead name"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />
            <input
              required
              value={leadForm.phoneNumber}
              onChange={(event) => setLeadForm({ ...leadForm, phoneNumber: event.target.value })}
              placeholder="Phone number"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />
            <input
              required
              type="email"
              value={leadForm.email}
              onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })}
              placeholder="Email"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />
            <input
              value={leadForm.companyName}
              onChange={(event) => setLeadForm({ ...leadForm, companyName: event.target.value })}
              placeholder="Company name (leave blank to see a failed qualification)"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />

            <button
              type="submit"
              disabled={isSimulating}
              className="sm:col-span-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.01] hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSimulating ? "Simulating call..." : "Simulate a lead call"}
            </button>
          </form>
        )}

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div
              className={`rounded-2xl p-3 ${
                result.qualification.state === "qualified" ? "bg-emerald-50" : "bg-rose-50"
              }`}
            >
              <div
                className={`text-xs uppercase tracking-[0.2em] ${
                  result.qualification.state === "qualified" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                Qualification
              </div>
              <div className="mt-2 text-sm text-zinc-950">
                {result.qualification.state === "qualified" ? "Qualified" : "Not qualified"}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{result.qualification.reason}</p>
            </div>

            <div className="rounded-2xl bg-violet-50 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-violet-600">Booked meeting</div>
              <div className="mt-2 text-sm text-zinc-950">
                {result.bookedMeeting
                  ? new Date(result.bookedMeeting.time).toLocaleString()
                  : "No meeting booked"}
              </div>
              {result.bookedMeeting?.calendarEventUrl ? (
                <a
                  href={result.bookedMeeting.calendarEventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-violet-600 underline"
                >
                  View real event in Google Calendar
                </a>
              ) : result.bookedMeeting ? (
                <p className="mt-1 text-xs text-zinc-500">{result.bookedMeeting.meetingReference} (mock — calendar not connected)</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Mock CRM update</div>
              <div className="mt-2 text-sm text-zinc-950">Synced to {result.crmSync.contactId}</div>
              {result.crmSync.dealId ? (
                <p className="mt-1 text-xs text-zinc-500">Deal: {result.crmSync.dealId}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
