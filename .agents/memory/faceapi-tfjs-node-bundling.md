---
name: face-api.js + tfjs bundling in Node/esbuild
description: How to get @vladmandic/face-api running server-side in a Node+esbuild project without native binding crashes.
---

Use `@tensorflow/tfjs` (pure JS) instead of `@tensorflow/tfjs-node` for server-side face-api.js usage. `tfjs-node`'s native binding is fragile and can crash on version mismatches with the Node runtime.

Import face-api's `esm-nobundle` build, and explicitly force the tfjs backend to `"cpu"` (`tf.setBackend("cpu").then(() => tf.ready())`) before use — otherwise it may try to auto-init a wasm backend and fail because the `.wasm` binary isn't resolvable in a bundled context.

In esbuild config, do NOT put `@vladmandic/face-api` or `@tensorflow/tfjs*` in the `external` list — they must be bundled. Node's strict ESM loader can't resolve their extensionless internal imports when left as external/unbundled runtime requires. `@tensorflow/tfjs-backend-wasm` should still be installed as a real dependency so face-api's static import of it resolves at bundle time, even though the wasm backend is never actually initialized.

**Why:** This combination was the result of debugging a native-binding version-mismatch crash (tfjs-node) followed by an ESM-resolution crash (externalized face-api/tfjs) followed by a wasm-init crash (missing .wasm binary) — each fix surfaced the next issue.

**How to apply:** Any time face-api.js or tfjs is added to a server bundled with esbuild in this kind of Node/ESM project.
