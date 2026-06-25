# pi-mistral-subscription

Native Pi provider for Mistral subscriptions. It registers `mistral-subscription` with the Mistral models used by Mistral Vibe and adds `/login` browser sign-in through Mistral AI Studio.

Use in Pi after installing this package:

```sh
pi --provider mistral-subscription --model mistral-medium-3.5
```

Run `/login`, choose Mistral subscription, complete the browser sign-in, then use any registered model.
