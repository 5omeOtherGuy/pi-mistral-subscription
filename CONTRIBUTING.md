# Contributing

Contributions are welcome. This is a small, volunteer-maintained project, and I cannot promise ongoing maintenance, review times, or releases. Please feel free to fork it and continue development if I am unavailable. The project is licensed under MIT; see [LICENSE](LICENSE).

## Issues and pull requests

For a substantial change, open an issue or comment on an existing one to discuss the approach. Small fixes can go straight to a pull request. Keep pull requests focused, explain what changed and why, and link any relevant issue. If a pull request addresses only part of an issue, reference it without a closing keyword.

I will review contributions when I can, but an open issue or pull request is not a commitment to accept or maintain a change. Please do not rely on a particular response time.

## Development

Use Node.js 22.19.0 or newer. From the repository root:

```sh
npm ci --ignore-scripts
npm run check
```

`npm run check` runs the tests and TypeScript typecheck. Include tests for behavior changes. The existing request tests use a local loopback server, so they do not need a Mistral account.

## Model and catalog changes

Explain where model IDs, capabilities, and limits come from, preferably with links to Mistral's documentation or source. Describe how the change handles unavailable or unexpected API responses. Update the README and relevant tests. If you test with a live subscription, say which behavior you verified; live access can differ by plan and is not required for a pull request.

Never commit API keys, OAuth credentials, auth files, or captured requests containing secrets. Use placeholders in tests and examples.

The documented installation method is currently GitHub. npm publication is a separate maintainer decision, not a requirement for contributing.
