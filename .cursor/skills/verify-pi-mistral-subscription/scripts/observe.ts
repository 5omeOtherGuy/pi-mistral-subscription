import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const model = process.env.MISTRAL_VERIFY_MODEL;
const evidence = process.env.MISTRAL_VERIFY_EVIDENCE;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
const MAX_TOKENS = 24;

export default function observe(pi: ExtensionAPI) {
  if (!model || !evidence) throw new Error("Missing verification settings");
  const report = (entry: object) => appendFileSync(evidence, `${JSON.stringify(entry)}\n`);

  pi.on("before_provider_request", (event, ctx) => {
    const payload = event.payload as { model?: string };
    if (ctx.model?.provider !== "mistral" || ctx.model.api !== "mistral-conversations" || payload.model !== model) {
      throw new Error("Unexpected provider or model in verification run");
    }
    return { ...payload, maxTokens: MAX_TOKENS };
  });

  // Pi's headers hook runs before the Mistral transport adds its affinity header.
  const fetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.url !== "https://api.mistral.ai/v1/chat/completions") {
      throw new Error("Unexpected network request in verification run");
    }
    const payload = (await request.clone().json()) as {
      model?: string;
      messages?: { role: string; content: unknown }[];
      max_tokens?: number;
      prompt_cache_key?: string;
      reasoning_effort?: string;
      stream?: boolean;
    };
    if (payload.model !== model || payload.max_tokens !== MAX_TOKENS || !payload.stream || request.method !== "POST") {
      throw new Error("Unsafe model or output limit in verification request");
    }
    if (requests >= 2) throw new Error("Verification request limit reached");
    requests += 1;
    const firstUser = payload.messages?.findIndex((message) => message.role === "user") ?? -1;
    const prefix = firstUser >= 0 ? payload.messages?.slice(0, firstUser + 1) : undefined;
    const affinity = request.headers.get("x-affinity");
    report({
      kind: "request",
      keyHash: payload.prompt_cache_key ? digest(payload.prompt_cache_key) : null,
      affinityHash: affinity ? digest(affinity) : null,
      prefixHash: prefix ? digest(prefix) : null,
      reasoning: payload.reasoning_effort ?? null,
      maxTokens: payload.max_tokens,
    });
    return fetch(request, { redirect: "error" });
  };

  pi.on("after_provider_response", (event) => report({ kind: "http", status: event.status }));

  pi.on("provider_stream_event", (event) => {
    const data = event.data as {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        cached_prompt_tokens?: number;
      };
    };
    if (!data?.usage) return;
    report({
      kind: "provider",
      input: data.usage.prompt_tokens ?? null,
      cached: data.usage.prompt_tokens_details?.cached_tokens ?? data.usage.cached_prompt_tokens ?? null,
      output: data.usage.completion_tokens ?? null,
    });
  });
}
