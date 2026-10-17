import assert from "node:assert/strict";
import { test } from "node:test";

import type { RefreshModelsContext } from "@earendil-works/pi-ai";

import { createModelCatalog, MODEL_CATALOG_URL } from "../src/model-catalog.ts";
import { MODELS } from "../src/models.ts";

function context(overrides: Partial<RefreshModelsContext> = {}): RefreshModelsContext {
  return {
    credential: { type: "oauth", access: "test-secret", refresh: "test", expires: Date.now() + 60_000 },
    allowNetwork: true,
    signal: new AbortController().signal,
    publish: async () => true,
    ...overrides,
  };
}

function response(models: unknown[]): Response {
  return new Response(JSON.stringify({ models }), { status: 200 });
}

test("fetches Vibe's subscription catalog with the active credential and maps capabilities", async () => {
  let calls = 0;
  const refresh = createModelCatalog(async (url, init) => {
    calls++;
    assert.equal(url, MODEL_CATALOG_URL);
    assert.equal(init?.headers && new Headers(init.headers).get("Authorization"), "Bearer test-secret");
    assert.ok(init?.signal);
    return response([
      { id: "new-model", label: "New Model", max_context_length: 100_000,
        capabilities: { completion_chat: true, function_calling: true, vision: true },
        parameters: { reasoning: ["none", "high"] } },
      { id: "new-model", label: "Duplicate", max_context_length: 100_000,
        capabilities: { completion_chat: true, function_calling: true } },
      { id: "embedding", label: "Embedding", max_context_length: 8192,
        capabilities: { completion_chat: false, function_calling: false } },
    ]);
  });
  const models = await refresh(context());
  assert.equal(calls, 1);
  assert.equal(models.length, 1);
  assert.deepEqual(models[0], {
    id: "new-model", api: "mistral-conversations", name: "New Model (Mistral subscription)",
    reasoning: true,
    thinkingLevelMap: { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: null, max: null },
    input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 100_000, maxTokens: 32_768,
  });
});

test("uses known model output limit and omits unsupported vision and reasoning", async () => {
  const refresh = createModelCatalog(async () => response([
    { id: "mistral-medium-3.5", label: "Medium", max_context_length: 16_000,
      capabilities: { completion_chat: true, function_calling: true, vision: false },
      parameters: { reasoning: [] } },
    { id: "invalid", label: "Invalid", max_context_length: "large",
      capabilities: { completion_chat: true, function_calling: true } },
  ]));
  const models = await refresh(context());
  assert.equal(models.length, 1);
  assert.equal(models[0]?.maxTokens, 16_000);
  assert.deepEqual(models[0]?.input, ["text"]);
  assert.equal(models[0]?.reasoning, false);
});

test("falls back when offline, unauthenticated, failed, or malformed", async () => {
  let calls = 0;
  const refresh = createModelCatalog(async () => { calls++; throw new Error("network down"); });
  assert.deepEqual(await refresh(context({ allowNetwork: false })), [...MODELS]);
  assert.deepEqual(await refresh(context({ credential: undefined })), [...MODELS]);
  assert.equal(calls, 0);
  assert.deepEqual(await refresh(context()), [...MODELS]);
  assert.equal(calls, 1);
  for (const result of [new Response("unauthorized", { status: 401 }), new Response("oops"), response([]), response([{ id: "bad" }])]) {
    assert.deepEqual(await createModelCatalog(async () => result)(context()), [...MODELS]);
  }
});
