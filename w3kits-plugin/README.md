# W3Kits LibreChat Plugin

Thin W3Kits plugin package extracted from the LibreChat chat surface.

V1 scope:

- single-user chat shell
- shared W3Kits locale bootstrap
- W3Kits runtime-session AI calls
- conversation state in plugin storage
- optional markdown export into the shared desktop VFS

Out of scope:

- LibreChat MongoDB / Express backend
- LibreChat auth, admin, balances, search, agents, MCP, RAG, and multi-user flows
- direct provider-key ownership inside the plugin

Build:

```bash
node scripts/prepare-dist.mjs
```
