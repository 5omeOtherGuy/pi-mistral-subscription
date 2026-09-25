import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const MISTRAL_SUBSCRIPTION_PROVIDER_ID = "mistral-subscription";
export const MISTRAL_API_ID = "mistral-conversations";
export const MISTRAL_BASE_URL = "https://api.mistral.ai";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;
const TEXT_AND_IMAGE_INPUT = ["text", "image"] as const;
const TEXT_INPUT = ["text"] as const;
// Maps Pi thinking levels to Mistral's `reasoning_effort` values ("none" | "high").
const MISTRAL_THINKING_LEVEL_MAP = {
  low: "none",
  medium: "high",
  high: "high",
  xhigh: "high",
} as const;

function model(
  id: string,
  name: string,
  contextWindow: number,
  maxTokens: number,
  reasoning: boolean,
  input: readonly ("text" | "image")[],
): ProviderModelConfig {
  return {
    id,
    api: MISTRAL_API_ID,
    name,
    reasoning,
    ...(reasoning ? { thinkingLevelMap: MISTRAL_THINKING_LEVEL_MAP } : {}),
    input: [...input],
    cost: { ...ZERO_COST },
    contextWindow,
    maxTokens,
  };
}

// To add a model, append a `model(...)` entry below. See "Adding models" in README.md.
// `id` is sent verbatim to the Mistral API. Only mark `reasoning: true` for ids that
// pi-ai's mistral-conversations provider knows how to drive (see tests/models.test.ts).
export const MODELS = [
  model("mistral-medium-3.5", "Mistral Medium 3.5 (Mistral subscription)", 262144, 262144, true, TEXT_AND_IMAGE_INPUT),
  model("mistral-small-latest", "Mistral Small 4 (Mistral subscription)", 256000, 256000, true, TEXT_AND_IMAGE_INPUT),
  model("mistral-large-latest", "Mistral Large 3 (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-14b-2512", "Ministral 3 14B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-8b-2512", "Ministral 3 8B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-3b-2512", "Ministral 3 3B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("devstral-small-latest", "Devstral Small (Mistral subscription)", 128000, 128000, false, TEXT_INPUT),
] as const;
