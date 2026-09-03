---
name: meta-token-lives-in-n8n-execution-data
description: Graph API echoes the access token inside paging.next, so every n8n execution that read a paginated Meta endpoint with query auth holds the system-user token in plaintext; execution data is a credential store
metadata:
  type: feedback
---

Found 2026-09-03 while capturing n8n execution outputs as test fixtures: the `Meta change history` node's stored output carried `paging.next`, a full Graph URL with `access_token=EAA...` in it. The Meta system-user token was sitting in n8n's execution history for every optimise run, and in any file that copies an execution verbatim.

**Why:** the Meta credential is `httpQueryAuth`, so the token travels as a query parameter, and Graph writes the same query string back into `paging.next` and `paging.previous`. n8n stores node outputs in full. Nothing leaked outside n8n, but execution data is readable by anyone with n8n access, and it is exactly what gets pasted into chats, tickets and fixtures.

**How to apply:** treat any verbatim Graph response as a credential until `paging` is stripped. Fixture builders and debug dumps strip `paging` recursively and scan for `EAA[A-Za-z0-9]{20,}` before writing. Prefer sending the Meta token as a header (`Authorization: Bearer`) over query auth for new nodes, because then paging.next carries no token. Rotating the token does not fix historic executions; pruning them does. See also [[one-shared-key-authenticates-everything]].
