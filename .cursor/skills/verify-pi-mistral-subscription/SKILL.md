---

name: verify-pi-mistral-subscription
description: Verify the Mistral subscription extension through Pi's CLI, including subscription model selection, streaming usage, and native prompt caching. Use for repository release checks or to distinguish an extension regression from Pi or Mistral behavior.
---

# Verify Pi Mistral subscription

## Launch and doctor

From the repository root, run `npm ci --ignore-scripts` and `npm run check` through mise on the P720. This covers fake-fetch browser sign-in and loopback streaming. The live driver uses the installed Pi CLI with the extension from `--repo`, a disposable Pi configuration, no saved session, no other extensions, and no tools.

On the P720, from the checkout being verified:

```bash
probe=.cursor/skills/verify-pi-mistral-subscription/scripts/probe.py
python "$probe" --repo "$PWD" --mode doctor
```

The doctor reports Pi's version and confirms an unexpired stored subscription credential. The live evidence hooks were exercised on Pi 1.5.2. The driver makes no credential copy and never prints one. Set `--auth` for a nondefault auth path. If sign-in is unavailable, use Pi's documented browser flow in an authorized session and run doctor again. The driver does not change the stored sign-in.

## Drive and evidence

The project gate is hermetic. Run the live driver only when the owner authorizes Mistral quota use. Review [Mistral's current prices](https://docs.mistral.ai/inference/pricing?region=eu) before selecting models. The driver accepts only inexpensive model IDs, sends two short-output turns per model, and uses a fresh synthetic prefix and routing key on each run.

```bash
python "$probe" --repo "$PWD" --mode pi deepseek-v4-1-flash-1017 zai-glm-5-3-flash
```

Keep the JSON summary in the task conversation or a user-requested artifact. It contains HTTP status, hashes of the routing and prefix fields sent over HTTP, provider usage, and Pi's final usage. A model succeeds when both turns use the requested model, stream to completion, have the same nonempty routing and prefix hashes, and Pi's cache count matches the provider's. The driver exits nonzero if those transport or accounting checks fail. Check the provider's second-turn cached-token count separately for a cache hit.

If cached tokens are missing or zero, inspect the routing, prefix and token counts first. Use [the cache feature map](features/prompt-caching.md) for the direct Mistral control and attribution. Streaming with a valid cache key can still produce a miss.

## Cleanup

The driver removes its temporary state and evidence file after each model. Retain the sanitized summary from stdout and delete any task-owned copy built for the run. The existing Pi sign-in and sessions remain available.

Use [the feature map](features/README.md) to choose a verification path. Use pstack's `maintain-verification-skill` when a user flow or evidence field changes.
