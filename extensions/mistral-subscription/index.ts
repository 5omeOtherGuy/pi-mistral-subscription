import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mistralOAuth } from "../../src/mistral-oauth.ts";
import { subscriptionModels } from "../../src/mistral-overlay.ts";
import { MISTRAL_BASE_URL, MISTRAL_PROVIDER_ID, MISTRAL_SUBSCRIPTION_PROVIDER_ID, MODELS } from "../../src/models.ts";

function warnIfDeprecated(model: ExtensionContext["model"], ctx: ExtensionContext) {
  if (model?.provider !== MISTRAL_SUBSCRIPTION_PROVIDER_ID) return;
  ctx.ui.notify(
    `${MISTRAL_SUBSCRIPTION_PROVIDER_ID} is deprecated. Run /login, sign in to Mistral, and use mistral/${model.id}.`,
    "warning",
  );
}

export default function mistralSubscriptionExtension(pi: ExtensionAPI) {
  pi.registerProvider(MISTRAL_PROVIDER_ID, { oauth: { ...mistralOAuth, modifyModels: subscriptionModels } });

  // Without this provider, existing settings and sessions silently fall back to
  // another provider or model. It keeps them working until they move to `mistral`.
  pi.registerProvider(MISTRAL_SUBSCRIPTION_PROVIDER_ID, {
    name: "Mistral subscription (deprecated)",
    baseUrl: MISTRAL_BASE_URL,
    api: "mistral-conversations",
    authHeader: true,
    models: [...MODELS],
    oauth: { ...mistralOAuth, name: "Mistral subscription (deprecated)" },
  });

  pi.on("session_start", (_event, ctx) => warnIfDeprecated(ctx.model, ctx));
  pi.on("model_select", (event, ctx) => warnIfDeprecated(event.model, ctx));

  pi.registerCommand("mistral-subscription-status", {
    description: "Show how the Mistral subscription sign-in is wired into Pi",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `${MISTRAL_PROVIDER_ID} accepts Mistral AI Studio browser sign-in through /login and uses Pi's built-in models and streaming.`,
        "info",
      );
    },
  });
}
