import assert from "node:assert/strict";
import { test } from "node:test";

import { MISTRAL_API_ID, MODELS } from "../src/models.ts";

// Reasoning ids pi-ai's mistral-conversations provider sends `reasoning_effort` for.
// Other reasoning models fall back to `prompt_mode: "reasoning"`, which the current
// Mistral lineup does not use. Large 4 is handled by our fixed-high adapter,
// whose wire requests are covered in mistral-stream.test.ts.
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

test("reasoning models use native reasoning_effort ids or the Large 4 adapter", () => {
  for (const model of MODELS) {
    if (model.reasoning) {
      assert.ok(REASONING_EFFORT_IDS.has(model.id) || model.id === "mistral-large-4", `${model.id} has no reasoning_effort support`);
      assert.ok(model.thinkingLevelMap, model.id);
    } else {
      assert.equal(model.thinkingLevelMap, undefined, model.id);
    }
  }
});

test("Large 4 preview supports images with fixed high reasoning", () => {
  const model = MODELS.find((model) => model.id === "mistral-large-4");
  assert.ok(model, "Large 4 preview is registered");
  assert.equal(model.name, "Mistral Large 4 Preview (Mistral subscription)");
  assert.equal(model.contextWindow, 1_000_000);
  assert.equal(model.maxTokens, 32_768);
  assert.deepEqual(model.input, ["text", "image"]);
  assert.equal(model.reasoning, true);
  assert.equal(model.thinkingLevelMap?.high, "high");
});
