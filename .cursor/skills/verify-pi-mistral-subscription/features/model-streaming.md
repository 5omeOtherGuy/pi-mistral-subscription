# Subscription model selection and streaming

## Sub-features

Built-in `mistral` provider, exact model selection, reasoning, assistant completion and token accounting.

## How to get to it (user POV)

Choose `mistral/<id>` in `/model` or pass it to Pi with `--model` after signing in.

## Driving it with Pi

Run the driver's `--mode pi` with an approved cheap model. Check both resolved assistant model/provider pairs and both HTTP/stop outcomes. `length` still proves streaming and usage within the test cap, while `error` or `aborted` fails the journey. Compare raw total prompt usage with Pi's uncached input plus cache reads.

## Gotchas

Pin the tested Pi version in the evidence. The model catalog belongs to Pi, and the subscription overlay changes selected model configuration. The provider serializes requests and parses the stream. An absent model needs a catalog/overlay check before any provider attribution.
