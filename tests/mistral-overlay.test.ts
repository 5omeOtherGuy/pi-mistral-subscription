import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Api, Model } from "@earendil-works/pi-ai";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { type ExtensionAPI, ModelRuntime } from "@earendil-works/pi-coding-agent";

import mistralSubscriptionExtension from "../extensions/mistral-subscription/index.ts";
import { subscriptionModels } from "../src/mistral-overlay.ts";

const KEY = ["placeholder", "test", "key"].join("-");

async function withRuntime<T>(
  credentials: Record<string, unknown>,
  run: (runtime: ModelRuntime) => Promise<T>,
  extended = true,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "pi-mistral-"));
  try {
    await writeFile(join(dir, "auth.json"), JSON.stringify(credentials));
    const runtime = await ModelRuntime.create({
      authPath: join(dir, "auth.json"),
      modelsPath: join(dir, "models.json"),
      catalogBaseUrl: "http://127.0.0.1:9",
    });
    if (extended) {
      mistralSubscriptionExtension({
        registerProvider: (id: string, config: Parameters<ModelRuntime["registerProvider"]>[1]) =>
          runtime.registerProvider(id, config),
        registerCommand: () => {},
        on: () => {},
      } as unknown as ExtensionAPI);
    }
    await runtime.refresh({ allowNetwork: false });
    return await run(runtime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const oauth = { type: "oauth", access: KEY, refresh: "mistral-browser-sign-in", expires: 4_102_444_800_000 };
const ids = (models: readonly Model<Api>[]) => models.map((model) => model.id);

function model(id: string, overrides: Partial<Model<Api>> = {}): Model<Api> {
  return {
    id,
    name: id,
    api: "mistral-conversations",
    provider: "mistral",
    baseUrl: "https://api.mistral.ai",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 262_144,
    ...overrides,
  } as Model<Api>;
}

test("hides models a subscription key cannot call and keeps the rest", () => {
  const models = ids(subscriptionModels([model("pixtral-large-latest"), model("mistral-medium-3.5")]));
  assert.ok(!models.includes("pixtral-large-latest"));
  assert.ok(models.includes("mistral-medium-3.5"));
});

test("adds the reasoning efforts Pi's catalog leaves out", () => {
  const [glm, deepseek] = subscriptionModels([model("zai-glm-5-2"), model("deepseek-v4-1-flash-1017")]);
  assert.ok(glm && deepseek);
  assert.deepEqual(getSupportedThinkingLevels(glm), ["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(getSupportedThinkingLevels(deepseek), ["off", "low", "high", "xhigh", "max"]);
  assert.deepEqual(deepseek.input, ["text", "image"]);
});

test("gives Large 4 the levels Mistral accepts whatever Pi's catalog says", () => {
  const [large] = subscriptionModels([model("mistral-large-4", { thinkingLevelMap: { off: "none", high: "high" } })]);
  assert.ok(large);
  assert.deepEqual(getSupportedThinkingLevels(large), ["low", "medium", "high"]);
});

test("offers GLM 5.3 and Large 4 before Pi has its online catalog", () => {
  const models = subscriptionModels([model("mistral-small-latest")]);
  assert.deepEqual(ids(models), ["mistral-small-latest", "mistral-large-4", "zai-glm-5-3", "zai-glm-5-3-flash"]);
  for (const added of models.slice(1)) {
    assert.equal(added.provider, "mistral");
    assert.equal(added.baseUrl, "https://api.mistral.ai");
  }
});

test("prefers Pi's entry over the built-in fallback", () => {
  const models = subscriptionModels([model("zai-glm-5-3-flash", { name: "From Pi" })]);
  assert.equal(models.filter((entry) => entry.id === "zai-glm-5-3-flash").length, 1);
  assert.equal(models.find((entry) => entry.id === "zai-glm-5-3-flash")?.name, "From Pi");
});

test("caps Large 4 output without raising a lower limit", () => {
  assert.equal(subscriptionModels([model("mistral-large-4")])[0]?.maxTokens, 32_768);
  assert.equal(subscriptionModels([model("mistral-large-4", { maxTokens: 1_000 })])[0]?.maxTokens, 1_000);
});

test("leaves unlisted models untouched", () => {
  const original = model("mistral-small-latest");
  assert.equal(subscriptionModels([original])[0], original);
});

test("API-key use of the built-in provider stays exactly as Pi ships it", async () => {
  const credentials = { mistral: { type: "api_key", key: KEY } };
  const plain = await withRuntime(credentials, async (runtime) => [...runtime.getModels("mistral")], false);
  const extended = await withRuntime(credentials, async (runtime) => [...runtime.getModels("mistral")]);
  assert.ok(ids(plain).includes("pixtral-large-latest"));
  assert.deepEqual(extended, plain);
});

test("a browser sign-in applies the overlay to the built-in provider", async () => {
  await withRuntime({ mistral: oauth }, async (runtime) => {
    const models = ids(runtime.getModels("mistral"));
    assert.ok(models.includes("mistral-medium-3.5"));
    assert.ok(!models.includes("pixtral-large-latest"));
    assert.equal(runtime.getModel("mistral", "mistral-large-4")?.maxTokens, 32_768);
    assert.equal(runtime.isUsingSubscription("mistral"), true);
  });
});

// Regression: removing this provider moves saved defaults and resumed sessions
// to another provider or model without telling the user.
test("the deprecated provider keeps existing logins and model names working", async () => {
  await withRuntime({ "mistral-subscription": oauth }, async (runtime) => {
    const models = ids(runtime.getModels("mistral-subscription"));
    assert.ok(models.includes("zai-glm-5-3"));
    assert.ok(models.includes("mistral-medium-latest"), "was only offered by the removed catalog refresh");
    assert.ok((await runtime.getAvailable("mistral-subscription")).length > 0);
    assert.equal(runtime.isUsingSubscription("mistral-subscription"), true);
  });
});

type Handler = (event: unknown, ctx: unknown) => Promise<void> | void;

function startHandler(setModel: (model: unknown) => Promise<boolean>): Handler {
  const handlers = new Map<string, Handler>();
  mistralSubscriptionExtension({
    registerProvider: () => {},
    registerCommand: () => {},
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    setModel,
  } as unknown as ExtensionAPI);
  const handler = handlers.get("session_start");
  assert.ok(handler);
  return handler;
}

function sessionContext(usingOAuth: boolean, provider = "mistral") {
  const adjusted = { provider, id: "mistral-large-4", maxTokens: 32_768 };
  return {
    adjusted,
    ctx: {
      model: { provider, id: "mistral-large-4", maxTokens: 262_144 },
      ui: { notify: () => {} },
      modelRegistry: {
        isUsingOAuth: () => usingOAuth,
        refresh: async () => ({ aborted: false, errors: new Map() }),
        find: () => adjusted,
      },
    },
  };
}

test("/reload puts a signed-in session back on the adjusted model", async () => {
  const selected: unknown[] = [];
  const { adjusted, ctx } = sessionContext(true);
  await startHandler(async (model) => selected.push(model) > 0)({ reason: "reload" }, ctx);
  assert.deepEqual(selected, [adjusted]);
});

test("only /reload with a sign-in on mistral changes the session model", async () => {
  const selected: unknown[] = [];
  const handler = startHandler(async (model) => selected.push(model) > 0);
  await handler({ reason: "startup" }, sessionContext(true).ctx);
  await handler({ reason: "reload" }, sessionContext(false).ctx);
  await handler({ reason: "reload" }, sessionContext(true, "zai").ctx);
  assert.deepEqual(selected, []);
});
