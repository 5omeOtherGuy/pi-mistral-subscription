# Subscription model selection and streaming

## Scope

Built-in `mistral` provider, exact model selection, reasoning, assistant completion and token accounting.

## Use in Pi

Choose `mistral/<id>` in `/model` or pass it to Pi with `--model` after signing in.

## Verify the behavior

Run the driver's `--mode pi` with an approved cheap model. Check both resolved assistant model/provider pairs and both HTTP/stop outcomes. `length` still proves streaming and usage within the test cap, while `error` or `aborted` fails the journey. Compare raw total prompt usage with Pi's uncached input plus cache reads.

## Limits

Record the tested Pi version. Pi supplies the model metadata, serializes requests, and parses the stream. If a model is missing, check Pi's catalog and the subscription hide list.
