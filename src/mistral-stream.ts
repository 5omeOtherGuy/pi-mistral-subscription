import type { Api, Model, SimpleStreamOptions, StreamFunction } from "@earendil-works/pi-ai";
import { streamSimpleMistral } from "@earendil-works/pi-ai/mistral";

import { MISTRAL_SUBSCRIPTION_PROVIDER_ID } from "./models.ts";

// pi-ai 0.79.x treats unknown reasoning ids as legacy prompt_mode models.
// Keep native streaming, but force Large 4 preview to its supported high effort.
export const streamMistralSubscription: StreamFunction<Api, SimpleStreamOptions> = (model, context, options) => {
  if (model.api !== "mistral-conversations") {
    throw new Error(`Unsupported API for Mistral subscription: ${model.api}`);
  }
  const mistralModel = model as Model<"mistral-conversations">;
  if (model.provider !== MISTRAL_SUBSCRIPTION_PROVIDER_ID || model.id !== "mistral-large-4") {
    return streamSimpleMistral(mistralModel, context, options);
  }

  return streamSimpleMistral(mistralModel, context, {
    ...options,
    onPayload: async (payload, requestModel) => {
      const fixedPayload = fixedHighReasoning(payload);
      const replacement = await options?.onPayload?.(fixedPayload, requestModel);
      return fixedHighReasoning(replacement ?? fixedPayload);
    },
  });
};

function fixedHighReasoning(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected an object for the Mistral Large 4 request payload");
  }
  // These are the Mistral SDK's camelCase fields; it serializes them to snake_case.
  const { promptMode: _promptMode, ...request } = payload as Record<string, unknown>;
  return { ...request, reasoningEffort: "high" };
}
