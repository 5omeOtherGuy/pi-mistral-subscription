# Prompt caching

## Sub-features

Stable routing, prompt prefix reuse, provider cache reporting and Pi cache accounting.

## How to get to it (user POV)

Send a second turn in the same Pi session while signed in to Mistral, preserving the initial prompt.

## Driving it with Pi

Run `--mode pi` as shown in the skill. Compare the request key and prefix across turns, then compare the HTTP affinity hash and raw provider usage with Pi's assistant usage. If raw cached tokens are positive but Pi's `cacheRead` differs, inspect the native `mistral-conversations` stream parser. If the key, affinity or prefix changes, inspect Pi's session and request serialization and compare the model overlay with the built-in configuration.

For misses with stable inputs, run the direct control only for the affected approved model:

```bash
python "$probe" --repo "$PWD" --mode direct deepseek-v4-1-flash-1017
```

The control uses the same subscription credential and the streamed Chat Completions endpoint Pi calls. Its fresh synthetic prefix, stable cache key and affinity header follow the same design. It bypasses Pi and the extension. Provider-side misses in both paths localize the observed behavior upstream of Pi's usage parser. A direct hit with a Pi miss warrants comparing the actual wire fields and repeatability before assigning blame. Do not save bearer headers or full live requests.

## Gotchas

A first turn can already show a partial hit from shared context. A second-turn zero or omitted count establishes a miss for that run. Check [Mistral's cache documentation](https://docs.mistral.ai/inference/conversations/advanced/prompt-caching) and report model-specific results. Latency is supplementary evidence.
