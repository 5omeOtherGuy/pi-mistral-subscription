<profile>

- Purpose: Pi package that adds Mistral subscription sign-in through Mistral AI Studio to Pi's built-in `mistral` provider.
- Stage: released (repository standard)
- Gate: `npm run check` (CI job `gate`, also the pre-push hook). Focused test: `node --test --import tsx tests/<file>.test.ts`.
- Setup: `.agents/setup` (`npm ci --ignore-scripts`, then `git config core.hooksPath .githooks`).
- Landing: PR, squash-merged on a green gate; agents land: yes.
- Release: hand-cut `v0.x.y` tag and GitHub Release by the agent that merged a behaviour change, following `docs/releasing.md`; agents release: yes.
- Outside issues and PRs: agents triage; outside PRs merge: owner approves.
- Sensitive paths: `src/mistral-oauth.ts`, `src/mistral-overlay.ts`, `src/models.ts`, `extensions/mistral-subscription/index.ts`, `package.json`, `.npmrc`, `.agents/`, `.githooks/`, `.github/workflows/`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `.secretlintrc.json`, `.gitignore`, `AGENTS.md`.

</profile>

<rules>

- Use Pi's native `mistral-conversations` API path; add no proxy server or custom streaming adapter.
- Leave to Pi's built-in `mistral` provider what it already does: the overlay holds only what a subscription key does differently, and API-key use of `mistral` stays as Pi ships it.
- Take model IDs, limits and capabilities only from Mistral's documentation, the Mistral Vibe source or a live check the owner asked for. Cite them in the PR and update the README and tests together.
- Keep tests hermetic: OAuth tests inject a fake `fetch`, streaming tests use a loopback server. Build credential-shaped strings from parts.
- Never commit API keys, OAuth credentials, Pi auth files or captured requests.
- Run live tests against Mistral only when the owner asks: they spend the owner's subscription quota.
- Keep `peerDependencies` at the oldest Pi version that works and the Pi dev dependencies at the newest Pi release. Keep `@types/node` on the `engines.node` line.
- Author commits with `268151429+5omeOtherGuy@users.noreply.github.com` and add no personal email trailers.
- Never publish to npm: that is the owner's decision.

</rules>
