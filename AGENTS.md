# AGENTS.md — dsh-device-status

Official-dsh **web** plugin (Cordis bundle + better-sidebar tab). Read-only host machine status view. Not part of `dsh-tianshu-build`.

## Do

- Dual-half like `dsh-git-remotes` / `dsh-sidebar-qa`: host `lib/index.js`, client `lib/client.js` + `lib/client-registry.js`.
- Collect status with Node `os` / `fs.statfs` only — no shell, no child processes, no native addons.
- CPU usage = delta between `snapshotCpuTimes()` samples; return `null` when it cannot be judged, never a fake number.
- Keep the trust fence (`isTrustedApiRequest` + POST + `application/json`) on every route.
- Keep `contributes.tools` empty.

## Don't

- Don't register a model tool — this tab is for humans; the agent does not need host vitals.
- Don't add mutations: this plugin is a read-only view, there is nothing to confirm.
- Don't depend on `dsh-better-sidebar` as a hard runtime package — optional peer; client `inject = ['betterSidebar']`.
- Don't import `@deepseek-ai/*` values in the client bundle (purity gate).
- Don't replace better-sidebar's other tabs (Git, QA, …).
- Don't mix another product into this repo.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
```
