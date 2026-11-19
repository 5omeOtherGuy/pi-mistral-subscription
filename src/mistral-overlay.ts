import type { Api, Model } from "@earendil-works/pi-ai";

// Mistral rejected these IDs with a subscription key on 2026-10-31.
// Older Pi catalogs can still list them.
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

export function subscriptionModels(models: Model<Api>[]): Model<Api>[] {
  return models.filter((model) => !UNAVAILABLE_MODELS.has(model.id));
}
