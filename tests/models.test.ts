import assert from "node:assert/strict";
import { test } from "node:test";

import { MISTRAL_API_ID, MODELS } from "../src/models.ts";

// Reasoning ids pi-ai's mistral-conversations provider sends `reasoning_effort` for.
// Other reasoning models fall back to `prompt_mode: "reasoning"`, which the current
// Mistral lineup does not use, so new reasoning models must be one of these ids.
const REASONING_EFFORT_IDS = new Set(["mistral-medium-3.5", "mistral-small-latest", "mistral-small-2603"]);

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

test("reasoning models use ids that support reasoning_effort", () => {
  for (const model of MODELS) {
    if (model.reasoning) {
      assert.ok(REASONING_EFFORT_IDS.has(model.id), `${model.id} is not a known reasoning_effort id`);
      assert.ok(model.thinkingLevelMap, model.id);
    } else {
      assert.equal(model.thinkingLevelMap, undefined, model.id);
    }
  }
});
