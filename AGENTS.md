# AGENTS.md

## Profile

- Purpose: Pi package that adds Mistral subscription sign-in through Mistral AI Studio to Pi's built-in `mistral` provider.
- Stage: released (repository standard)
- Gate: `npm run check` (CI job `gate`)
- Landing: PR, squash-merged on a green gate; agents land: yes
- Release: `v0.x.y` tag and GitHub Release cut by hand by the agent that merged a behaviour change, following [docs/releasing.md](docs/releasing.md); agents release: yes
- Outside issues and PRs: agents triage; outside PRs merge: owner approves
- Sensitive paths: `src/mistral-oauth.ts`, `src/mistral-overlay.ts`, `src/models.ts`, `extensions/mistral-subscription/index.ts`, `package.json`, `.npmrc`, `.agents/`, `.githooks/`, `.github/workflows/`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `.secretlintrc.json`, `.gitignore`, `AGENTS.md`

Deliberate deviations from the standard:
- No release workflow or `CHANGELOG.md`: releases are tagged by hand and GitHub Release notes serve as the changelog. npm publication is deferred (issue #1).
- `CONTRIBUTING.md` keeps repository-specific rules: install with `npm ci --ignore-scripts`; cite sources for model IDs and limits and describe unexpected-response handling; never commit keys or captured requests; installation is from GitHub, npm publication is a separate maintainer decision.

## Landing

1. Work in a per-task worktree, `git worktree add ~/Work/.worktrees/pi-mistral-subscription/<slug> -b <type>/<slug> origin/main` after `git fetch origin --prune` (`<type>/<issue>-<slug>` for an issue); the primary checkout is control-only (no edits, no branch switches). One concern per PR. Remove the worktree and branch after the merge.
2. Run `npm run check` (the pre-push hook runs it too).
3. Open a PR with a Conventional Commits title; the body follows `.github/pull_request_template.md`: intent, changed behavior, constraints touched, evidence, whether a sensitive path changed, and `Fixes #n` where it applies.
4. Changes to a sensitive path get an independent review before merge, and so do, listed or not, changes to public interfaces (provider ID, model IDs, login flow, package manifest), security-sensitive code, auth or credential handling, install or setup, CI or release configuration, agent policy files, and docs that change rules or executable instructions. Record the verdict on the PR against the reviewed head commit; a later push needs a new review.
5. Squash-merge once `gate` is green on the head commit.

## Rules

- Use Pi's native `mistral-conversations` API path; no proxy server or custom streaming adapter.
- Use Pi's built-in `mistral` provider for everything it already does; the overlay holds only what a subscription key does differently from Pi's catalog, and API-key use of `mistral` stays exactly as Pi ships it.
- Model IDs, limits and capabilities come from Mistral's documentation, the Mistral Vibe source or a live check the owner asked for; cite them in the PR and update the README reasoning table and tests together.
- Tests are hermetic: OAuth tests inject a fake `fetch`, streaming tests use a loopback server. Build credential-shaped strings from parts.
- Never commit API keys, OAuth credentials, Pi auth files or captured requests. Live tests against Mistral spend the owner's subscription quota: never run them unless the owner asks.
- Keep `peerDependencies` at the oldest Pi version that works (`>=0.99.0`) and the Pi dev dependencies on the newest Pi release, so CI tests the newest host. `@types/node` follows the `engines.node` line.
- Commits use the GitHub noreply address `268151429+5omeOtherGuy@users.noreply.github.com` and carry no personal email trailers.

## Focused test

```sh
node --test --import tsx tests/models.test.ts
```
