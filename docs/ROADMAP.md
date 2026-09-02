# Miaw API Roadmap

**Current API version:** 2.1.0
**Core compatibility:** `miaw-core` 1.10.0
**Last updated:** 2026-07-30

## Current state

Miaw API is a Fastify REST wrapper for the HTTP-serializable `miaw-core` API.
The synchronization through core 1.10.0 is complete on the current feature
branch. The API uses native ESM, pnpm, JSON Schema validation, OpenAPI at
`/documentation/json`, and Scalar documentation at `/docs`.

All protected routes start with `/api/v1/instances/:instanceId`; health and
generated documentation remain unversioned.

## Delivered milestones

| Milestone | API release | Status | Main capabilities |
| --- | --- | --- | --- |
| Foundation | 0.1.0–0.9.0 | Complete | Instances, connections, messaging, contacts, groups, profiles, presence, webhooks, business data |
| Core gap fill | 0.10.0–0.15.0 | Complete | Contact writes, media/message operations, newsletters, products, sessions and statistics |
| Production baseline | 1.0.0 | Complete | Error handling, security documentation, unit and integration suites |
| Configuration and OpenAPI | 1.1.0 | Complete | Runtime environment fixes, webhook patching, documented API-key security |
| `miaw-core` 1.9.1 synchronization | 1.2.0 | Complete | ESM, pairing/proxy options, rich messages, chats, statuses, business extras, communities, LID operations, latest events |
| API-wide endpoint normalization | 2.0.0 | Complete | Central version prefix, resource-oriented routes, uniform envelopes, route manifest and breaking-route checks |
| `miaw-core` 1.10.0 safe proxy management | 2.1.0 | Complete | Watched proxy pools, masked status/test endpoints, and disconnected-only client proxy replacement |
| `miaw-core` 1.12.1 sync and durable per-instance proxies | 2.2.0 | Complete | Connect-time proxy assignment, fleet-wide proxy visibility, forced live swaps via `setProxy()`, and a persistent store shared with `miaw-cli` |

## Current capability coverage

### Instances and authentication

- Instance CRUD, connect/disconnect/restart, logout, dispose, and session clear.
- QR and pairing-code authentication with protected challenge retrieval.
- Per-instance reconnect, timeout, history-sync, browser identity, and proxy options.
- Runtime debug/sync toggles and masked proxy inspection.
- Per-instance proxies set at creation, at connect time, or on a live instance,
  persisted across restarts and interoperable with `miaw-cli instance set-proxy`.

### Messaging and chats

- Text, image, video, audio, document, sticker, location, contacts, and polls.
- Replies resolved from stored messages and group mentions.
- Edit, delete, delete-for-me, react, forward, star, download, and history load.
- Archive, pin, mute, read/unread, clear, and delete chat.
- Text, image, and video status stories with audience selection.

### Contacts, groups, communities, and profiles

- Contact validation, profile/business lookup, profile picture, and contact writes.
- Full group participant, admin, metadata, picture, and invite operations.
- Community lifecycle, linked groups, members/admins, and invite operations.
- Own profile picture, name, and About/status management.

### Business and newsletters

- Labels and chat/message label assignments.
- Product catalogs, collections, and product CRUD.
- Newsletter lifecycle, messaging, subscription, profile, reaction, and admin operations.
- Business profile, opening hours, cover photos, order details, and quick replies.

### Events and operations

- Signed webhook delivery with retries, statistics, and event filtering.
- Core events include message receipts, poll votes, pairing codes, and session saves.
- LID cache inspection, manual mapping, clearing, batch resolution, and reverse lookup.

## Quality status

- TypeScript build and ESLint pass.
- 250 unit/contract tests pass.
- 114 automated integration scenarios pass.
- 217 WhatsApp-dependent scenarios remain explicitly skipped unless a live test
  account is paired.
- Generated OpenAPI currently contains 103 paths.

## Next priorities

The API runs on core 1.12.1, but only its proxy surface is exposed. The 2.2.0
release deliberately scoped out the ~37 non-proxy methods core added in 1.12.0.

1. **Expose the `miaw-core` 1.12.0 feature backlog.** Privacy settings,
   blocklist, calls (including the new `call` event), group and community
   administration, disappearing messages, group-invite cards, pin-in-chat, and
   `BrowserPresets`. Roughly 40 new routes, so it deserves its own release.
2. Add contract tests whenever a core method or event is added.
3. Extend pagination to high-volume collections while preserving the v2
   `{success,data}` and `{items,total}` envelopes.
4. Add opt-in rate limiting and request-size controls for public deployments.
5. Evaluate multipart uploads separately; current media inputs intentionally
   accept HTTP(S) URLs only.
6. Cross-process locking for `instances.json` if the API is ever run as more
   than one replica against one session volume. Writes are serialized within a
   process, but two processes remain last-writer-wins.

## Deferred or out of scope

- Custom logger, WebSocket agent, and fetch dispatcher injection are not
  representable safely over REST.
- Local filesystem media paths and multipart uploads are not accepted.
- Live WhatsApp tests require a dedicated account and remain opt-in.
- Core features not yet implemented by `miaw-core` are tracked in the core
  repository rather than duplicated here.

## Release checklist

1. Confirm the npm `miaw-core` version and regenerate `pnpm-lock.yaml`.
2. Run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm lint`.
3. Run `pnpm test:unit` and `pnpm test:integration`.
4. Generate `/documentation/json` and inspect new or changed contracts.
5. Update `README.md`, `docs/API.md`, this roadmap, and `CHANGELOG.md`.
6. Run live tests with `MIAW_RUN_LIVE_TESTS=true` when protocol behavior changed.
