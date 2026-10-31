import { isDeepStrictEqual } from "node:util";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mistralOAuth } from "../../src/mistral-oauth.ts";
import { subscriptionModels } from "../../src/mistral-overlay.ts";
import { MISTRAL_BASE_URL, MISTRAL_PROVIDER_ID, MISTRAL_SUBSCRIPTION_PROVIDER_ID, MODELS } from "../../src/models.ts";

function warnIfDeprecated(model: ExtensionContext["model"], ctx: ExtensionContext) {
  if (model?.provider !== MISTRAL_SUBSCRIPTION_PROVIDER_ID) return;
  const replacement = model.id === "devstral-small-latest" ? "devstral-latest" : model.id;
  ctx.ui.notify(
    `${MISTRAL_SUBSCRIPTION_PROVIDER_ID} is deprecated. Run /login, sign in to Mistral, and use mistral/${replacement}.`,
    "warning",
  );
}

function usesSignIn(model: ExtensionContext["model"], ctx: ExtensionContext): model is NonNullable<typeof model> {
  return model?.provider === MISTRAL_PROVIDER_ID && ctx.modelRegistry.isUsingOAuth(model);
}

// Pi can hand a session the model without the overlay: after /reload, and from
// its selectors while a catalog refresh runs. That object would stay for the session.
async function selectAdjustedModel(pi: ExtensionAPI, ctx: ExtensionContext, model: ExtensionContext["model"]) {
  if (!usesSignIn(model, ctx)) return;
  const adjusted = ctx.modelRegistry.find(MISTRAL_PROVIDER_ID, model.id);
  if (!adjusted || isDeepStrictEqual(adjusted, model)) return;
  // A model switch re-derives the level from settings, so carry the current one over.
  const level = pi.getThinkingLevel();
  await pi.setModel(adjusted);
  pi.setThinkingLevel(level);
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

  pi.on("session_start", async (event, ctx) => {
    warnIfDeprecated(ctx.model, ctx);
    if (event.reason !== "reload" || !usesSignIn(ctx.model, ctx)) return;
    await ctx.modelRegistry.refresh({ allowNetwork: false });
    await selectAdjustedModel(pi, ctx, ctx.model);
  });
  pi.on("model_select", async (event, ctx) => {
    warnIfDeprecated(event.model, ctx);
    await selectAdjustedModel(pi, ctx, event.model);
  });

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
