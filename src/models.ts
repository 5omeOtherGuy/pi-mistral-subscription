import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const MISTRAL_SUBSCRIPTION_PROVIDER_ID = "mistral-subscription";
export const MISTRAL_API_ID = "mistral-conversations";
export const MISTRAL_BASE_URL = "https://api.mistral.ai";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;
const TEXT_AND_IMAGE_INPUT = ["text", "image"] as const;
const TEXT_INPUT = ["text"] as const;
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

export const MODELS = [
  model("mistral-medium-3.5", "Mistral Medium 3.5 (Mistral subscription)", 128000, 128000, true, TEXT_AND_IMAGE_INPUT),
  model("devstral-small-latest", "Devstral Small (Mistral subscription)", 128000, 128000, false, TEXT_INPUT),
] as const;
