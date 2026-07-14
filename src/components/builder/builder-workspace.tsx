"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createDefaultDraft,
  normalizeAssistantDraft,
  type AssistantDraft,
} from "@/lib/builder/assistant-draft";
import { CrmDemoPanel } from "@/components/builder/crm-demo-panel";
import { DemoLeadsPanel } from "@/components/builder/demo-leads-panel";
import { GoogleCalendarConnect } from "@/components/builder/google-calendar-connect";
import { VoiceCallPanel } from "@/components/builder/voice-call-panel";
import type { DemoLead } from "@/lib/crm/demo-leads";
import { VOICE_OPTIONS, findVoiceOption } from "@/lib/voice/voice-options";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const starterMessages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    content:
      "Describe the assistant you want to create, and I’ll turn it into a structured sales workflow preview.",
  },
];

const suggestionPills = [
  "Create a friendly outbound sales assistant",
  "Ask about budget and book meetings on weekdays",
  "Only call within business hours",
];

export function BuilderWorkspace() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AssistantDraft>(
    createDefaultDraft("Create an outbound sales assistant"),
  );
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [savedStatus, setSavedStatus] = useState<"draft" | "approved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<"catalog" | "custom">(
    findVoiceOption(draft.ttsVoiceId) ? "catalog" : "custom",
  );
  const [selectedLead, setSelectedLead] = useState<DemoLead | null>(null);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);

  const onSelectVoice = (voiceId: string) => {
    setDraft((current) => ({ ...current, ttsVoiceId: voiceId }));
  };

  const lastAssistantMessage = useMemo(() => {
    return messages.filter((message) => message.role === "assistant").slice(-1)[0];
  }, [messages]);

  useEffect(() => {
    async function loadLatestDraft() {
      try {
        const response = await fetch("/api/builder/draft/latest");
        const payload = (await response.json()) as {
          saved?: {
            versionNumber?: number;
            status?: "draft" | "approved";
          } | null;
        };

        if (response.ok && payload.saved?.versionNumber) {
          setSavedVersion(payload.saved.versionNumber);
          setSavedStatus(payload.saved.status ?? "draft");
        }
      } catch {
        setError("Unable to load the latest draft version.");
      }
    }

    void loadLatestDraft();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    const nextUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, nextUserMessage]);

    try {
      const response = await fetch("/api/builder/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmed,
          currentDraft: hasGeneratedDraft ? draft : null,
        }),
      });

      const payload = (await response.json()) as {
        draft?: unknown;
        error?: string;
      };

      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "Unable to generate the assistant draft.");
      }

      const nextDraft = normalizeAssistantDraft(payload.draft);

      if (!nextDraft) {
        throw new Error("The returned draft was incomplete or invalid.");
      }

      const nextAssistantMessage: Message = {
        id: `assistant-${Date.now() + 1}`,
        role: "assistant",
        content:
          "I generated a structured assistant preview based on your request. It now includes qualification questions, booking rules, tone, and a safe approval flow.",
      };

      setMessages((current) => [...current, nextAssistantMessage]);
      setDraft(nextDraft);
      setHasGeneratedDraft(true);
      setInput("");
    } catch (caughtError) {
      const fallbackMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate the assistant draft right now.";

      setError(fallbackMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSaveDraft = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/builder/draft/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draft }),
      });

      const payload = (await response.json()) as {
        saved?: {
          versionNumber?: number;
          status?: "draft" | "approved";
        };
        error?: string;
      };

      if (!response.ok || !payload.saved?.versionNumber) {
        throw new Error(payload.error ?? "Unable to save the assistant draft.");
      }

      setSavedVersion(payload.saved.versionNumber);
      setSavedStatus(payload.saved.status ?? "draft");
    } catch (caughtError) {
      const fallbackMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the assistant draft right now.";

      setError(fallbackMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const onApproveDraft = async () => {
    if (!savedVersion) {
      setError("Save the draft before approving it.");
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch("/api/builder/draft/approve", {
        method: "POST",
      });

      const payload = (await response.json()) as {
        saved?: {
          versionNumber?: number;
          status?: "draft" | "approved";
        };
        error?: string;
      };

      if (!response.ok || !payload.saved?.versionNumber) {
        throw new Error(payload.error ?? "Unable to approve the assistant draft.");
      }

      setSavedVersion(payload.saved.versionNumber);
      setSavedStatus(payload.saved.status ?? "approved");
    } catch (caughtError) {
      const fallbackMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to approve the assistant draft right now.";

      setError(fallbackMessage);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f4fd] text-zinc-900">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-zinc-950">
            Yuval Margolin Alta AI builder agent
            <span className="text-violet-500" aria-hidden>
              ✦
            </span>
          </Link>
          <span className="text-sm text-zinc-500">Builder</span>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-violet-500">
              Builder Workspace
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950 sm:text-4xl">
              Chat with the AI builder
            </h1>
          </div>
          <div className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm">
            Preview mode
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        message.role === "assistant"
                          ? "bg-white text-zinc-700 shadow-sm"
                          : "ml-auto bg-violet-600 text-white"
                      }`}
                    >
                      {message.content}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {suggestionPills.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setInput(pill)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 transition hover:bg-zinc-50"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <form onSubmit={onSubmit} className="mt-4 space-y-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="min-h-[110px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
                  placeholder="Describe the assistant you want to build..."
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.01] hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? "Generating..." : "Generate assistant draft"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={onSaveDraft}
                    className="rounded-full border border-violet-300 bg-violet-50 px-5 py-3 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    disabled={isApproving || !savedVersion}
                    onClick={onApproveDraft}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApproving ? "Approving..." : savedStatus === "approved" ? "Approved" : "Approve draft"}
                  </button>
                </div>
                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}
              </form>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="rounded-[22px] border border-zinc-100 bg-zinc-50 p-4">
              <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
                <span>Workflow preview</span>
                <span>
                  {savedStatus === "approved" && savedVersion
                    ? `Approved v${savedVersion}`
                    : savedVersion
                      ? `Saved v${savedVersion}`
                      : lastAssistantMessage
                        ? "Updated"
                        : "Waiting"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Assistant
                  </div>
                  <div className="mt-2 text-lg font-semibold text-zinc-950">
                    {draft.assistantName}
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                    Purpose
                  </div>
                  <p className="mt-2 text-sm text-emerald-900">{draft.purpose}</p>
                </div>

                <div className="rounded-2xl bg-violet-50 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-violet-600">
                    Qualification questions
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-violet-900">
                    {draft.qualificationQuestions.map((question) => (
                      <li key={question}>• {question}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Booking rules
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                    {draft.bookingRules.map((rule) => (
                      <li key={rule}>• {rule}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                    Call voice
                  </div>
                  <select
                    value={voiceMode === "catalog" ? draft.ttsVoiceId : "custom"}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "custom") {
                        setVoiceMode("custom");
                        return;
                      }
                      setVoiceMode("catalog");
                      onSelectVoice(value);
                    }}
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400"
                  >
                    {VOICE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} — {option.description}
                      </option>
                    ))}
                    <option value="custom">Custom voice ID...</option>
                  </select>
                  {voiceMode === "custom" ? (
                    <input
                      value={draft.ttsVoiceId}
                      onChange={(event) => onSelectVoice(event.target.value)}
                      placeholder="Paste an ElevenLabs voice ID"
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400"
                    />
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-400">
                    Used for the live voice call. Preset IDs are ElevenLabs' default voices — if a
                    call rejects one, grab a fresh ID from your ElevenLabs voice library instead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <GoogleCalendarConnect />
        </div>
        <div className="mt-6">
          <DemoLeadsPanel
            selectedLeadId={selectedLead?.id ?? null}
            onSelectLead={setSelectedLead}
            refreshKey={leadsRefreshKey}
          />
        </div>
        <VoiceCallPanel
          draft={draft}
          canStartCall={savedStatus === "approved"}
          prefillLead={selectedLead}
          onCallCompleted={() => setLeadsRefreshKey((key) => key + 1)}
        />
        <CrmDemoPanel savedStatus={savedStatus} />
      </section>
    </main>
  );
}
