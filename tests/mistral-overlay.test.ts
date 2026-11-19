import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Api, Model } from "@earendil-works/pi-ai";
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

function model(id: string): Model<Api> {
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
  } as Model<Api>;
}

test("removes the hidden IDs and preserves the entries Pi provided", () => {
  const visible = [model("mistral-large-4"), model("zai-glm-5-2"), model("deepseek-v4-1-flash-1017")];
  const models = subscriptionModels([model("pixtral-large-latest"), ...visible, model("labs-leanstral-1-5-1")]);

  assert.deepEqual(models, visible);
  for (const [index, original] of visible.entries()) {
    assert.equal(models[index], original);
  }
});

test("does not add models that Pi's catalog omits", () => {
  const original = model("mistral-small-latest");
  assert.deepEqual(subscriptionModels([original]), [original]);
  assert.deepEqual(subscriptionModels([]), []);
});

test("API-key use of the built-in provider stays exactly as Pi ships it", async () => {
  const credentials = { mistral: { type: "api_key", key: KEY } };
  const plain = await withRuntime(credentials, async (runtime) => [...runtime.getModels("mistral")], false);
  const extended = await withRuntime(credentials, async (runtime) => [...runtime.getModels("mistral")]);
  assert.ok(plain.length > 0);
  assert.deepEqual(extended, plain);
});

test("a browser sign-in filters Pi's catalog without changing visible model metadata", async () => {
  const plain = await withRuntime({ mistral: { type: "api_key", key: KEY } }, async (runtime) => [
    ...runtime.getModels("mistral"),
  ]);

  await withRuntime({ mistral: oauth }, async (runtime) => {
    const signedIn = runtime.getModels("mistral");
    assert.ok(signedIn.length > 0);
    assert.deepEqual(signedIn, subscriptionModels(plain));
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
