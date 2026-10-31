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
