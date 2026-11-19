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

const PROCESS_URL = "https://console.mistral.ai/api/vibe/sign-in/process-1";

function startResponse(): Response {
  return jsonResponse({
    process_id: "process-1",
    sign_in_url: "https://console.mistral.ai/sign-in/process-1",
    poll_url: PROCESS_URL,
    expires_at: "2035-01-01T00:00:00Z",
  });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function callbacks(signal?: AbortSignal): OAuthLoginCallbacks & { authUrls: string[]; progress: string[] } {
  const authUrls: string[] = [];
  const progress: string[] = [];
  return {
    signal,
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
      if (url.endsWith("/vibe/sign-in")) return startResponse();
      if (url === PROCESS_URL) {
        pollCount += 1;
        return jsonResponse(
          pollCount === 1 ? { status: "pending" } : { status: "completed", exchange_token: "exchange-1" },
        );
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
    const fetch: FetchLike = async () =>
      jsonResponse({
        process_id: "process-1",
        sign_in_url: "https://evil.example/sign-in/process-1",
        poll_url: "https://console.mistral.ai/api/vibe/sign-in/process-1",
        expires_at: "2035-01-01T00:00:00Z",
      });

    const oauth = createMistralOAuth({ fetch });
    await assert.rejects(() => oauth.login(callbacks()), /unexpected URL/);
  });

  for (const { body, httpStatus, message } of [
    { body: { status: "completed" }, message: /completed without an exchange token/ },
    { body: { status: "completed", exchange_token: "" }, message: /completed without an exchange token/ },
    { body: { status: "completed", exchange_token: 42 }, message: /completed without an exchange token/ },
    { body: { status: "unknown" }, message: /returned an unknown state/ },
    { body: { status: "denied" }, message: /sign-in was denied/ },
    { body: { status: "error", message: "Browser sign-in failed" }, message: /Browser sign-in failed/ },
    { body: null, httpStatus: 410, message: /sign-in expired/ },
  ]) {
    it(`rejects poll response ${JSON.stringify(body)} without exchanging a token`, async () => {
      const fetch: FetchLike = async (url) => {
        if (url.endsWith("/vibe/sign-in")) return startResponse();
        if (url === PROCESS_URL) return jsonResponse(body, { status: httpStatus });
        assert.fail(`unexpected url ${url}`);
      };

      await assert.rejects(() => createMistralOAuth({ fetch }).login(callbacks()), message);
    });
  }

  it("stops polling when the sign-in expires", async () => {
    const expiresAt = Date.parse("2035-01-01T00:00:00Z");
    let now = expiresAt - 1;
    const fetch: FetchLike = async (url) => {
      if (url.endsWith("/vibe/sign-in")) return startResponse();
      assert.equal(url, PROCESS_URL);
      assert.equal(now, expiresAt - 1);
      return jsonResponse({ status: "pending" });
    };
    const oauth = createMistralOAuth({
      fetch,
      now: () => now,
      sleep: async (delay) => {
        assert.equal(delay, 1);
        now += delay;
      },
    });

    await assert.rejects(() => oauth.login(callbacks()), /sign-in timed out/);
  });

  describe("cancellation", () => {
    const cancelled = /Mistral browser sign-in was cancelled/;

    it("does not start a sign-in when the signal is already aborted", async () => {
      const requests: string[] = [];
      const fetch: FetchLike = async (url) => {
        requests.push(url);
        return startResponse();
      };
      const controller = new AbortController();
      controller.abort();

      const cb = callbacks(controller.signal);
      await assert.rejects(() => createMistralOAuth({ fetch }).login(cb), cancelled);
      assert.deepEqual(requests, []);
      assert.deepEqual(cb.authUrls, []);
    });

    it("does not exchange when cancelled while a poll is in flight", async () => {
      const controller = new AbortController();
      const pollResponse = deferred<Response>();
      const requests: string[] = [];
      const signals: (AbortSignal | null | undefined)[] = [];
      const fetch: FetchLike = async (url, init) => {
        requests.push(url);
        signals.push(init?.signal);
        if (url.endsWith("/vibe/sign-in")) return startResponse();
        if (url === PROCESS_URL) {
          controller.abort();
          return pollResponse.promise;
        }
        return jsonResponse({ api_key: "mistral-api-key" });
      };

      const login = createMistralOAuth({ fetch, sleep: async () => {} }).login(callbacks(controller.signal));
      await assert.rejects(() => login, cancelled);
      pollResponse.resolve(jsonResponse({ status: "completed", exchange_token: "exchange-1" }));
      await new Promise((resolve) => setImmediate(resolve));

      assert.deepEqual(requests, ["https://console.mistral.ai/api/vibe/sign-in", PROCESS_URL]);
      assert.ok(signals.every((signal) => signal === controller.signal));
    });

    it("stops waiting between polls when cancelled during a sleep that ignores the signal", async () => {
      const controller = new AbortController();
      let polls = 0;
      const fetch: FetchLike = async (url) => {
        if (url.endsWith("/vibe/sign-in")) return startResponse();
        if (url === PROCESS_URL) {
          polls += 1;
          return jsonResponse({ status: "pending" });
        }
        throw new Error(`unexpected url ${url}`);
      };
      const sleepSignals: (AbortSignal | undefined)[] = [];
      const sleep = (_milliseconds: number, signal?: AbortSignal) => {
        sleepSignals.push(signal);
        controller.abort();
        return new Promise<void>(() => {});
      };

      await assert.rejects(() => createMistralOAuth({ fetch, sleep }).login(callbacks(controller.signal)), cancelled);
      assert.equal(polls, 1);
      assert.deepEqual(sleepSignals, [controller.signal]);
    });

    it("rejects a cancelled exchange even when fetch ignores the signal", async () => {
      const controller = new AbortController();
      const exchangeResponse = deferred<Response>();
      let exchangeSignal: AbortSignal | null | undefined;
      const fetch: FetchLike = async (url, init) => {
        if (url.endsWith("/vibe/sign-in")) return startResponse();
        if (url === PROCESS_URL) return jsonResponse({ status: "completed", exchange_token: "exchange-1" });
        exchangeSignal = init?.signal;
        controller.abort();
        return exchangeResponse.promise;
      };

      const login = createMistralOAuth({ fetch }).login(callbacks(controller.signal));
      await assert.rejects(() => login, cancelled);
      exchangeResponse.resolve(jsonResponse({ api_key: "mistral-api-key" }));
      assert.equal(exchangeSignal, controller.signal);
    });

    it("reports cancellation when an aborted fetch rejects", async () => {
      const controller = new AbortController();
      const fetch: FetchLike = async (url, init) => {
        if (url.endsWith("/vibe/sign-in")) return startResponse();
        controller.abort();
        throw init?.signal?.reason ?? new Error("aborted");
      };

      await assert.rejects(() => createMistralOAuth({ fetch }).login(callbacks(controller.signal)), cancelled);
    });
  });
});
