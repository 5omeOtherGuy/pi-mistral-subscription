# pi-mistral-subscription

A native [Pi](https://github.com/earendil-works/pi) package that adds a Mistral subscription provider to Pi Agent.

It registers `mistral-subscription`, adds `/login` browser sign-in through Mistral AI Studio, and lets Pi use the Mistral models exposed by Mistral Vibe with your Mistral Pro or higher subscription.

## Install

Install directly from this public GitHub repo:

```sh
pi install https://github.com/5omeOtherGuy/pi-mistral-subscription
```

Or try it for one Pi run without adding it to settings:

```sh
pi -e https://github.com/5omeOtherGuy/pi-mistral-subscription --provider mistral-subscription --model mistral-medium-3.5
```

For local development from a checkout:

```sh
git clone https://github.com/5omeOtherGuy/pi-mistral-subscription
pi install ./pi-mistral-subscription
```

## Login and use

Start Pi with the provider and a Mistral model:

```sh
pi --provider mistral-subscription --model mistral-medium-3.5
```

Then run:

```text
/login
```

Choose **Mistral subscription (Mistral AI Studio)**, complete the browser sign-in, and return to Pi. Pi stores the resulting credential in its normal auth storage.

## Models

| Model id | Name | Context | Reasoning | Images |
| --- | --- | --- | --- | --- |
| `mistral-medium-3.5` | Mistral Medium 3.5 (default in Mistral Vibe) | 262k | yes | yes |
| `mistral-small-latest` | Mistral Small 4 | 256k | yes | yes |
| `mistral-large-latest` | Mistral Large 3 | 262k | no | yes |
| `ministral-14b-2512` | Ministral 3 14B | 262k | no | yes |
| `ministral-8b-2512` | Ministral 3 8B | 262k | no | yes |
| `ministral-3b-2512` | Ministral 3 3B | 262k | no | yes |
| `devstral-small-latest` | Devstral Small (legacy, removed from Mistral Vibe) | 128k | no | no |

Pick one with `--model <id>` or switch inside Pi with `/model`. Which models your key can call depends on your Mistral plan. If a model returns an auth or "model not found" error, fall back to `mistral-medium-3.5`.

## Adding models

All models live in [`src/models.ts`](src/models.ts). To add one, append an entry to `MODELS`:

```ts
model("<api-model-id>", "<Display Name> (Mistral subscription)", contextWindow, maxTokens, reasoning, TEXT_AND_IMAGE_INPUT),
```

- **`api-model-id`**: the exact id Mistral's API accepts, from the [Mistral models overview](https://docs.mistral.ai/models). Use a pinned version (`ministral-8b-2512`) to keep behavior stable, or a `-latest` alias to follow upgrades.
- **`contextWindow` / `maxTokens`**: take these from Mistral's docs. pi-ai's built-in `mistral` catalog (`node_modules/@earendil-works/pi-ai/dist/models.generated.js`) is a handy cross-check.
- **`reasoning`**: set it to `true` only for models that support `reasoning_effort`. pi-ai's `mistral-conversations` provider sends that parameter only for the ids it knows (`usesReasoningEffort` in its Mistral provider). A reasoning model with any other id gets the legacy `prompt_mode` request instead. If you add a new reasoning id, update `REASONING_EFFORT_IDS` in `tests/models.test.ts` after confirming pi-ai supports it.
- **Input**: use `TEXT_AND_IMAGE_INPUT` for vision models and `TEXT_INPUT` otherwise.

Then add the model to the table above and run `npm run check`. To try it for real, sign in with `/login` and run:

```sh
pi -e . --provider mistral-subscription --model <api-model-id>
```

## Notes

- Requires a Mistral Pro or higher subscription with access through Mistral AI Studio.
- The provider uses Pi's native `mistral-conversations` streaming path, not a proxy server.
- This package contains no real credentials, tokens, or API keys.

## Development

```sh
npm ci --ignore-scripts
npm run check   # unit tests + typecheck
```

Project layout:

- `extensions/mistral-subscription/index.ts`: the Pi extension entry point. It registers the provider and the `/mistral-subscription-status` command.
- `src/models.ts`: the model catalog (see [Adding models](#adding-models)).
- `src/mistral-oauth.ts`: the `/login` flow. It mirrors Mistral Vibe's browser sign-in: it starts a sign-in process on `console.mistral.ai`, polls until you finish in the browser, then exchanges the result for an API key that Pi stores.
- `tests/`: `node:test` suites run through `tsx`. The OAuth tests inject a fake `fetch`, so they never touch the network.

Useful references when Mistral changes things:

- [Mistral Vibe source](https://github.com/mistralai/mistral-vibe): `vibe/core/config/vibe_schema.py` (`DEFAULT_MODELS`) shows which models Vibe ships, and its browser-auth code is the reference for the sign-in flow.
- [Mistral changelog](https://docs.mistral.ai/resources/changelogs): new model ids and deprecations.
- pi-ai's `mistral-conversations` provider: how requests, reasoning and streaming are sent.

Please never commit real credentials. Use placeholder values in tests.
