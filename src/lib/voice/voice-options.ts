export type VoiceOption = {
  id: string;
  label: string;
  description: string;
};

// A short list of ElevenLabs' long-standing premade voices, available on
// every account by default. IDs can change if ElevenLabs retires a voice --
// if a selection 400s at call time, open the ElevenLabs dashboard's Voice
// Library, copy the voice ID from there, and use the "Custom voice ID" field
// in the builder instead of picking from this list.
export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Calm, professional (ElevenLabs default)" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", description: "Deep, confident" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", description: "Warm, conversational" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "Friendly, energetic" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", description: "Smooth, articulate" },
];

export const DEFAULT_VOICE_OPTION = VOICE_OPTIONS[0];

export function findVoiceOption(voiceId: string): VoiceOption | null {
  return VOICE_OPTIONS.find((option) => option.id === voiceId) ?? null;
}
