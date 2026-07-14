import type { AssistantDraft } from "@/lib/builder/assistant-draft";
import { DEFAULT_VOICE_OPTION } from "@/lib/voice/voice-options";

// Vapi Web SDK inline ("ephemeral") assistant config -- see
// docs/milestone-5-voice-provider-selection.md for the provider decision.
// This is a plain data shape, not the full Vapi SDK type, kept loose so we
// don't depend on @vapi-ai/web's exact type export surface.
export type VapiAssistantConfig = {
  name: string;
  firstMessage: string;
  model: {
    provider: "openai";
    model: "gpt-4o-mini";
    messages: Array<{ role: "system"; content: string }>;
    tools: Array<
      | {
          type: "function";
          async: boolean;
          function: {
            name: string;
            description: string;
            parameters: {
              type: "object";
              properties: Record<string, { type: "string" | "boolean"; description: string }>;
              required: string[];
            };
          };
        }
      | { type: "endCall" }
    >;
  };
  voice: {
    provider: "11labs";
    voiceId: string;
  };
  transcriber: {
    provider: "deepgram";
    model: string;
  };
};

// Defaults picked to work on a fresh Vapi trial account. If your account
// doesn't have this voice provider enabled, add its key under Vapi's
// dashboard -> Integrations, or swap these constants for a provider you do
// have configured.
const DEFAULT_VOICE_PROVIDER = "11labs";
const DEFAULT_MODEL = "gpt-4o-mini";

export const BOOK_MEETING_TOOL_NAME = "bookMeeting";

function buildSystemPrompt(draft: AssistantDraft, leadName: string, leadCompany: string): string {
  const qualificationList = draft.qualificationQuestions.map((q) => `- ${q}`).join("\n");
  const bookingList = draft.bookingRules.map((r) => `- ${r}`).join("\n");

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return [
    `You are ${draft.assistantName}, an outbound sales voice assistant.`,
    `Today's date is ${todayLabel}. Use this as the anchor for any date you mention or propose -- never propose a date that has already passed, and never guess or rely on your training data for the current date.`,
    `Purpose: ${draft.purpose}`,
    `Voice and tone: ${draft.voice}, ${draft.tone}.`,
    `You are calling ${leadName}${leadCompany ? ` from ${leadCompany}` : ""}.`,
    "Ask the following qualification questions naturally in conversation, one at a time:",
    qualificationList || "- Confirm the lead's company and their interest.",
    "Booking rules you must follow:",
    bookingList || "- Only propose meetings during business hours.",
    `Business hours: ${draft.businessHours}.`,
    "When proposing a meeting time, only offer a date within the next two weeks from today, on a weekday, within business hours.",
    `Once you have a clear qualification signal, you MUST call the "${BOOK_MEETING_TOOL_NAME}" function tool with your qualification decision, a short reason, and a proposed ISO 8601 meeting time if qualified.`,
    `IMPORTANT: actually invoking the "${BOOK_MEETING_TOOL_NAME}" function is the only thing that records the outcome anywhere. Saying out loud that you booked a meeting does NOT book it -- nothing is recorded unless you call the function. Call the function BEFORE you say anything about the outcome out loud, every single time you reach or change a decision.`,
    "If the lead is not a fit, still call the function with qualified set to false and a short reason -- do not skip calling it just because there's no meeting to book.",
    "Never end the call right after stating the outcome. Instead, after calling the function, briefly summarize the outcome out loud (qualified or not, and the proposed meeting time if any), then ask the lead to confirm that's correct.",
    `If the lead asks for any change -- a different time, a correction to the qualification details, anything -- make the adjustment, call the "${BOOK_MEETING_TOOL_NAME}" function again with the corrected information (it's fine to call it more than once when the lead requests a correction; the most recent call is what gets recorded), and ask them to confirm again. Repeat this until the lead confirms the summary is correct.`,
    `Only once the lead has explicitly confirmed the summary is correct should you say a brief, warm goodbye and wait for the lead to say goodbye back. Do not call the "endCall" tool until the lead has said goodbye or otherwise made clear the conversation is over -- never hang up immediately after your own goodbye line.`,
  ].join("\n");
}

export function buildVapiAssistantConfig(
  draft: AssistantDraft,
  lead: { name: string; companyName: string },
): VapiAssistantConfig {
  return {
    name: draft.assistantName,
    firstMessage: `Hi ${lead.name || "there"}, this is ${draft.assistantName}. Do you have a couple of minutes to talk?`,
    model: {
      provider: "openai",
      model: DEFAULT_MODEL,
      messages: [{ role: "system", content: buildSystemPrompt(draft, lead.name, lead.companyName) }],
      tools: [
        {
          type: "function",
          async: true,
          function: {
            name: BOOK_MEETING_TOOL_NAME,
            description: "Record the qualification outcome and, if qualified, the proposed meeting time.",
            parameters: {
              type: "object",
              properties: {
                qualified: { type: "boolean", description: "Whether the lead is qualified." },
                reason: { type: "string", description: "Short reason for the qualification decision." },
                meetingTime: {
                  type: "string",
                  description: "Proposed meeting time in ISO 8601 format, required only if qualified.",
                },
              },
              required: ["qualified", "reason"],
            },
          },
        },
        { type: "endCall" },
      ],
    },
    voice: {
      provider: DEFAULT_VOICE_PROVIDER,
      voiceId: draft.ttsVoiceId || DEFAULT_VOICE_OPTION.id,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
    },
  };
}
