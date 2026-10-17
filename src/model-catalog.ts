import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { RefreshModelsContext } from "@earendil-works/pi-ai";

import { isRecord } from "./type-guards.ts";
import { MISTRAL_API_ID, MODELS } from "./models.ts";

// Mistral Vibe's model-catalog client uses this endpoint and surface, not /v1/models.
export const MODEL_CATALOG_URL = "https://api.mistral.ai/v1/model-catalog?surface=vibe-code";
const REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_TOKENS = 32_768;
type CatalogModel = Extract<ProviderModelConfig, { reasoning: boolean }>;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function catalogModels(payload: unknown): CatalogModel[] {
  if (!isRecord(payload) || !Array.isArray(payload.models)) return [];
  const fallback = new Map<string, CatalogModel>(MODELS.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const models: CatalogModel[] = [];

  for (const raw of payload.models) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() ||
      typeof raw.label !== "string" || !raw.label.trim() || seen.has(raw.id)) continue;
    const capabilities = isRecord(raw.capabilities) ? raw.capabilities : {};
    // Pi needs chat completions and tool calls for an agent model. Missing flags
    // are not evidence that a model supports either capability.
    if (capabilities.completion_chat !== true || capabilities.function_calling !== true) continue;

    const known = fallback.get(raw.id);
    const contextWindow = Number.isSafeInteger(raw.max_context_length) && (raw.max_context_length as number) > 0
      ? raw.max_context_length as number : known?.contextWindow;
    if (!contextWindow) continue;

    const parameters = isRecord(raw.parameters) ? raw.parameters : {};
    const efforts = Array.isArray(parameters.reasoning) ? parameters.reasoning : [];
    const hasHigh = efforts.includes("high");
    const hasNone = efforts.includes("none");
    const reasoning = hasHigh;
    const thinkingLevelMap = hasHigh ? {
      off: hasNone ? "none" : null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: null,
    } as const : undefined;
    models.push({
      id: raw.id,
      api: MISTRAL_API_ID,
      name: `${raw.label} (Mistral subscription)`,
      reasoning,
      ...(thinkingLevelMap ? { thinkingLevelMap } : {}),
      input: capabilities.vision === true ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow,
      // The catalog only publishes context length, not an output limit.
      maxTokens: Math.min(known?.maxTokens ?? DEFAULT_OUTPUT_TOKENS, contextWindow),
    });
    seen.add(raw.id);
  }
  return models;
}

export function createModelCatalog(fetch: FetchLike = globalThis.fetch.bind(globalThis)) {
  return async (context: RefreshModelsContext): Promise<CatalogModel[]> => {
    const credential = context.credential;
    const apiKey = credential?.type === "oauth" ? credential.access : credential?.key;
    if (!context.allowNetwork || !apiKey || context.signal.aborted) return [...MODELS];

    try {
      const response = await fetch(MODEL_CATALOG_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.any([context.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
      if (!response.ok) return [...MODELS];
      const models = catalogModels(await response.json());
      return models.length ? models : [...MODELS];
    } catch {
      return [...MODELS];
    }
  };
}

export const refreshMistralModels = createModelCatalog();
