# AGENTS.md

## Profile
- Purpose: Pi package that adds a Mistral subscription provider with browser sign-in through Mistral AI Studio.
- Stage: released (repository standard 2026-10-18)
- Gate: `npm run check` (CI job `gate`)
- Landing: PR, squash-merged on a green gate; agents land: yes
- Release: `v0.x.y` Git tags with a GitHub Release, cut by hand from `main` after a behaviour change (models, login, provider), not after docs-only merges; `package.json` `version` and the README pinned-install example match the tag; the Release notes are the changelog; `main` stays the default install; agents release: yes (owner 2026-10-23), see [Releasing](#releasing)
- Outside issues and PRs: agents triage; outside PRs merge: owner approves
- Sensitive paths: `src/mistral-oauth.ts`, `src/model-catalog.ts`, `src/models.ts`, `extensions/mistral-subscription/index.ts`, `package.json`, `.npmrc`, `.agents/`, `.githooks/`, `.github/workflows/`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `.secretlintrc.json`, `.gitignore`, `AGENTS.md`

Deliberate deviations from the standard:
- No release workflow or `CHANGELOG.md`: releases are tagged by hand and GitHub Release notes serve as the changelog (owner decision 2026-10-23). npm publication is deferred (issue #1).
- `CONTRIBUTING.md` keeps repository-specific rules: install with `npm ci --ignore-scripts`; cite sources for model IDs and limits and describe unexpected-response handling; never commit keys or captured requests; installation is from GitHub, npm publication is a separate maintainer decision.

## Map
- `extensions/mistral-subscription/index.ts`: Pi entry point; registers the `mistral-subscription` provider and the `/mistral-subscription-status` command.
- `src/models.ts`: local fallback model catalog and the thinking-level to `reasoning_effort` maps.
- `src/model-catalog.ts`: authenticated refresh from Mistral Vibe's `/v1/model-catalog?surface=vibe-code`, with validation and fallback.
- `src/mistral-oauth.ts`: `/login` browser sign-in through Mistral AI Studio, ending in an API key Pi stores.
- `tests/`: `node:test` suites run through `tsx`.
- `.github/workflows/gate.yml`: CI job `gate`; `.githooks/pre-push`: gate before push, refuses pushes to `main`; `.agents/setup`: orb setup.

## Landing
1. Branch `<type>/<slug>` (`<type>/<issue>-<slug>` for an issue) from `origin/main`, one concern per PR.
2. Run `npm run check` (the pre-push hook runs it too).
3. Open a PR with a Conventional Commits title; the body follows `.github/pull_request_template.md`: intent, changed behavior, constraints touched, evidence, whether a sensitive path changed, and `Fixes #n` where it applies.
4. Changes to a sensitive path get an independent review before merge, and so do, listed or not, changes to public interfaces (provider ID, model IDs, login flow, package manifest), security-sensitive code, auth or credential handling, install or setup, CI or release configuration, agent policy files, and docs that change rules or executable instructions. Record the verdict on the PR against the reviewed head commit; a later push needs a new review.
5. When the latest `gate` run on the head commit concluded `success`: `gh pr merge <number> --squash --delete-branch --match-head-commit <sha>`. Report the merge commit.

## Releasing
After merging a PR that changes behaviour (models, login, provider, install), release it; docs-, CI- and test-only merges wait for the next behaviour change.
1. Pick the version: patch for fixes, minor for new features or anything that changes or removes existing behaviour (the project is `0.x`; `1.0.0` is the owner's decision).
2. Land a `chore(release): v0.x.y` PR through the steps above that changes only `version` in `package.json` and `package-lock.json` and the README pinned-install example.
3. On its merge commit: `gh release create v0.x.y --target <merge sha> --title v0.x.y --notes <notes>`. Notes list the user-visible changes since the previous tag with PR numbers and credit outside contributors. Report the release URL.

## Rules
- Use Pi's native `mistral-conversations` API path; no proxy server or custom streaming adapter.
- Model IDs, limits and capabilities come from Mistral's documentation or the Mistral Vibe source; cite them in the PR and update the README model table and tests together.
- The catalog refresh must fall back to the local models on missing credentials, errors, timeouts or unusable responses.
- Tests are hermetic: OAuth tests inject a fake `fetch`, streaming tests use a loopback server. Build credential-shaped strings from parts.
- Never commit API keys, OAuth credentials, Pi auth files or captured requests. Live tests against Mistral spend the owner's subscription quota: never run them unless the owner asks.
- Keep `peerDependencies` at the oldest Pi version that works (`>=0.99.0`) and the Pi dev dependencies on the newest Pi release, so CI tests the newest host. `@types/node` follows the `engines.node` line.
- Commits use the GitHub noreply address `268151429+5omeOtherGuy@users.noreply.github.com` and carry no personal email trailers.

## Focused test
```sh
node --test --import tsx tests/models.test.ts
```
