import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export const MISTRAL_PROVIDER_ID = "mistral";
export const MISTRAL_SUBSCRIPTION_PROVIDER_ID = "mistral-subscription";
export const MISTRAL_API_ID = "mistral-conversations";
export const MISTRAL_BASE_URL = "https://api.mistral.ai";

// Cost rates are USD per million tokens, the unit pi-ai's `calculateCost` multiplies
// by token usage. Zero means tokens are logged without a price.
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;
const TEXT_AND_IMAGE_INPUT = ["text", "image"] as const;
const TEXT_INPUT = ["text"] as const;

// La Plateforme API prices from Mistral's pricing page
// (https://docs.mistral.ai/inference/pricing, retrieved 2026-10-31), which
// publishes Input / Cached input / Output columns and no separate cache-write
// rate, so prompt-cache writes bill at the standard input price.
function apiCost(input: number, cachedInput: number, output: number) {
  return { input, cacheRead: cachedInput, cacheWrite: input, output } as const;
}
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
export const LARGE_4_THINKING_LEVEL_MAP = {
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
// Checked against the live API on 2026-10-31.
const DEEPSEEK_THINKING_LEVEL_MAP = {
  off: "none",
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: "xhigh",
  max: "max",
} as const;

function model(
  id: string,
  name: string,
  contextWindow: number,
  maxTokens: number,
  reasoning: boolean,
  input: readonly ("text" | "image")[],
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number } = ZERO_COST,
): Extract<ProviderModelConfig, { reasoning: boolean }> {
  return {
    id,
    api: MISTRAL_API_ID,
    name,
    reasoning,
    ...(reasoning ? { thinkingLevelMap: MISTRAL_THINKING_LEVEL_MAP } : {}),
    input: [...input],
    cost: { ...cost },
    contextWindow,
    maxTokens,
  };
}

// Models of the deprecated `mistral-subscription` provider, which keeps saved
// settings and sessions working. The overlay also uses a few of them as fallbacks,
// so removing that provider must keep those entries.
// `id` is sent verbatim to the Mistral API. Reasoning models use thinkingLevelMap
// to select reasoning_effort in Pi 0.99+ (see tests/mistral-stream.test.ts).
export const MODELS = [
  // Not sold on the public API (absent from the pricing page and its model
  // card lists no price): subscription tokens only, logged without a price.
  model("mistral-medium-3.5", "Mistral Medium 3.5 (Mistral subscription)", 262144, 262144, true, TEXT_AND_IMAGE_INPUT),
  model(
    "mistral-small-latest",
    "Mistral Small 4 (Mistral subscription)",
    256000,
    256000,
    true,
    TEXT_AND_IMAGE_INPUT,
    apiCost(0.15, 0.015, 0.6),
  ),
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
      apiCost(0.7, 0.07, 2.1),
    ),
    thinkingLevelMap: LARGE_4_THINKING_LEVEL_MAP,
  },
  // Deprecated and no longer on the pricing page: tokens logged without a price.
  model("mistral-medium-latest", "Mistral Medium (Mistral subscription)", 262144, 262144, true, TEXT_AND_IMAGE_INPUT),
  model("mistral-large-latest", "Mistral Large 3 (Mistral subscription)", 262144, 262144, false, TEXT_AND_IMAGE_INPUT),
  model(
    "ministral-14b-2512",
    "Ministral 3 14B (Mistral subscription)",
    262144,
    262144,
    false,
    TEXT_AND_IMAGE_INPUT,
    apiCost(0.2, 0.02, 0.2),
  ),
  model(
    "ministral-8b-2512",
    "Ministral 3 8B (Mistral subscription)",
    262144,
    262144,
    false,
    TEXT_AND_IMAGE_INPUT,
    apiCost(0.15, 0.015, 0.15),
  ),
  model(
    "ministral-3b-2512",
    "Ministral 3 3B (Mistral subscription)",
    262144,
    262144,
    false,
    TEXT_AND_IMAGE_INPUT,
    apiCost(0.1, 0.01, 0.1),
  ),
  // Legacy and no longer on the pricing page: tokens logged without a price.
  model("devstral-small-latest", "Devstral Small (Mistral subscription)", 128000, 128000, false, TEXT_INPUT),
  // Z.ai GLM 5.3 models hosted on Mistral's platform, served by the Vibe catalog
  // (`surface=vibe-code`: "GLM 5.3 (Mistral Hosted)" / "GLM 5.3 Flash (Mistral Hosted)",
  // max_context_length 1048576) and by `GET /v1/models` ("Official Z.ai GLM 5.3 model",
  // "GLM 5.3 Flash with a 1M context limit"; the flash variant has vision). Reasoning
  // efforts are low/high/max with no "none", so off cannot disable the trace. Neither
  // endpoint publishes an output limit, so they keep the conservative local cap.
  {
    ...model(
      "zai-glm-5-3",
      "GLM 5.3 (Mistral subscription)",
      1_048_576,
      32_768,
      true,
      TEXT_INPUT,
      apiCost(1.4, 0.14, 4.4),
    ),
    thinkingLevelMap: GLM_THINKING_LEVEL_MAP,
  },
  {
    ...model(
      "zai-glm-5-3-flash",
      "GLM 5.3 Flash (Mistral subscription)",
      1_048_576,
      32_768,
      true,
      TEXT_AND_IMAGE_INPUT,
      apiCost(0.15, 0.03, 0.5),
    ),
    thinkingLevelMap: GLM_THINKING_LEVEL_MAP,
  },
  // DeepSeek V4.1 Flash 1017, hosted on Mistral's platform (GET /v1/models:
  // "DeepSeek V4.1 Flash 1017 with a 1M context limit", vision, reasoning). It
  // is not in the Vibe surface. Reasoning efforts confirmed by live calls: none, low,
  // high, xhigh and max. No published output limit, so the conservative local cap applies.
  {
    ...model(
      "deepseek-v4-1-flash-1017",
      "DeepSeek V4.1 Flash 1017 (Mistral subscription)",
      1_048_576,
      32_768,
      true,
      TEXT_AND_IMAGE_INPUT,
      apiCost(0.3, 0.007, 1.2),
    ),
    thinkingLevelMap: DEEPSEEK_THINKING_LEVEL_MAP,
  },
] as const;
