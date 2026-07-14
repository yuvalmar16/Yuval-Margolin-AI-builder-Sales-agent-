export type PromptRiskCategory = "benign" | "suspicious" | "malicious" | "blocked";

export type PromptGateResult = {
  allowed: boolean;
  risk: PromptRiskCategory;
  reasons: string[];
  sanitizedPrompt: string;
};

const MAX_PROMPT_LENGTH = 4000;

const CONTROL_CHARS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(8) +
    String.fromCharCode(11) + String.fromCharCode(12) +
    String.fromCharCode(14) + "-" + String.fromCharCode(31) + "]",
  "g",
);

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore\s+(all|any|the)?\s*(previous|prior|above)\s*(instructions|rules|prompts)/i, reason: "instruction_override_attempt" },
  { pattern: /disregard\s+(all|any|the)?\s*(previous|prior|above)/i, reason: "instruction_override_attempt" },
  { pattern: /reveal\s+(your|the)\s*(system prompt|instructions|api key|secret|credentials|token)/i, reason: "secret_or_prompt_exfiltration" },
  { pattern: /what\s+(is|are)\s+your\s+(system prompt|instructions|rules)/i, reason: "secret_or_prompt_exfiltration" },
  { pattern: /print\s+(your|the)\s+(system prompt|instructions)/i, reason: "secret_or_prompt_exfiltration" },
  { pattern: /act\s+as\s+(dan|a jailbroken|an unfiltered)/i, reason: "jailbreak_attempt" },
  { pattern: /(no|without any)\s+(restrictions|rules|limitations|filters)/i, reason: "jailbreak_attempt" },
  { pattern: /bypass\s+(the\s+)?(safety|rules|policy|guardrails)/i, reason: "policy_bypass_attempt" },
  { pattern: /^(system|assistant)\s*:/im, reason: "role_spoofing" },
  { pattern: /<script[\s>]/i, reason: "html_script_injection" },
  { pattern: /javascript:/i, reason: "html_script_injection" },
  { pattern: /on(error|click|load)\s*=/i, reason: "html_script_injection" },
];

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /https?:\/\/\S+/i, reason: "contains_url" },
  { pattern: /\b(override|admin mode|developer mode)\b/i, reason: "elevated_mode_reference" },
];

function normalize(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

export function runPromptSafetyGate(rawPrompt: string): PromptGateResult {
  const sanitizedPrompt = normalize(rawPrompt);

  if (sanitizedPrompt.length === 0) {
    return { allowed: false, risk: "blocked", reasons: ["empty_input"], sanitizedPrompt };
  }

  if (sanitizedPrompt.length > MAX_PROMPT_LENGTH) {
    return {
      allowed: false,
      risk: "blocked",
      reasons: ["input_too_large"],
      sanitizedPrompt: sanitizedPrompt.slice(0, MAX_PROMPT_LENGTH),
    };
  }

  const blockedReasons = BLOCKED_PATTERNS.filter(({ pattern }) => pattern.test(sanitizedPrompt)).map(
    ({ reason }) => reason,
  );

  if (blockedReasons.length > 0) {
    return { allowed: false, risk: "malicious", reasons: blockedReasons, sanitizedPrompt };
  }

  const suspiciousReasons = SUSPICIOUS_PATTERNS.filter(({ pattern }) => pattern.test(sanitizedPrompt)).map(
    ({ reason }) => reason,
  );

  if (suspiciousReasons.length > 0) {
    return { allowed: true, risk: "suspicious", reasons: suspiciousReasons, sanitizedPrompt };
  }

  return { allowed: true, risk: "benign", reasons: [], sanitizedPrompt };
}

export function logPromptGatewayEvent(event: {
  requestId: string;
  workspaceId: string;
  risk: PromptRiskCategory;
  reasons: string[];
  outcome: "allowed" | "blocked";
}): void {
  if (event.outcome === "blocked" || event.risk !== "benign") {
    console.warn(
      "[prompt-safety-gateway]",
      JSON.stringify({ timestamp: new Date().toISOString(), ...event }),
    );
  }
}
