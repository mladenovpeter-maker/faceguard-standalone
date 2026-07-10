---
name: Zod v3 error param incompatibility
description: face-guard (and likely other artifacts using catalog:zod) resolve to zod v3, which does not support the v4-style `{ error: "..." }` constructor param.
---

The `zod` package pinned via the workspace catalog resolves to v3.x in at least the face-guard artifact, not v4. Code copied from zod v4 examples/docs using `z.coerce.number({ error: "..." })` or `z.enum([...], { error: "..." })` fails TypeScript with TS2353 ("'error' does not exist in type").

**Why:** zod v3's `RawCreateParams` only accepts `errorMap`, `invalid_type_error`, `required_error`, `message`, `description` — no `error` key (that's v4's unified API).

**How to apply:** When adding validation, use `required_error`/`invalid_type_error` or just rely on chained `.min()/.max()` messages instead of the `error` param. Before assuming zod v4 syntax works in a given artifact, check `node -e "console.log(require('zod/package.json').version)"` from that artifact's directory.
