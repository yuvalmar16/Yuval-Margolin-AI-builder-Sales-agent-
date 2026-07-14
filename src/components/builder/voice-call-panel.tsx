"use client";

import { useEffect, useRef, useState } from "react";

import type { AssistantDraft } from "@/lib/builder/assistant-draft";
import type { DemoLead } from "@/lib/crm/demo-leads";
import { buildVapiAssistantConfig, BOOK_MEETING_TOOL_NAME } from "@/lib/voice/vapi-assistant-config";

type TranscriptEntry = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type CallOutcome = {
  qualified: boolean;
  reason: string;
  bookedMeetingTime: string | null;
  calendarEventUrl: string | null;
  crmContactId: string;
  crmDealId: string | null;
};

type VoiceCallPanelProps = {
  draft: AssistantDraft;
  canStartCall: boolean;
  prefillLead?: DemoLead | null;
  onCallCompleted?: () => void;
};

const initialLeadForm = {
  name: "",
  phoneNumber: "",
  email: "",
  companyName: "",
};

type CallState = "idle" | "connecting" | "in-call" | "ended";

export function VoiceCallPanel({ draft, canStartCall, prefillLead, onCallCompleted }: VoiceCallPanelProps) {
  const [leadForm, setLeadForm] = useState(initialLeadForm);

  useEffect(() => {
    if (!prefillLead) return;

    setLeadForm({
      name: prefillLead.name,
      phoneNumber: prefillLead.phoneNumber,
      email: prefillLead.email,
      companyName: prefillLead.companyName,
    });
    // Re-run only when a *different* demo lead is picked, not on every
    // render -- prefillLead is a fresh object each fetch, so compare by id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillLead?.id]);
  const [callState, setCallState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vapiRef = useRef<import("@vapi-ai/web").default | null>(null);
  const capturedToolArgsRef = useRef<{ qualified: boolean; reason: string; meetingTime?: string } | null>(
    null,
  );
  const callEndedCleanlyRef = useRef(false);

  const canSubmitForm = canStartCall && callState === "idle";

  async function reportOutcome(toolArgs: { qualified: boolean; reason: string; meetingTime?: string }) {
    try {
      const response = await fetch("/api/campaign/voice-call-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...leadForm,
          leadSource: "Voice call demo",
          qualified: toolArgs.qualified,
          reason: toolArgs.reason,
          meetingTime: toolArgs.meetingTime ?? "",
          transcriptSummary: transcript.map((entry) => `${entry.role}: ${entry.text}`).join("\n"),
        }),
      });

      const payload = (await response.json()) as {
        result?: {
          qualification: { state: string; reason: string };
          bookedMeeting: { time: string; calendarEventUrl?: string } | null;
          crmSync: { contactId: string; dealId: string | null };
        };
        error?: string;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Unable to record the voice call result.");
      }

      setOutcome({
        qualified: payload.result.qualification.state === "qualified",
        reason: payload.result.qualification.reason,
        bookedMeetingTime: payload.result.bookedMeeting?.time ?? null,
        calendarEventUrl: payload.result.bookedMeeting?.calendarEventUrl ?? null,
        crmContactId: payload.result.crmSync.contactId,
        crmDealId: payload.result.crmSync.dealId,
      });

      if (prefillLead) {
        try {
          await fetch("/api/crm/leads/mark-contacted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: prefillLead.id }),
          });
        } catch (markError) {
          console.error("[voice-call-panel] failed to mark demo lead contacted", markError);
        }

        onCallCompleted?.();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to record the voice call result.");
    }
  }

  const onStartCall = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitForm) return;

    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

    if (!publicKey) {
      setError("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set. Add it to .env.local and restart the dev server.");
      return;
    }

    setError(null);
    setOutcome(null);
    setTranscript([]);
    capturedToolArgsRef.current = null;
    callEndedCleanlyRef.current = false;
    setCallState("connecting");

    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setCallState("in-call"));

      vapi.on("message", (message: Record<string, unknown>) => {
        console.log("[voice-call-panel] message", message.type, message);

        if (message.type === "transcript" && message.transcriptType === "final") {
          setTranscript((current) => [
            ...current,
            {
              id: `${current.length}-${message.role as string}`,
              role: message.role as "assistant" | "user",
              text: message.transcript as string,
            },
          ]);
          return;
        }

        if (message.type === "tool-calls") {
          const toolCallList = (message.toolCallList as Array<{
            function: { name: string; arguments: string | Record<string, unknown> };
          }>) ?? [];

          const bookingCall = toolCallList.find((call) => call.function?.name === BOOK_MEETING_TOOL_NAME);

          if (bookingCall) {
            try {
              const rawArgs = bookingCall.function.arguments;
              capturedToolArgsRef.current =
                typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
            } catch (parseError) {
              console.error("[voice-call-panel] failed to parse tool call arguments", parseError);
            }
          }
        }
      });

      vapi.on("call-end", () => {
        callEndedCleanlyRef.current = true;
        setCallState("ended");

        // The tool-calls message can still be in flight over the data channel
        // when call-end fires (e.g. right as the user clicks "End call" just
        // after the assistant finishes speaking) -- give it a moment to land
        // before deciding there was no qualification decision.
        setTimeout(() => {
          if (capturedToolArgsRef.current) {
            void reportOutcome(capturedToolArgsRef.current);
          } else {
            void reportOutcome({ qualified: false, reason: "Call ended before a qualification decision was made." });
          }
        }, 1500);
      });

      vapi.on("error", (vapiError: unknown) => {
        // Vapi's underlying transport reports the forced disconnect from the
        // assistant hanging up (via the endCall tool) as an "ejection" error
        // -- an expected side effect of a clean hangup, not a real failure,
        // and it's the common case, not the exception. Log it quietly
        // (console.warn) instead of console.error so Next's dev overlay
        // doesn't surface a scary "Console Error" toast for a normal hangup.
        console.warn("[voice-call-panel] vapi error (likely a benign hangup ejection)", vapiError);

        // "error" and "call-end" fire independently and aren't guaranteed to
        // arrive in a fixed order, so checking callEndedCleanlyRef
        // synchronously here is a race: sometimes "error" arrives first,
        // before call-end has had a chance to set it. Give call-end a brief
        // window to land first before deciding this is a real failure.
        setTimeout(() => {
          if (callEndedCleanlyRef.current) {
            return;
          }

          // Only escalate to console.error once we're sure this wasn't a
          // clean hangup -- this is the case that actually deserves the
          // loud dev-overlay treatment.
          console.error("[voice-call-panel] vapi error was not followed by a clean call-end", vapiError);
          setError("The voice call hit an error. Check the browser console for details.");
          setCallState("ended");
        }, 500);
      });

      await vapi.start(buildVapiAssistantConfig(draft, { name: leadForm.name, companyName: leadForm.companyName }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start the voice call.");
      setCallState("idle");
    }
  };

  const onEndCall = () => {
    // A manual hangup is unambiguously clean -- mark it before calling stop()
    // so the "error" handler's race window (see vapi.on("error", ...) above)
    // can't lose and misreport this as a real failure.
    callEndedCleanlyRef.current = true;
    vapiRef.current?.stop();
  };

  return (
    <div className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
        <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Live voice call — talk to your assistant</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">
            Vapi (web call)
          </span>
        </div>

        {!canStartCall ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Approve an assistant draft above before starting a live voice call.
          </div>
        ) : null}

        {canStartCall && callState === "idle" ? (
          <form onSubmit={onStartCall} className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={leadForm.name}
              onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })}
              placeholder="Lead name (used as the greeting)"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />
            <input
              required
              value={leadForm.phoneNumber}
              onChange={(event) => setLeadForm({ ...leadForm, phoneNumber: event.target.value })}
              placeholder="Phone number (for the record only)"
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
              placeholder="Company name"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
            />

            <button
              type="submit"
              className="sm:col-span-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.01] hover:bg-zinc-800"
            >
              Start voice call (uses your microphone)
            </button>
          </form>
        ) : null}

        {callState === "connecting" ? (
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">Connecting...</div>
        ) : null}

        {callState === "in-call" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-600">Call in progress — speak into your microphone</span>
              <button
                type="button"
                onClick={onEndCall}
                className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
              >
                End call
              </button>
            </div>
          </div>
        ) : null}

        {transcript.length > 0 ? (
          <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-2xl border border-zinc-200 bg-white p-3">
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  entry.role === "assistant" ? "bg-zinc-100 text-zinc-700" : "ml-auto bg-violet-600 text-white"
                }`}
              >
                {entry.text}
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {callState === "ended" && outcome ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl p-3 ${outcome.qualified ? "bg-emerald-50" : "bg-rose-50"}`}>
              <div
                className={`text-xs uppercase tracking-[0.2em] ${
                  outcome.qualified ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                Qualification
              </div>
              <div className="mt-2 text-sm text-zinc-950">{outcome.qualified ? "Qualified" : "Not qualified"}</div>
              <p className="mt-1 text-xs text-zinc-500">{outcome.reason}</p>
            </div>

            <div className="rounded-2xl bg-violet-50 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-violet-600">Booked meeting</div>
              <div className="mt-2 text-sm text-zinc-950">
                {outcome.bookedMeetingTime ? new Date(outcome.bookedMeetingTime).toLocaleString() : "No meeting booked"}
              </div>
              {outcome.calendarEventUrl ? (
                <a
                  href={outcome.calendarEventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-violet-600 underline"
                >
                  View real event in Google Calendar
                </a>
              ) : outcome.bookedMeetingTime ? (
                <p className="mt-1 text-xs text-zinc-500">Mock — calendar not connected</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Mock CRM update</div>
              <div className="mt-2 text-sm text-zinc-950">Synced to {outcome.crmContactId}</div>
              {outcome.crmDealId ? <p className="mt-1 text-xs text-zinc-500">Deal: {outcome.crmDealId}</p> : null}
            </div>
          </div>
        ) : null}

        {callState === "ended" ? (
          <button
            type="button"
            onClick={() => {
              setCallState("idle");
              setOutcome(null);
              setTranscript([]);
              setError(null);
            }}
            className="mt-4 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600 transition hover:bg-zinc-50"
          >
            Start another call
          </button>
        ) : null}
      </div>
    </div>
  );
}
