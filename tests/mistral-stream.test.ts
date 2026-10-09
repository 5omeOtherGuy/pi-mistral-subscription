import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { normalizeContext, type Model, type SimpleStreamOptions } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/api/mistral-conversations";
import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";

import mistralSubscriptionExtension from "../extensions/mistral-subscription/index.ts";
import { MISTRAL_SUBSCRIPTION_PROVIDER_ID, MODELS } from "../src/models.ts";

async function requestPayload(
  id: string,
  options?: SimpleStreamOptions,
): Promise<Record<string, unknown>> {
  let payload: Record<string, unknown> | undefined;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    payload = JSON.parse(body);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end('data: {"id":"test","object":"chat.completion.chunk","created":0,"model":"test","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const config = MODELS.find((model) => model.id === id);
    assert.ok(config, `${id} is registered`);
    const model: Model<"mistral-conversations"> = {
      ...config,
      api: "mistral-conversations",
      compat: undefined,
      id,
      provider: MISTRAL_SUBSCRIPTION_PROVIDER_ID,
      baseUrl: `http://127.0.0.1:${address.port}`,
    };
    // Pi 0.99+ passes a normalized transcript, including string-valued system
    // messages. Passing this to the old provider caused content.filter errors.
    const context = normalizeContext({
      systemPrompt: "You are running a connectivity test.",
      messages: [{ role: "user", content: "Hello", timestamp: 0 }],
    });
    const result = await streamSimple(model, context, {
      apiKey: "placeholder-test-key", ...options,
    }).result();
    assert.equal(result.stopReason, "stop", result.errorMessage);
    assert.ok(payload, "request reached the local test server");
    return payload;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

for (const [reasoning, effort] of [[undefined, "none"], ["high", "high"]] as const) {
  test(`Large 4 sends ${effort} reasoning with thinking ${reasoning ?? "off"}`, async () => {
    const payload = await requestPayload("mistral-large-4", { reasoning });
    assert.equal(payload.model, "mistral-large-4");
    assert.equal(payload.reasoning_effort, effort);
    assert.equal(payload.prompt_mode, undefined);
  });
}

test("Large 4 preserves request options and async payload hooks", async () => {
  let hookCalled = false;
  const payload = await requestPayload("mistral-large-4", {
    reasoning: "high",
    maxTokens: 512,
    temperature: 0.2,
    onPayload: async (value, model) => {
      hookCalled = true;
      assert.equal(model.id, "mistral-large-4");
      const original = value as Record<string, unknown>;
      assert.equal(original.reasoningEffort, "high");
      assert.equal(original.promptMode, undefined);
      return { ...original, temperature: 0.3 };
    },
  });
  assert.ok(hookCalled);
  assert.equal(payload.max_tokens, 512);
  assert.equal(payload.temperature, 0.3);
  assert.equal(payload.reasoning_effort, "high");
  assert.equal(payload.prompt_mode, undefined);
});

test("existing subscription models retain their reasoning behavior", async () => {
  const medium = await requestPayload("mistral-medium-3.5", { reasoning: "low" });
  assert.equal(medium.reasoning_effort, "none");
  const large = await requestPayload("mistral-large-latest");
  assert.equal(large.reasoning_effort, undefined);
  assert.equal(large.prompt_mode, undefined);
});

test("extension delegates to Pi's native streaming implementation", () => {
  let registration: ProviderConfig | undefined;
  mistralSubscriptionExtension({
    registerProvider: (id: string, config: ProviderConfig) => {
      assert.equal(id, MISTRAL_SUBSCRIPTION_PROVIDER_ID);
      registration = config;
    },
    registerCommand: () => {},
  } as unknown as ExtensionAPI);
  assert.ok(registration);
  assert.equal(registration.api, "mistral-conversations");
  assert.equal(registration.streamSimple, undefined);
  assert.ok(registration.models?.some((model) => model.id === "mistral-large-4"));
});
