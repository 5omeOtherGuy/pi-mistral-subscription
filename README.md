# pi-mistral-subscription

[![gate](https://github.com/5omeOtherGuy/pi-mistral-subscription/actions/workflows/gate.yml/badge.svg?branch=main)](https://github.com/5omeOtherGuy/pi-mistral-subscription/actions/workflows/gate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A [Pi](https://github.com/earendil-works/pi) package that lets you use your Mistral subscription with Pi's built-in `mistral` provider.
It adds browser sign-in through Mistral AI Studio to `/login`. Pi supplies the model catalog, streaming, and prompt caching. The extension filters a few catalog entries when you sign in.

Install from `main` or a pinned [release tag](https://github.com/5omeOtherGuy/pi-mistral-subscription/releases). Changes land through reviewed pull requests with a passing gate.

## Install

Use Pi 0.99.0 or newer and Node.js 22.19.0 or newer. See [Compatibility](#compatibility) for the tested versions.

Install directly from this public GitHub repo:

```sh
pi install https://github.com/5omeOtherGuy/pi-mistral-subscription
```

This follows `main`, and `pi update --extensions` moves it to the latest merged change.
To stay on a released version instead, pin a tag from the [releases page](https://github.com/5omeOtherGuy/pi-mistral-subscription/releases):

```sh
pi install git:github.com/5omeOtherGuy/pi-mistral-subscription@v0.3.0
```

`pi update` leaves a pinned install on its tag; run `pi install` again with a newer tag to upgrade.
Each release's notes list what changed.

Or try it for one Pi run without adding it to settings. Run `/logout` before you end such a trial: without this package Pi cannot use the stored sign-in, and it then leaves `mistral` unavailable, even with `MISTRAL_API_KEY` set.

```sh
pi -e https://github.com/5omeOtherGuy/pi-mistral-subscription --model mistral/mistral-medium-3.5
```

For local development from a checkout:

```sh
git clone https://github.com/5omeOtherGuy/pi-mistral-subscription
pi install ./pi-mistral-subscription
```

## Sign in

Start Pi and sign in:

```text
/login
```

Choose **Sign in with an account**, then **Mistral**, and complete the browser sign-in with your Mistral Pro or higher account. Pi waits for the sign-in by itself, so you can open the link on any device.

If you cancel browser sign-in, Pi stops waiting even when a request is still pending. A late response does not complete the cancelled sign-in. This behavior ships in [v0.2.1](https://github.com/5omeOtherGuy/pi-mistral-subscription/releases/tag/v0.2.1).

After you sign in, select a model with `/model`. You can also select a model when you start Pi:

```sh
pi --model mistral/zai-glm-5-3 --thinking max
```

Change the reasoning level with Shift+Tab or `--thinking`. The footer shows `(sub)` while the sign-in is active.

### What the sign-in changes

The sign-in returns a Mistral API key, which Pi stores in `auth.json`. Pi keeps one stored credential per provider, which has a few consequences:

- **It replaces a stored `mistral` API key.** Keep a copy if you still need that key.
- **`MISTRAL_API_KEY` is ignored while you are signed in.** After `/logout`, Pi uses the variable again without telling you, and that usage is ordinary API usage.
- **`--api-key` wins for that run.** `pi --api-key <key> --model mistral/<id>` uses your API key instead of the subscription. The key can end up in your shell history.
- **`/logout` only removes the key from Pi.** It stays valid at Mistral until you revoke it in the console. The session keeps its model until you pick another one.
- **Run `/logout` before you remove this package.** Pi cannot use a stored sign-in without it and leaves `mistral` unavailable, even with `MISTRAL_API_KEY` set.

Without a sign-in, this package changes nothing about the `mistral` provider.

## Usage and billing

Mistral plans include a monthly usage budget shared across Studio, the API and Vibe Code, so this is not a flat rate. The Admin Panel lists sign-in requests as usage type **Vibe Code** and plain API keys as **Completion** (checked 2026-10-31). Pay-as-you-go is off by default.

Pi shows the API-equivalent price of what you use. That figure is not a bill.

## Model reference

Pi's catalog supplies model availability, reasoning levels, image support, and output limits for the built-in `mistral` provider. When you sign in, the extension hides IDs that Mistral rejected during a subscription check on 2026-10-31.

Older Pi versions may need to fetch the online catalog before models such as Large 4 and GLM 5.3 appear. Open `/model` in an interactive session to refresh the catalog. Print mode uses Pi's bundled catalog and any catalog it has already fetched.

Small does not always see images: it often answers that it received none, more so with reasoning on, and Mistral's API does the same without Pi. Use `--thinking off` and retry, or pick Medium 3.5 for images.

## Migrate from `mistral-subscription`

Earlier releases added a separate provider called `mistral-subscription`. It still works in this release and is deprecated:

1. Run `/login`, and sign in to **Mistral**.
2. Replace `mistral-subscription/` with `mistral/` in your settings, such as `enabledModels` and `defaultModel`, and `defaultProvider` with `mistral`.
3. Run `/logout` and remove the old `mistral-subscription` entry. Do not revoke its key in the Mistral console: the new sign-in returned the same key in our check, so revoking it would end both.

`devstral-small-latest` has no equivalent in Pi's catalog; `devstral-latest` and `devstral-medium-latest` work. A session that was started with the old provider keeps using it. If you remove the package, or a later release drops that provider, Pi moves such sessions and defaults to another model or provider without a clear warning, so migrate first.

## Compatibility

- **Pi**: 0.99.0 or newer (`peerDependencies`). CI installs Pi 1.4.0 from the committed lockfile.
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
- `src/mistral-overlay.ts`: model IDs to hide while signed in.
- `src/models.ts`: the fixed model list of the deprecated provider.
- `src/mistral-oauth.ts`: the `/login` flow. It mirrors Mistral Vibe's browser sign-in: it starts a sign-in process on `console.mistral.ai`, polls until you finish in the browser, then exchanges the result for an API key that Pi stores.
- `tests/`: `node:test` suites run through `tsx`.
  The OAuth tests inject a fake `fetch`.
  Streaming tests use a loopback HTTP server to verify serialized requests;
  no tests contact Mistral or use real credentials.

### Change models

Pi owns the catalog. If you confirm that a subscription key cannot use a listed model, update [`src/mistral-overlay.ts`](src/mistral-overlay.ts) and `tests/mistral-overlay.test.ts`. Live requests spend subscription quota and require the owner's authorization. Once authorized, sign in with `/login` and run:

```sh
pi -e . --model mistral/<api-model-id>
```

Useful references when Mistral changes things:

- [Mistral Vibe source](https://github.com/mistralai/mistral-vibe): `vibe/core/config/vibe_schema.py` (`DEFAULT_MODELS`) shows which models Vibe ships, and its browser-auth code is the reference for the sign-in flow.
- [Mistral changelog](https://docs.mistral.ai/resources/changelogs): new model ids and deprecations.
- pi-ai's `mistral-conversations` provider: how requests, reasoning and streaming are sent.

## Contributing, support and security

- Bugs and feature requests: [open an issue](https://github.com/5omeOtherGuy/pi-mistral-subscription/issues/new/choose). Issues are triaged and pull requests reviewed within 7 days.
- See the [contributor guide](https://github.com/5omeOtherGuy/pi-mistral-subscription/blob/main/CONTRIBUTING.md) for development checks and the verification skill. Everyone taking part follows the [Code of Conduct](https://github.com/5omeOtherGuy/pi-mistral-subscription/blob/main/CODE_OF_CONDUCT.md).
- Vulnerabilities: report privately as described in [SECURITY.md](https://github.com/5omeOtherGuy/pi-mistral-subscription/blob/main/SECURITY.md).

## Licence

[MIT](LICENSE)
