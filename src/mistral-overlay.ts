import type { Api, Model } from "@earendil-works/pi-ai";

import { LARGE_4_THINKING_LEVEL_MAP, MISTRAL_BASE_URL, MISTRAL_PROVIDER_ID, MODELS } from "./models.ts";

// In Pi's catalog, but a subscription key cannot call them: Mistral answers
// "Invalid model", or 403 for the Labs model (checked 2026-10-31).
const UNAVAILABLE_MODELS = new Set([
  "devstral-medium-2507",
  "devstral-small-2505",
  "devstral-small-2507",
  "labs-leanstral-1-5-1",
  "mistral-large-2411",
  "mistral-large-4-0-8",
  "mistral-nemo",
  "pixtral-large-latest",
]);

// Pi's bundled catalog can lack these until its online catalog arrives, which
// print mode never fetches. Pi's own entry wins as soon as it has one.
const ALWAYS_OFFERED_MODELS = new Set(["mistral-large-4", "zai-glm-5-3", "zai-glm-5-3-flash"]);

const GLM_5_2_THINKING_LEVEL_MAP = {
  off: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
} as const;

const DEEPSEEK_THINKING_LEVEL_MAP = {
  off: "none",
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: "xhigh",
  max: "max",
} as const;

// Stops a runaway turn: Large 4 once spent 32,768 tokens on one empty tool call,
// and Pi's limit of 262,144 would have let that run eight times as long.
const LARGE_4_MAX_TOKENS = 32_768;

function missingModels(models: Model<Api>[]): Model<Api>[] {
  const known = new Set(models.map((model) => model.id));
  const baseUrl = models[0]?.baseUrl ?? MISTRAL_BASE_URL;
  return MODELS.filter((model) => ALWAYS_OFFERED_MODELS.has(model.id) && !known.has(model.id)).map(
    (model) => ({ ...model, provider: MISTRAL_PROVIDER_ID, baseUrl }) as Model<Api>,
  );
}

function adjusted(model: Model<Api>): Model<Api> {
  switch (model.id) {
    case "glm-5-2":
    case "zai-glm-5-2":
      return { ...model, thinkingLevelMap: GLM_5_2_THINKING_LEVEL_MAP };
    case "deepseek-v4-1-flash-1017":
      return { ...model, input: ["text", "image"], thinkingLevelMap: DEEPSEEK_THINKING_LEVEL_MAP };
    case "mistral-large-4":
      return {
        ...model,
        maxTokens: Math.min(model.maxTokens, LARGE_4_MAX_TOKENS),
        thinkingLevelMap: LARGE_4_THINKING_LEVEL_MAP,
      };
    default:
      return model;
  }
}

// Pi applies this only while a browser sign-in is active, so API-key use of the
// built-in provider stays exactly as Pi ships it.
export function subscriptionModels(models: Model<Api>[]): Model<Api>[] {
  const available = models.filter((model) => !UNAVAILABLE_MODELS.has(model.id));
  return [...available, ...missingModels(available)].map(adjusted);
}
