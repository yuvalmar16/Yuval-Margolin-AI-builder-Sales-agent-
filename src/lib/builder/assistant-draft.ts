import { DEFAULT_VOICE_OPTION } from "@/lib/voice/voice-options";

export type AssistantDraft = {
  assistantName: string;
  purpose: string;
  voice: string;
  tone: string;
  qualificationQuestions: string[];
  bookingRules: string[];
  businessHours: string;
  enabledTools: string[];
  // ElevenLabs voice ID used for the live voice call -- a UI-picked setting,
  // not something the chat-based generator should invent or overwrite.
  ttsVoiceId: string;
};

function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeString(item))
    .filter((item): item is string => item !== null);
}

export function normalizeAssistantDraft(value: unknown): AssistantDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const assistantName = sanitizeString(candidate.assistantName);
  const purpose = sanitizeString(candidate.purpose);
  const voice = sanitizeString(candidate.voice);
  const tone = sanitizeString(candidate.tone);
  const businessHours = sanitizeString(candidate.businessHours);

  if (
    !assistantName ||
    !purpose ||
    !voice ||
    !tone ||
    !businessHours
  ) {
    return null;
  }

  return {
    assistantName,
    purpose,
    voice,
    tone,
    qualificationQuestions: sanitizeStringArray(candidate.qualificationQuestions),
    bookingRules: sanitizeStringArray(candidate.bookingRules),
    businessHours,
    enabledTools: sanitizeStringArray(candidate.enabledTools),
    ttsVoiceId: sanitizeString(candidate.ttsVoiceId) ?? DEFAULT_VOICE_OPTION.id,
  };
}

export function createDefaultDraft(prompt: string): AssistantDraft {
  const lower = prompt.toLowerCase();

  return {
    assistantName: "Outbound Sales Assistant",
    purpose: lower.includes("budget")
      ? "Qualify leads and ask about budget before booking meetings."
      : "Qualify leads, identify buying intent, and book meetings.",
    voice: lower.includes("friendly") ? "Warm and conversational" : "Professional",
    tone: lower.includes("friendly") ? "Friendly and encouraging" : "Confident and direct",
    qualificationQuestions: [
      "What company are you reaching out from?",
      "What problem are you solving for them?",
      "Do you have a timeline for evaluating this?",
      "Is budget something we should discuss now?",
    ],
    bookingRules: [
      "Only book meetings on weekdays",
      "Do not call outside business hours",
      "Require a clear qualification signal before booking",
    ],
    businessHours: "Mon-Fri, 09:00-17:00",
    enabledTools: ["lead qualification", "mock CRM sync", "meeting scheduling preview"],
    ttsVoiceId: DEFAULT_VOICE_OPTION.id,
  };
}
