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

Currently registered:

- `mistral-medium-3.5`
- `devstral-small-latest`

## Notes

- Requires a Mistral Pro or higher subscription with access through Mistral AI Studio.
- The provider uses Pi's native `mistral-conversations` streaming path, not a proxy server.
- This package contains no real credentials, tokens, or API keys.

## Development

```sh
npm ci --ignore-scripts
npm run check
```
