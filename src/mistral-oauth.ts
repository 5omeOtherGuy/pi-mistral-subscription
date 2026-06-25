import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";

import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

import { isRecord } from "./type-guards.ts";

const BROWSER_AUTH_BASE_URL = "https://console.mistral.ai";
const BROWSER_AUTH_API_BASE_URL = "https://console.mistral.ai/api";
const SIGN_IN_PATH = "/vibe/sign-in";
const API_KEY_EXPIRES_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_SECONDS = 3;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (milliseconds: number) => Promise<void>;
export type Now = () => number;

export type MistralOAuthDependencies = {
  fetch?: FetchLike;
  sleep?: Sleep;
  now?: Now;
  randomBytes?: (size: number) => Buffer;
};

type SignInProcess = {
  processId: string;
  signInUrl: string;
  pollUrl: string;
  expiresAt: number;
};

type PollResult = {
  status: "pending" | "completed" | "expired" | "denied" | "error";
  exchangeToken?: string;
  message?: string;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function createCodeVerifier(dependencies: MistralOAuthDependencies): string {
  return base64Url((dependencies.randomBytes ?? randomBytes)(64));
}

function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

async function responseJson(response: Response, message: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${message} HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${message} response was malformed`, { cause: error });
  }
}

function stringField(record: Record<string, unknown>, field: string, message: string): string {
  const value = record[field];
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`${message} response was missing ${field}`);
}

function optionalStringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateUrlAgainstBaseUrl(value: string, baseUrl: string, message: string): string {
  const current = new URL(value);
  const base = new URL(baseUrl);
  if (current.origin !== base.origin || !current.pathname.startsWith(base.pathname.replace(/\/$/, ""))) {
    throw new Error(`${message} returned an unexpected URL`);
  }
  return value;
}

async function createProcess(fetch: FetchLike, codeChallenge: string): Promise<SignInProcess> {
  const message = "Failed to start Mistral browser sign-in";
  const response = await fetch(`${BROWSER_AUTH_API_BASE_URL}${SIGN_IN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code_challenge: codeChallenge, code_challenge_method: "S256" }),
  });
  const payload = await responseJson(response, message);
  if (!isRecord(payload)) throw new Error(`${message} response was malformed`);

  const signInUrl = stringField(payload, "sign_in_url", message);
  const pollUrl = stringField(payload, "poll_url", message);
  const expiresAt = Date.parse(stringField(payload, "expires_at", message));
  if (!Number.isFinite(expiresAt)) throw new Error(`${message} response had an invalid expires_at`);

  return {
    processId: stringField(payload, "process_id", message),
    signInUrl: validateUrlAgainstBaseUrl(signInUrl, BROWSER_AUTH_BASE_URL, message),
    pollUrl: validateUrlAgainstBaseUrl(pollUrl, BROWSER_AUTH_API_BASE_URL, message),
    expiresAt,
  };
}

async function poll(fetch: FetchLike, pollUrl: string): Promise<PollResult> {
  const message = "Mistral browser sign-in status could not be retrieved";
  const response = await fetch(validateUrlAgainstBaseUrl(pollUrl, BROWSER_AUTH_API_BASE_URL, message));
  if (response.status === 410) return { status: "expired" };
  const payload = await responseJson(response, message);
  if (!isRecord(payload)) throw new Error(`${message} response was malformed`);
  const status = payload.status;
  if (status !== "pending" && status !== "completed" && status !== "expired" && status !== "denied" && status !== "error") {
    throw new Error("Mistral browser sign-in returned an unknown state");
  }
  return { status, exchangeToken: optionalStringField(payload, "exchange_token"), message: optionalStringField(payload, "message") };
}

async function waitForCompletion(
  fetch: FetchLike,
  attempt: SignInProcess,
  callbacks: OAuthLoginCallbacks,
  sleep: Sleep,
  now: Now,
): Promise<string> {
  while (now() < attempt.expiresAt) {
    if (callbacks.signal?.aborted) throw new Error("Mistral browser sign-in was cancelled");
    const result = await poll(fetch, attempt.pollUrl);
    switch (result.status) {
      case "pending":
        await sleep(Math.min(DEFAULT_POLL_INTERVAL_SECONDS * 1000, Math.max(0, attempt.expiresAt - now())));
        break;
      case "completed":
        if (result.exchangeToken) return result.exchangeToken;
        throw new Error("Mistral browser sign-in completed without an exchange token");
      case "expired":
        throw new Error("Mistral browser sign-in expired");
      case "denied":
        throw new Error("Mistral browser sign-in was denied");
      case "error":
        throw new Error(result.message ?? "Mistral browser sign-in failed");
    }
  }
  throw new Error("Mistral browser sign-in timed out");
}

async function exchange(fetch: FetchLike, processId: string, exchangeToken: string, codeVerifier: string): Promise<string> {
  const message = "Failed to exchange Mistral browser sign-in for an API key";
  const response = await fetch(`${BROWSER_AUTH_API_BASE_URL}${SIGN_IN_PATH}/${processId}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exchange_token: exchangeToken, code_verifier: codeVerifier }),
  });
  const payload = await responseJson(response, message);
  if (!isRecord(payload)) throw new Error(`${message} response was malformed`);
  return stringField(payload, "api_key", message);
}

export function createMistralOAuth(dependencies: MistralOAuthDependencies = {}) {
  const fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep = dependencies.sleep ?? defaultSleep;
  const now = dependencies.now ?? Date.now;

  return {
    name: "Mistral subscription (Mistral AI Studio)",
    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      const codeVerifier = createCodeVerifier(dependencies);
      const attempt = await createProcess(fetch, createCodeChallenge(codeVerifier));
      callbacks.onAuth({
        url: attempt.signInUrl,
        instructions: "Sign in with your Mistral Pro or higher account, then return to Pi.",
      });
      callbacks.onProgress?.("Waiting for Mistral browser sign-in...");
      const exchangeToken = await waitForCompletion(fetch, attempt, callbacks, sleep, now);
      callbacks.onProgress?.("Completing Mistral browser sign-in...");
      const apiKey = await exchange(fetch, attempt.processId, exchangeToken, codeVerifier);
      return { access: apiKey, refresh: "mistral-browser-sign-in", expires: now() + API_KEY_EXPIRES_MS };
    },
    async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
      return { ...credentials, expires: now() + API_KEY_EXPIRES_MS };
    },
    getApiKey(credentials: OAuthCredentials): string {
      return credentials.access;
    },
  };
}

export const mistralOAuth = createMistralOAuth();
