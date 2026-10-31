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

test("Large 4 supports images and the three documented reasoning efforts", () => {
  const model = MODELS.find((model) => model.id === "mistral-large-4");
  assert.ok(model, "Large 4 preview is registered");
  assert.equal(model.name, "Mistral Large 4 Preview (Mistral subscription)");
  assert.equal(model.contextWindow, 1_000_000);
  assert.equal(model.maxTokens, 32_768);
  assert.deepEqual(model.input, ["text", "image"]);
  assert.equal(model.reasoning, true);
  assert.equal(model.thinkingLevelMap?.high, "high");
  assert.equal(model.thinkingLevelMap?.off, null, "Mistral rejects none for Large 4");
  assert.deepEqual(
    getSupportedThinkingLevels({
      ...model,
      api: MISTRAL_API_ID,
      provider: MISTRAL_SUBSCRIPTION_PROVIDER_ID,
      baseUrl: MISTRAL_BASE_URL,
      compat: undefined,
    }),
    ["low", "medium", "high"],
  );
});

test("Medium and Small offer exactly the efforts Mistral accepts", () => {
  for (const id of ["mistral-medium-3.5", "mistral-small-latest"]) {
    const model = MODELS.find((model) => model.id === id);
    assert.ok(model, id);
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
  }
});

test("GLM 5.3 models offer the reasoning efforts Mistral documents", () => {
  for (const [id, input] of [
    ["zai-glm-5-3", ["text"]],
    ["zai-glm-5-3-flash", ["text", "image"]],
  ] as const) {
    const model = MODELS.find((model) => model.id === id);
    assert.ok(model, id);
    assert.equal(model.contextWindow, 1_048_576);
    assert.deepEqual(model.input, input);
    assert.deepEqual(
      getSupportedThinkingLevels({
        ...model,
        api: MISTRAL_API_ID,
        provider: MISTRAL_SUBSCRIPTION_PROVIDER_ID,
        baseUrl: MISTRAL_BASE_URL,
        compat: undefined,
      }),
      ["low", "high", "max"],
    );
  }
});
