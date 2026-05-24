# W3KITS

This repository tracks the upstream `danny-avila/LibreChat` codebase for W3Kits
plugin intake work.

## Current status

LibreChat has a local W3Kits package layer at `w3kits-plugin/` for marketplace
intake as a scoped V1 chat surface.

The current upstream shape is a full self-hosted product:

- Node/Express backend under `api/`
- MongoDB as a required database (`MONGO_URI`)
- JWT/session/auth flows
- optional but first-class Redis, Meilisearch, RAG, MCP, and admin surfaces
- multi-user/auth/provider configuration centered on server-side state

That is not a thin `browser-web` plugin and not a low-intrusion
`webcontainer` plugin in the current W3Kits V1 model.

## W3Kits decision

Keep the original upstream product blocked for direct V1 packaging.

Only revisit LibreChat through an explicit scope cut that:

- preserves upstream branding and UI direction
- removes the mandatory MongoDB/Auth/Express product backend
- rebases chat/provider/config persistence onto W3Kits runtime contracts
- uses W3Kits runtime AI access instead of LibreChat server-owned provider keys

## Current W3Kits artifacts

- `core/docs/librechat-v1-scope-cut.md`
- `w3kits-plugin/`
