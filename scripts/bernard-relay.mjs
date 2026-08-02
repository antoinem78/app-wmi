#!/usr/bin/env node
// Thin wrapper kept for compatibility: the real client is agent-relay.mjs,
// which serves both Bernard and Oscar.
process.argv.splice(2, 0, "bernard");
await import("./agent-relay.mjs");
