import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OAuthLoginCallbacks } from "@earendil-works/pi-ai";

import { createMistralOAuth, type FetchLike } from "../src/mistral-oauth.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function callbacks(): OAuthLoginCallbacks & { authUrls: string[]; progress: string[] } {
  const authUrls: string[] = [];
  const progress: string[] = [];
  return {
    authUrls,
    progress,
    onAuth: (info) => authUrls.push(info.url),
    onDeviceCode: () => {},
    onPrompt: async () => "",
    onProgress: (message) => progress.push(message),
    onSelect: async () => undefined,
  };
}

describe("Mistral OAuth", () => {
  it("exchanges a completed browser sign-in for stored credentials", async () => {
    const requests: { url: string; body?: unknown }[] = [];
    let pollCount = 0;
    const fetch: FetchLike = async (url, init) => {
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith("/vibe/sign-in")) {
        return jsonResponse({
          process_id: "process-1",
          sign_in_url: "https://console.mistral.ai/sign-in/process-1",
          poll_url: "https://console.mistral.ai/api/vibe/sign-in/process-1",
          expires_at: "2035-01-01T00:00:00Z",
        });
      }
      if (url === "https://console.mistral.ai/api/vibe/sign-in/process-1") {
        pollCount += 1;
        return jsonResponse(pollCount === 1 ? { status: "pending" } : { status: "completed", exchange_token: "exchange-1" });
      }
      if (url.endsWith("/vibe/sign-in/process-1/exchange")) {
        return jsonResponse({ api_key: "mistral-api-key" });
      }
      throw new Error(`unexpected url ${url}`);
    };

    const oauth = createMistralOAuth({ fetch, sleep: async () => {}, now: () => 1_700_000_000_000 });
    const cb = callbacks();
    const credentials = await oauth.login(cb);

    assert.equal(credentials.access, "mistral-api-key");
    assert.equal(credentials.refresh, "mistral-browser-sign-in");
    assert.equal(credentials.expires, 2_015_360_000_000);
    assert.deepEqual(cb.authUrls, ["https://console.mistral.ai/sign-in/process-1"]);
    const startBody = requests[0]?.body;
    assert.equal(typeof startBody, "object");
    assert.notEqual(startBody, null);
    assert.equal((startBody as Record<string, unknown>).code_challenge_method, "S256");
    const exchangeBody = requests.at(-1)?.body;
    assert.equal(typeof exchangeBody, "object");
    assert.notEqual(exchangeBody, null);
    assert.equal((exchangeBody as Record<string, unknown>).exchange_token, "exchange-1");
    assert.equal(typeof (exchangeBody as Record<string, unknown>).code_verifier, "string");
  });

  it("rejects sign-in URLs outside Mistral AI Studio", async () => {
    const fetch: FetchLike = async () => jsonResponse({
      process_id: "process-1",
      sign_in_url: "https://evil.example/sign-in/process-1",
      poll_url: "https://console.mistral.ai/api/vibe/sign-in/process-1",
      expires_at: "2035-01-01T00:00:00Z",
    });

    const oauth = createMistralOAuth({ fetch });
    await assert.rejects(() => oauth.login(callbacks()), /unexpected URL/);
  });
});
