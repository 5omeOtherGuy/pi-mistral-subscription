# pi-mistral-subscription

Pi package: Mistral subscription sign-in for Pi's built-in `mistral` provider, through Mistral AI Studio.

Status: released. People install it from `main` or a pinned [release tag](https://github.com/EmmanuelARB/pi-mistral-subscription/releases); changes land only through reviewed pull requests with a green gate.

[![gate](https://github.com/EmmanuelARB/pi-mistral-subscription/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/EmmanuelARB/pi-mistral-subscription/actions/workflows/gate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A [Pi](https://github.com/earendil-works/pi) package that lets you use your Mistral subscription with Pi's built-in `mistral` provider.
It adds browser sign-in through Mistral AI Studio to `/login`. Everything else comes from Pi: the models, their limits and prices, reasoning levels, streaming and prompt caching.
It runs no proxy server and contains no credentials, tokens or API keys.

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

Or try it for one Pi run without adding it to settings. Run `/logout` before you end such a trial: without this package Pi cannot use the stored sign-in, and it then leaves `mistral` unavailable, even with `MISTRAL_API_KEY` set.

```sh
pi -e https://github.com/EmmanuelARB/pi-mistral-subscription --model mistral/mistral-medium-3.5
```

For local development from a checkout:

```sh
git clone https://github.com/EmmanuelARB/pi-mistral-subscription
pi install ./pi-mistral-subscription
```

## Usage

Start Pi and sign in:

```text
/login
```

Choose **Sign in with an account**, then **Mistral**, and complete the browser sign-in with your Mistral Pro or higher account. Pi waits for the sign-in by itself, so you can open the link on any device.

Then pick a model with `/model`, also if one was already selected, so that it picks up the changes below. Or start with one:

```sh
pi --model mistral/zai-glm-5-3 --thinking max
```

Change the reasoning level with Shift+Tab or `--thinking`. The footer shows `(sub)` while the sign-in is active.

### What the sign-in changes

The sign-in returns a Mistral API key, which Pi stores in `auth.json`. Pi keeps one stored credential per provider, which has a few consequences:

- **It replaces a stored `mistral` API key.** Keep a copy if you still need that key.
- **`MISTRAL_API_KEY` is ignored while you are signed in.** After `/logout`, Pi uses the variable again without telling you, and that usage is ordinary API usage.
- **`--api-key` wins for that run.** `pi --api-key <key> --model mistral/<id>` uses your API key instead of the subscription, though model limits stay as adjusted below. The key can end up in your shell history.
- **`/logout` only removes the key from Pi.** It stays valid at Mistral until you revoke it in the console. The session keeps its model until you pick another one.
- **Run `/logout` before you remove this package.** Pi cannot use a stored sign-in without it and leaves `mistral` unavailable, even with `MISTRAL_API_KEY` set.

Without a sign-in, this package changes nothing about the `mistral` provider.

### Usage and billing

Mistral plans include a monthly usage budget shared across Studio, the API and Vibe Code, so this is not a flat rate. The Admin Panel lists sign-in requests as usage type **Vibe Code** and plain API keys as **Completion** (checked 2026-10-31). Pay-as-you-go is off by default.

Pi shows the API-equivalent price of what you use. That figure is not a bill.

## Configuration

### Models

The models come from Pi's catalog, which Pi keeps up to date. While you are signed in, this package changes a few things, because Pi's catalog also describes models a subscription cannot use or leaves out what the API accepts:

- It hides models Mistral refuses for a subscription key.
- It keeps Large 4, GLM 5.3 and GLM 5.3 Flash available even before Pi has fetched its online catalog.
- It sets the reasoning levels of Large 4, GLM 5.2 and DeepSeek V4.1 Flash to what the API accepts.
- It enables image input for DeepSeek V4.1 Flash.
- It caps Large 4 output at 32,768 tokens to limit a runaway turn.

Other models that are new in Pi's online catalog, such as DeepSeek V4.1 Flash, appear once Pi has fetched it, which it does in the background at interactive start and when you open `/model`. Print mode uses what Pi fetched last.

Reasoning levels by model, checked against the live API on 2026-10-31:

| Model | Reasoning levels | Notes |
| --- | --- | --- |
| `mistral-large-4` | low / medium / high | Mistral rejects `none`; `--thinking off` falls back to `low` |
| `zai-glm-5-3`, `zai-glm-5-3-flash` | low / high / max | Mistral rejects `none`; `--thinking off` falls back to `low` |
| `zai-glm-5-2`, `glm-5-2` | off / minimal / low / medium / high / xhigh / max | |
| `deepseek-v4-1-flash-1017` | off / low / high / xhigh / max | |
| `mistral-medium-3.5`, `mistral-medium-latest`, `mistral-small-latest` | off / high | Mistral has no levels in between |
| `mistral-large-latest`, Ministral 3 | none | These models reject every reasoning value |

Small does not always see images: it often answers that it received none, more so with reasoning on, and Mistral's API does the same without Pi. Use `--thinking off` and retry, or pick Medium 3.5 for images.

### Moving from `mistral-subscription`

Earlier releases added a separate provider called `mistral-subscription`. It still works in this release and is deprecated:

1. Run `/login`, and sign in to **Mistral**.
2. Replace `mistral-subscription/` with `mistral/` in your settings, such as `enabledModels` and `defaultModel`, and `defaultProvider` with `mistral`.
3. Run `/logout` and remove the old `mistral-subscription` entry. Do not revoke its key in the Mistral console: the new sign-in returned the same key in our check, so revoking it would end both.

`devstral-small-latest` has no equivalent in Pi's catalog; `devstral-latest` and `devstral-medium-latest` work. A session that was started with the old provider keeps using it. If you remove the package, or a later release drops that provider, Pi moves such sessions and defaults to another model or provider without a clear warning, so migrate first.

## Compatibility

- **Pi**: 0.99.0 or newer (`peerDependencies`). CI tests against Pi 1.3.0, last verified 2026-10-17.
- **Node.js**: 22.19.0 or newer (`engines`). CI runs Node 22 on Ubuntu 24.04.
- **Mistral**: a Pro or higher subscription with access through Mistral AI Studio.

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

- `extensions/mistral-subscription/index.ts`: the Pi extension entry point. It adds the sign-in to the built-in `mistral` provider, keeps the deprecated `mistral-subscription` provider and registers the `/mistral-subscription-status` command.
- `src/mistral-overlay.ts`: what changes in Pi's models while signed in.
- `src/models.ts`: the fixed model list of the deprecated provider, which also supplies the overlay's fallback models.
- `src/mistral-oauth.ts`: the `/login` flow. It mirrors Mistral Vibe's browser sign-in: it starts a sign-in process on `console.mistral.ai`, polls until you finish in the browser, then exchanges the result for an API key that Pi stores.
- `tests/`: `node:test` suites run through `tsx`.
  The OAuth tests inject a fake `fetch`.
  Streaming tests use a loopback HTTP server to verify serialized requests;
  no tests contact Mistral or use real credentials.

### Changing models

Pi owns the catalog, so a new Mistral model needs no change here. Change [`src/mistral-overlay.ts`](src/mistral-overlay.ts) only when a subscription key behaves differently from what Pi's catalog says, and add a test to `tests/mistral-overlay.test.ts`. To try it for real, sign in with `/login` and run:

```sh
pi -e . --model mistral/<api-model-id>
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
