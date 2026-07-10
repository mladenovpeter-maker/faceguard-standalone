---
name: Standalone repo export from pnpm monorepo
description: How to extract one artifact + its lib deps into a fully independent git repo/package, and push it to GitHub via the connector.
---

To turn one artifact (e.g. a web app + API) into a standalone repo instead of just documenting a Docker build against the monorepo:
- Copy only the artifact dirs and the specific `lib/*` packages it imports (check via grep for `@workspace/` imports) into a new top-level folder — skip unrelated libs (e.g. `api-spec`, which is only a codegen-time dependency, not a runtime one).
- Package **names** in each copied `package.json` (`@workspace/db`, etc.) must stay the same as the original, since `workspace:*` resolution is by name, not directory — only top-level directory names need to change.
- Copy `pnpm-workspace.yaml`'s `catalog:` block as-is into the new repo's own `pnpm-workspace.yaml`; catalog protocol works standalone as long as the file exists at the new root.
- Keep the same relative nesting depth for `tsconfig.json` `references` (e.g. one level: `repo-root/{server,client,lib/x}`) so `../../` style paths don't need editing.
- pnpm workspace `--filter` in scripts must use the package `name` field (`@workspace/api-server`), not the directory name — `--filter server` silently matches nothing ("No projects matched").
- Verify by running `pnpm install` + `pnpm run typecheck` inside the new folder before pushing, to catch any missed lib copy or path break.

**Why:** the user wanted a truly independent GitHub repo they can hand off/deploy on its own, not a build that still depends on cloning the whole monorepo.

**How to apply:** when asked to "put X in its own repo" or "make a standalone copy to push to GitHub", prefer this real-copy approach over just documenting `docker build --context ..` against the monorepo.

For pushing: use the `github` connector (`searchIntegrations`/`proposeIntegration`/`listConnections('github')`), create the repo via the GitHub REST API with the connection's `access_token`, then push with a `https://x-access-token:<token>@github.com/...` remote URL — and immediately run `git remote set-url` afterward to strip the token back out of `.git/config` so it isn't left on disk in plaintext.
