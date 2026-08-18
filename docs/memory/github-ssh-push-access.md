---
name: github-ssh-push-access
description: "This Mac has SSH push access to antoinem78's GitHub repos (key added 2026-07-17)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
---

An ed25519 SSH key at `~/.ssh/id_ed25519` is registered on the founder's GitHub account (antoinem78), added 2026-07-17. Push over SSH works for their repos: `app-wmi` (Rexos), `kst-accountants-site` (KST client site, Next.js/Vercel, auto-deploys on push to main), `ppcmastery`. No `gh` CLI and no HTTPS token on this machine — always use `git@github.com:` remotes.

**Why:** the founder logs into GitHub via Google SSO (no password/PAT), so HTTPS auth was a dead end; the key was the durable fix.

**How to apply:** push client-site fixes directly (main auto-deploys — treat kst-accountants-site pushes as production deploys). For Rexos (`app-wmi`), production serves 17 live ad clients: use preview branches (e.g. [[rexos-phase15-preview-branch]]), never push main without an explicit ask.
