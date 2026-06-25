import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { MISTRAL_BASE_URL, MISTRAL_SUBSCRIPTION_PROVIDER_ID, MODELS } from "../../src/models.ts";
import { mistralOAuth } from "../../src/mistral-oauth.ts";

export default function mistralSubscriptionExtension(pi: ExtensionAPI) {
  pi.registerProvider(MISTRAL_SUBSCRIPTION_PROVIDER_ID, {
    name: "Mistral subscription (Mistral AI Studio)",
    baseUrl: MISTRAL_BASE_URL,
    api: "mistral-conversations",
    authHeader: true,
    models: [...MODELS],
    oauth: mistralOAuth,
  });

  pi.registerCommand("mistral-subscription-status", {
    description: "Show local Mistral subscription provider settings",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `${MISTRAL_SUBSCRIPTION_PROVIDER_ID} uses Mistral AI Studio browser sign-in and native Mistral chat streaming.`,
        "info",
      );
    },
  });
}
