# pi-mistral-subscription

Pi package: Mistral subscription provider with browser sign-in through Mistral AI Studio.

Status: released. People install it from `main` or a pinned [release tag](https://github.com/EmmanuelARB/pi-mistral-subscription/releases); changes land only through reviewed pull requests with a green gate.

[![gate](https://github.com/EmmanuelARB/pi-mistral-subscription/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/EmmanuelARB/pi-mistral-subscription/actions/workflows/gate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A native [Pi](https://github.com/earendil-works/pi) package that adds a Mistral subscription provider to Pi Agent.
It registers `mistral-subscription`, adds `/login` browser sign-in through Mistral AI Studio, and lets Pi use the Mistral models exposed by Mistral Vibe with your Mistral Pro or higher subscription.
It uses Pi's native `mistral-conversations` streaming path, not a proxy server, and contains no credentials, tokens or API keys.

## Install

Requires Pi 0.99.0 or newer and Node.js 22.19.0 or newer; see [Compatibility](#compatibility).

Install directly from this public GitHub repo:

```sh
pi install https://github.com/EmmanuelARB/pi-mistral-subscription
```

This follows `main`, and `pi update --extensions` moves it to the latest merged change.
To stay on a released version instead, pin a tag from the [releases page](https://github.com/EmmanuelARB/pi-mistral-subscription/releases):

```sh
pi install git:github.com/EmmanuelARB/pi-mistral-subscription@v0.1.1
```

`pi update` leaves a pinned install on its tag; run `pi install` again with a newer tag to upgrade.
Each release's notes list what changed.

Or try it for one Pi run without adding it to settings:

```sh
pi -e https://github.com/EmmanuelARB/pi-mistral-subscription --provider mistral-subscription --model mistral-medium-3.5
```

For local development from a checkout:

```sh
git clone https://github.com/EmmanuelARB/pi-mistral-subscription
pi install ./pi-mistral-subscription
```

## Usage

Start Pi with the provider and a Mistral model:

```sh
pi --provider mistral-subscription --model mistral-medium-3.5
```

Then run:

```text
/login
```

Choose **Mistral subscription (Mistral AI Studio)**, complete the browser sign-in, and return to Pi. Pi stores the resulting credential in its normal auth storage.

## Configuration

### Models

Pi refreshes this provider's model list from Mistral Vibe's authenticated
`/v1/model-catalog?surface=vibe-code` endpoint. The returned chat models with
tool support are merged with the local list for that refresh: models the
catalog no longer lists (for example when the vibe-code surface rotates) stay
available, since subscription tokens can often still call them. The catalog supplies
context length, vision support, and reasoning modes; it does not supply an
output-token limit, so known models retain their local cap and new models use
a conservative 32,768-token cap. If credentials are unavailable or the request
fails, times out, or has no usable models, Pi keeps the local fallback below.
Restart or refresh Pi's model catalog to see later server-side changes.

| Model id | Name | Context | Reasoning | Images |
| --- | --- | --- | --- | --- |
| `mistral-medium-3.5` | Mistral Medium 3.5 (default in Mistral Vibe) | 262k | yes | yes |
| `mistral-small-latest` | Mistral Small 4 | 256k | yes | yes |
| `mistral-large-4` | Mistral Large 4 Preview | 1M | off / high | yes |
| `mistral-large-latest` | Mistral Large 3 | 262k | no | yes |
| `ministral-14b-2512` | Ministral 3 14B | 262k | no | yes |
| `ministral-8b-2512` | Ministral 3 8B | 262k | no | yes |
| `ministral-3b-2512` | Ministral 3 3B | 262k | no | yes |
| `devstral-small-latest` | Devstral Small (legacy, removed from Mistral Vibe) | 128k | no | no |
| `zai-glm-5-3` | Z.ai GLM 5.3 (Mistral hosted) | 1M | high | no |
| `zai-glm-5-3-flash` | Z.ai GLM 5.3 Flash (Mistral hosted) | 1M | high | yes |
| `deepseek-v4-1-flash-1017` | DeepSeek V4.1 Flash 1017 (Mistral hosted, not in Vibe) | 1M | off / high | yes |

Pick one with `--model <id>` or switch inside Pi with `/model`. Which models your key can call depends on your Mistral plan. If a model returns an auth or "model not found" error, fall back to `mistral-medium-3.5`.

For Medium 3.5, Small 4, Large 4, and DeepSeek V4.1 Flash 1017, `--thinking off`
explicitly sends `reasoning_effort: "none"` rather than relying on the server default.
The GLM 5.3 models accept low/high/max reasoning efforts but no `none`, so their
thinking map requests `high` only: `off` is not a supported level and is clamped
up to `high`, meaning reasoning cannot be disabled on these models.
Medium and Small retain their existing mappings for other thinking levels.

#### Cost tracking

Pi's session footer and `/session` show what your usage would cost at La
Plateforme's published API prices
([API pricing](https://docs.mistral.ai/inference/pricing)), in USD per million
input, cached-input and output tokens. The subscription itself is flat-rate, so
nothing is billed: the figure is the API-equivalent value of the tokens you
spend. Mistral publishes no pricing endpoint — the Vibe catalog and
`GET /v1/models` carry no price fields (checked 2026-10-31) — so the prices ship
in this extension and follow its releases. Models that are not sold on the
public API (Medium 3.5, Large 3, Devstral Small) log tokens at no cost. The
pricing page has a single "Cached input" discount, so prompt-cache writes bill
at the standard input rate.

#### Mistral Large 4 preview

```sh
pi --provider mistral-subscription --model mistral-large-4 --thinking high
# Minimal thinking, without a reasoning trace:
pi --provider mistral-subscription --model mistral-large-4 --thinking off
```

Large 4 exposes both distinct reasoning modes supported by Mistral:

- **off** sends `reasoning_effort: "none"`: minimal thinking, no reasoning trace.
- **high** sends `reasoning_effort: "high"`: full reasoning trace.

There are no separate low, medium, or maximum API budgets for this model.
Pi offers off and high using its native thinking-level mapping,
without a custom streaming adapter. Off explicitly sends `none`,
rather than omitting the field and leaving the server default in control.
Other models retain their existing reasoning mappings.

Mistral Vibe 2.26.1's [Mistral adapter](https://github.com/mistralai/mistral-vibe/blob/4ae5c5955da8e761318916bdb1a7f46f0b50c7d0/harness/runtimes/python/python/mistralai_vibe_local_harness/vibe/adapters/mistral.py)
also uses only `none` and `high`: its generic low setting maps to `none`,
and medium/high/max map to `high`.
Its [curated default model configuration](https://github.com/mistralai/mistral-vibe/blob/4ae5c5955da8e761318916bdb1a7f46f0b50c7d0/vibe/core/config/vibe_schema.py)
offers off/high for Medium 3.5; the public source does not contain a Large 4-specific configuration.
The unified adapter omits effort for off, while its
[legacy backend](https://github.com/mistralai/mistral-vibe/blob/4ae5c5955da8e761318916bdb1a7f46f0b50c7d0/vibe/core/llm/backend/mistral.py)
explicitly sends `none` when a curated model offers off.

The [Mistral model card](https://docs.mistral.ai/models/mistral-large-4-0)
documents the API ID, image support, and a 1M-token context window.
The catalog uses 1,000,000 tokens conservatively
and a local default output cap of 32,768 tokens,
not a claimed API maximum;
a separate output limit was not available in the model card.
See [Mistral's reasoning documentation](https://docs.mistral.ai/studio/conversations/reasoning)
for the supported effort values.
Preview access still depends on your subscription.

## Compatibility

- **Pi**: 0.99.0 or newer (`peerDependencies`). CI tests against Pi 1.3.0, last verified 2026-10-17.
- **Node.js**: 22.19.0 or newer (`engines`). CI runs Node 22 on Ubuntu 24.04.
- **Mistral**: a Pro or higher subscription with access through Mistral AI Studio. Which models you can call depends on your plan.

## Development

```sh
npm ci --ignore-scripts
npm run check   # format and lint, tests, typecheck, secret scan, pack check
```

Run one test file:

```sh
node --test --import tsx tests/models.test.ts
```

`.agents/setup` installs dependencies and enables the pre-push hook (`git config core.hooksPath .githooks`), which runs the gate before every push.

Project layout:

- `extensions/mistral-subscription/index.ts`: the Pi extension entry point. It registers the provider and the `/mistral-subscription-status` command.
- `src/models.ts`: the local fallback model catalog (see [Adding models](#adding-models)).
- `src/model-catalog.ts`: authenticated Vibe catalog refresh and validation.
- `src/mistral-oauth.ts`: the `/login` flow. It mirrors Mistral Vibe's browser sign-in: it starts a sign-in process on `console.mistral.ai`, polls until you finish in the browser, then exchanges the result for an API key that Pi stores.
- `tests/`: `node:test` suites run through `tsx`.
  The OAuth tests inject a fake `fetch`.
  Streaming tests use a loopback HTTP server to verify serialized requests;
  no tests contact Mistral or use real credentials.

### Adding models

The local fallback models live in [`src/models.ts`](src/models.ts). To add one, append an entry to `MODELS`:

```ts
model("<api-model-id>", "<Display Name> (Mistral subscription)", contextWindow, maxTokens, reasoning, TEXT_AND_IMAGE_INPUT),
```

- **`api-model-id`**: the exact id Mistral's API accepts, from the [Mistral models overview](https://docs.mistral.ai/models). Use a pinned version (`ministral-8b-2512`) to keep behavior stable, or a `-latest` alias to follow upgrades.
- **`contextWindow` / `maxTokens`**: take these from Mistral's docs. pi-ai's built-in `mistral` catalog (`node_modules/@earendil-works/pi-ai/dist/models.generated.js`) is a handy cross-check.
- **`reasoning`**: set it to `true` only for models that support `reasoning_effort`.
  Pi 0.99+'s native `mistral-conversations` provider uses `thinkingLevelMap`
  to select `reasoning_effort`,
  rather than requiring a hardcoded list of model IDs.
  Reasoning models without a map use legacy `prompt_mode` instead.
  The helper supplies a `none`/`high` map with explicit `none` for off;
  Large 4 overrides it to offer only off/high.
  Verify new mappings in `tests/mistral-stream.test.ts`.
- **Input**: use `TEXT_AND_IMAGE_INPUT` for vision models and `TEXT_INPUT` otherwise.
- **Price**: pass the `apiCost` helper in [`src/models.ts`](src/models.ts) with
  the model's Input / Cached input / Output prices from the
  [API pricing page](https://docs.mistral.ai/inference/pricing), or leave it out
  with a comment explaining why no price is published.

Then add the model to the [model table](#models) and run `npm run check`. To try it for real, sign in with `/login` and run:

```sh
pi -e . --provider mistral-subscription --model <api-model-id>
```

Useful references when Mistral changes things:

- [Mistral Vibe source](https://github.com/mistralai/mistral-vibe): `vibe/core/config/vibe_schema.py` (`DEFAULT_MODELS`) shows which models Vibe ships, and its browser-auth code is the reference for the sign-in flow.
- [Mistral changelog](https://docs.mistral.ai/resources/changelogs): new model ids and deprecations.
- pi-ai's `mistral-conversations` provider: how requests, reasoning and streaming are sent.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Contributing, support and security

- Bugs and feature requests: [open an issue](https://github.com/EmmanuelARB/pi-mistral-subscription/issues/new/choose). Issues are triaged and pull requests reviewed within 7 days.
- Contributions: [CONTRIBUTING.md](CONTRIBUTING.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Vulnerabilities: report privately as described in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
