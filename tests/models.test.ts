import assert from "node:assert/strict";
import { test } from "node:test";

import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { MISTRAL_API_ID, MISTRAL_BASE_URL, MISTRAL_SUBSCRIPTION_PROVIDER_ID, MODELS } from "../src/models.ts";

test("model ids are unique", () => {
  const ids = MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every model is well-formed", () => {
  for (const model of MODELS) {
    assert.equal(model.api, MISTRAL_API_ID, model.id);
    assert.match(model.name, /\(Mistral subscription\)$/, model.id);
    assert.ok(model.contextWindow > 0, model.id);
    assert.ok(model.maxTokens > 0 && model.maxTokens <= model.contextWindow, model.id);
    assert.ok(model.input.includes("text"), model.id);
  }
});

test("reasoning models declare native reasoning_effort mappings", () => {
  for (const model of MODELS) {
    if (model.reasoning) {
      assert.ok(model.thinkingLevelMap, model.id);
    } else {
      assert.equal(model.thinkingLevelMap, undefined, model.id);
    }
  }
});

test("fallback prices match Mistral's published API pricing", () => {
  // Source: https://docs.mistral.ai/inference/pricing (retrieved 2026-10-31):
  // the page's Input / Cached input / Output columns, USD per million tokens.
  // It publishes no cache-write rate, so cacheWrite mirrors the input price.
  const priced: Record<string, [input: number, cachedInput: number, output: number]> = {
    "mistral-small-latest": [0.15, 0.015, 0.6],
    "mistral-large-4": [0.7, 0.07, 2.1],
    "ministral-14b-2512": [0.2, 0.02, 0.2],
    "ministral-8b-2512": [0.15, 0.015, 0.15],
    "ministral-3b-2512": [0.1, 0.01, 0.1],
    "zai-glm-5-3": [1.4, 0.14, 4.4],
    "zai-glm-5-3-flash": [0.15, 0.03, 0.5],
    "deepseek-v4-1-flash-1017": [0.3, 0.007, 1.2],
  };
  for (const [id, [input, cachedInput, output]] of Object.entries(priced)) {
    const model = MODELS.find((entry) => entry.id === id);
    assert.ok(model, `${id} is registered`);
    assert.deepEqual(model.cost, { input, output, cacheRead: cachedInput, cacheWrite: input }, id);
  }
  // Not sold on the public API: Medium 3.5 (absent from the pricing page, no
  // price on its model card), Large 3 (deprecated) and Devstral Small (legacy,
  // only Devstral 2 is priced). Their usage is logged as tokens without a price.
  for (const id of ["mistral-medium-3.5", "mistral-large-latest", "devstral-small-latest"]) {
    const model = MODELS.find((entry) => entry.id === id);
    assert.ok(model, `${id} is registered`);
    assert.deepEqual(model.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, id);
  }
});

test("Z.ai GLM 5.3 models match Mistral's hosted catalog", () => {
  // Sources: `/v1/model-catalog?surface=vibe-code` (labels "GLM 5.3 (Mistral Hosted)" /
  // "GLM 5.3 Flash (Mistral Hosted)", max_context_length 1048576, reasoning low/high/max,
  // vision false/true) and `GET /v1/models` ("Official Z.ai GLM 5.3 model", "GLM 5.3 Flash
  // with a 1M context limit"). Neither publishes an output limit: conservative local cap.
  const glm = MODELS.find((model) => model.id === "zai-glm-5-3");
  assert.ok(glm, "GLM 5.3 is registered");
  assert.equal(glm.name, "GLM 5.3 (Mistral subscription)");
  assert.equal(glm.contextWindow, 1_048_576);
  assert.equal(glm.maxTokens, 32_768);
  assert.deepEqual(glm.input, ["text"], "GLM 5.3 has no vision");
  assert.equal(glm.reasoning, true);
  assert.equal(glm.thinkingLevelMap?.high, "high");
  assert.equal(glm.thinkingLevelMap?.off, null, 'no "none" effort exists, so off cannot disable reasoning');

  const flash = MODELS.find((model) => model.id === "zai-glm-5-3-flash");
  assert.ok(flash, "GLM 5.3 Flash is registered");
  assert.equal(flash.name, "GLM 5.3 Flash (Mistral subscription)");
  assert.equal(flash.contextWindow, 1_048_576);
  assert.equal(flash.maxTokens, 32_768);
  assert.deepEqual(flash.input, ["text", "image"], "GLM 5.3 Flash has vision");
  assert.equal(flash.reasoning, true);
  assert.equal(flash.thinkingLevelMap?.high, "high");
  assert.equal(flash.thinkingLevelMap?.off, null);
});

test("DeepSeek V4.1 Flash 1017 matches Mistral's hosted listing and live probe", () => {
  // Sources: `GET /v1/models` ("DeepSeek V4.1 Flash 1017 with a 1M context limit",
  // vision, reasoning) and a live chat call per effort: reasoning_effort "none"
  // answers plainly, low/high/max are accepted and emit a thinking block. No
  // published output limit: conservative local cap.
  const deepseek = MODELS.find((model) => model.id === "deepseek-v4-1-flash-1017");
  assert.ok(deepseek, "DeepSeek V4.1 Flash 1017 is registered");
  assert.equal(deepseek.name, "DeepSeek V4.1 Flash 1017 (Mistral subscription)");
  assert.equal(deepseek.contextWindow, 1_048_576);
  assert.equal(deepseek.maxTokens, 32_768);
  assert.deepEqual(deepseek.input, ["text", "image"]);
  assert.equal(deepseek.reasoning, true);
  assert.equal(deepseek.thinkingLevelMap?.high, "high");
  assert.equal(deepseek.thinkingLevelMap?.off, "none", "off explicitly requests no reasoning trace");
  assert.deepEqual(
    getSupportedThinkingLevels({
      ...deepseek,
      api: MISTRAL_API_ID,
      provider: MISTRAL_SUBSCRIPTION_PROVIDER_ID,
      baseUrl: MISTRAL_BASE_URL,
      compat: undefined,
    }),
    ["off", "high"],
  );
});

test("Large 4 preview supports images and both available reasoning modes", () => {
  const model = MODELS.find((model) => model.id === "mistral-large-4");
  assert.ok(model, "Large 4 preview is registered");
  assert.equal(model.name, "Mistral Large 4 Preview (Mistral subscription)");
  assert.equal(model.contextWindow, 1_000_000);
  assert.equal(model.maxTokens, 32_768);
  assert.deepEqual(model.input, ["text", "image"]);
  assert.equal(model.reasoning, true);
  assert.equal(model.thinkingLevelMap?.high, "high");
  assert.equal(model.thinkingLevelMap?.off, "none", "off explicitly requests no reasoning trace");
  assert.deepEqual(
    getSupportedThinkingLevels({
      ...model,
      api: MISTRAL_API_ID,
      provider: MISTRAL_SUBSCRIPTION_PROVIDER_ID,
      baseUrl: MISTRAL_BASE_URL,
      compat: undefined,
    }),
    ["off", "high"],
  );
});
