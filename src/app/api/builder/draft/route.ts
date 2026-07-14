import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import {
  createDefaultDraft,
  normalizeAssistantDraft,
  type AssistantDraft,
} from "@/lib/builder/assistant-draft";
import { logPromptGatewayEvent, runPromptSafetyGate } from "@/lib/security/prompt-gateway";

const SAFE_BLOCKED_MESSAGE =
  "I can't perform that action because it conflicts with the platform's security rules. I can help you configure the assistant using the supported settings.";

const OFF_TOPIC_MESSAGE =
  "This builder only creates outbound sales / lead-qualification voice assistants. Try describing how you want your sales assistant to sound, what it should ask leads, or its booking rules instead.";

function extractStructuredJson(content: string): unknown | null {
  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");

  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
}

const GENERATION_SYSTEM_PROMPT = `You configure exactly one kind of product: an outbound sales / lead-qualification voice calling assistant. It calls leads, asks qualification questions, and books meetings. The user's message describes how they want THIS sales assistant to behave -- its tone, voice, qualification questions, or booking rules. It is never a request for you to build a different application.

If the user's request is unrelated to configuring an outbound sales/lead-qualification voice assistant (for example: recipes, news, general trivia, or an unrelated chatbot/tool), respond with exactly this JSON and nothing else: {"offTopic": true}

Sometimes the user message includes the CURRENT configuration as JSON plus a new instruction. When that happens, revise incrementally: keep every field the instruction doesn't address exactly as it was, and append new qualification questions / booking rules / enabled tools to the existing arrays rather than discarding what's already there -- unless the instruction explicitly says to replace or remove something.

businessHours and bookingRules are different fields, not alternatives: businessHours holds the literal day/time window (e.g. "Mon-Fri, 09:00-17:00"), while bookingRules is the visible list of every constraint on when or how a meeting can be booked, stated as short natural-language rules. Any instruction about calling hours or booking constraints -- including one that only restates the business hours -- must be reflected as its own entry in bookingRules AND update businessHours if a specific window was given. bookingRules must never be empty: even with no explicit rules from the user, include baseline rules such as "Only book meetings on weekdays" and "Require a clear qualification signal before booking."

Otherwise, return only valid JSON with keys: assistantName, purpose, voice, tone, qualificationQuestions, bookingRules, businessHours, enabledTools. Every field must describe a sales/lead-qualification voice assistant, regardless of the subject matter the user mentioned.`;

type GenerationResult =
  | { status: "generated"; draft: AssistantDraft }
  | { status: "off_topic" }
  | { status: "unavailable" };

async function generateDraftFromOpenAI(
  prompt: string,
  currentDraft: AssistantDraft | null,
): Promise<GenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { status: "unavailable" };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const userContent = currentDraft
    ? `Current assistant configuration (JSON):\n${JSON.stringify(currentDraft)}\n\nNew instruction: "${prompt}"\n\nReturn the full updated configuration as JSON with the same keys.`
    : prompt;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: GENERATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { status: "unavailable" };
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const messageContent = payload.choices?.[0]?.message?.content;
  const parsed = messageContent ? extractStructuredJson(messageContent) : null;

  if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).offTopic === true) {
    return { status: "off_topic" };
  }

  const normalized = normalizeAssistantDraft(parsed);

  return normalized ? { status: "generated", draft: normalized } : { status: "unavailable" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const currentDraft = normalizeAssistantDraft(body?.currentDraft);

    if (!prompt) {
      return NextResponse.json(
        { error: "A prompt is required to generate a draft." },
        { status: 400 },
      );
    }

    const requestId = randomUUID();
    const gateResult = runPromptSafetyGate(prompt);

    logPromptGatewayEvent({
      requestId,
      workspaceId: "personal-workspace",
      risk: gateResult.risk,
      reasons: gateResult.reasons,
      outcome: gateResult.allowed ? "allowed" : "blocked",
    });

    if (!gateResult.allowed) {
      await recordAuditEvent({
        workspaceId: "personal-workspace",
        entityType: "prompt_request",
        entityId: requestId,
        action: "prompt_blocked",
        result: "blocked",
        riskLevel: gateResult.risk,
        requestId,
      });

      return NextResponse.json({ error: SAFE_BLOCKED_MESSAGE, requestId }, { status: 400 });
    }

    const safePrompt = gateResult.sanitizedPrompt;
    const generation = await generateDraftFromOpenAI(safePrompt, currentDraft);

    if (generation.status === "off_topic") {
      await recordAuditEvent({
        workspaceId: "personal-workspace",
        entityType: "prompt_request",
        entityId: requestId,
        action: "draft_generated",
        result: "blocked",
        riskLevel: gateResult.risk,
        requestId,
      });

      return NextResponse.json({ error: OFF_TOPIC_MESSAGE, requestId }, { status: 400 });
    }

    const draft =
      generation.status === "generated"
        ? generation.draft
        : currentDraft ?? createDefaultDraft(safePrompt);

    // The generation prompt never asks the model for ttsVoiceId -- it's a
    // UI-picked setting, not something chat edits should touch. Carry the
    // prior selection forward across regenerations so picking a voice
    // survives follow-up chat messages.
    if (currentDraft && generation.status === "generated") {
      draft.ttsVoiceId = currentDraft.ttsVoiceId;
    }

    const normalized = normalizeAssistantDraft(draft);

    // Don't just trust the model to keep this non-empty (the system prompt
    // asks it to, but it isn't guaranteed) -- an assistant with zero booking
    // rules reads as broken in the UI, so fall back to sensible defaults
    // rather than silently shipping an empty list.
    if (normalized && normalized.bookingRules.length === 0) {
      normalized.bookingRules = createDefaultDraft(safePrompt).bookingRules;
    }

    if (!normalized) {
      await recordAuditEvent({
        workspaceId: "personal-workspace",
        entityType: "prompt_request",
        entityId: requestId,
        action: "draft_generated",
        result: "failure",
        riskLevel: gateResult.risk,
        requestId,
      });

      return NextResponse.json(
        { error: "The generated draft was invalid and could not be used." },
        { status: 500 },
      );
    }

    await recordAuditEvent({
      workspaceId: "personal-workspace",
      entityType: "prompt_request",
      entityId: requestId,
      action: "draft_generated",
      result: "success",
      riskLevel: gateResult.risk,
      requestId,
    });

    return NextResponse.json({ draft: normalized });
  } catch (error) {
    console.error("builder draft route error", error);

    return NextResponse.json(
      { error: "Unable to generate the assistant draft right now." },
      { status: 500 },
    );
  }
}
