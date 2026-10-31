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
  assert.deepEqual(ids(subscriptionModels([model("pixtral-large-latest"), model("mistral-medium-3.5")])), [
    "mistral-medium-3.5",
  ]);
});

test("adds the reasoning efforts Pi's catalog leaves out", () => {
  const [glm, deepseek] = subscriptionModels([model("zai-glm-5-2"), model("deepseek-v4-1-flash-1017")]);
  assert.ok(glm && deepseek);
  assert.deepEqual(getSupportedThinkingLevels(glm), ["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(getSupportedThinkingLevels(deepseek), ["off", "low", "high", "xhigh", "max"]);
  assert.deepEqual(deepseek.input, ["text", "image"]);
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
  const plain = await withRuntime(credentials, async (runtime) => ids(runtime.getModels("mistral")), false);
  const extended = await withRuntime(credentials, async (runtime) => ids(runtime.getModels("mistral")));
  assert.ok(plain.includes("pixtral-large-latest"));
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
