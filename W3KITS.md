# W3KITS

This repository tracks the upstream `danny-avila/LibreChat` codebase for W3Kits
plugin intake work.

## Current status

LibreChat is kept as an upstream self-hosted product. W3Kits does not publish a
custom `w3kits-plugin` browser UI for LibreChat, because that misrepresents the
upstream application and diverges from the official runtime model.

The upstream shape is a full self-hosted product:

- Node/Express backend under `api/`
- MongoDB as a required database (`MONGO_URI`)
- JWT/session/auth flows
- optional but first-class Redis, Meilisearch, RAG, MCP, and admin surfaces
- multi-user/auth/provider configuration centered on server-side state

That is not a thin `browser-web` plugin and not a low-intrusion
`webcontainer` plugin in the current W3Kits browser runtime.

## W3Kits decision

LibreChat remains visible in the marketplace as a local-only upstream listing
with source, upstream version, and license metadata, but it is not installable
until a real self-hosted LibreChat service is deployed and wired into W3Kits.

Only revisit runnable LibreChat integration through a self-hosted plan that:

- uses upstream LibreChat UI and server runtime
- keeps MongoDB/session/provider state on the self-hosted service
- configures W3Kits OpenAI-compatible access through server-side configuration
- avoids replacing upstream UI with a custom W3Kits chat surface
