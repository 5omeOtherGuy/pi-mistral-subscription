import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const MISTRAL_PROVIDER_ID = "mistral";
export const MISTRAL_SUBSCRIPTION_PROVIDER_ID = "mistral-subscription";
export const MISTRAL_API_ID = "mistral-conversations";
export const MISTRAL_BASE_URL = "https://api.mistral.ai";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;
const TEXT_AND_IMAGE_INPUT = ["text", "image"] as const;
const TEXT_INPUT = ["text"] as const;
// Maps Pi thinking levels to Mistral's `reasoning_effort` values. Levels a model
// rejects are null, so Pi only offers what the API accepts.
const MISTRAL_THINKING_LEVEL_MAP = {
  off: "none",
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: null,
} as const;
// Mistral documents low, medium and high for Large 4 and rejects none, so off is not offered.
const LARGE_4_THINKING_LEVEL_MAP = {
  off: null,
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
  max: null,
} as const;
// Mistral documents low, high and max for GLM 5.3, and no none, so off is not offered.
const GLM_THINKING_LEVEL_MAP = {
  off: null,
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
} as const;

function model(
  id: string,
  name: string,
  contextWindow: number,
  maxTokens: number,
  reasoning: boolean,
  input: readonly ("text" | "image")[],
): Extract<ProviderModelConfig, { reasoning: boolean }> {
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

// Models of the deprecated `mistral-subscription` provider, which exists only so
// that saved settings and sessions keep working. `id` is sent verbatim to the Mistral API. Reasoning models use thinkingLevelMap
// to select reasoning_effort in Pi 0.99+ (see tests/mistral-stream.test.ts).
export const MODELS = [
  model("mistral-medium-3.5", "Mistral Medium 3.5 (Mistral subscription)", 262144, 262144, true, TEXT_AND_IMAGE_INPUT),
  model("mistral-medium-latest", "Mistral Medium (Mistral subscription)", 262144, 262144, true, TEXT_AND_IMAGE_INPUT),
  model("mistral-small-latest", "Mistral Small 4 (Mistral subscription)", 256000, 256000, true, TEXT_AND_IMAGE_INPUT),
  // The model card publishes a 1M context, not a separate output limit.
  // Use a conservative local 32k output cap until that limit is documented.
  {
    ...model(
      "mistral-large-4",
      "Mistral Large 4 Preview (Mistral subscription)",
      1_000_000,
      32_768,
      true,
      TEXT_AND_IMAGE_INPUT,
    ),
    thinkingLevelMap: LARGE_4_THINKING_LEVEL_MAP,
  },
  model("mistral-large-latest", "Mistral Large 3 (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-14b-2512", "Ministral 3 14B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-8b-2512", "Ministral 3 8B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("ministral-3b-2512", "Ministral 3 3B (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model("devstral-small-latest", "Devstral Small (Mistral subscription)", 128000, 128000, false, TEXT_INPUT),
  // Z.ai models hosted by Mistral.
  {
    ...model("zai-glm-5-3", "GLM 5.3 (Mistral subscription)", 1_048_576, 128_000, true, TEXT_INPUT),
    thinkingLevelMap: GLM_THINKING_LEVEL_MAP,
  },
  {
    ...model(
      "zai-glm-5-3-flash",
      "GLM 5.3 Flash (Mistral subscription)",
      1_048_576,
      128_000,
      true,
      TEXT_AND_IMAGE_INPUT,
    ),
    thinkingLevelMap: GLM_THINKING_LEVEL_MAP,
  },
] as const;
