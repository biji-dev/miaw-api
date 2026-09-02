# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.1] - 2026-09-03

Everything here was found by running 2.2.0's proxy features against a real
10-proxy pool instead of mocks.

### Added

- **`pnpm test:proxies`** — checks a real proxy pool end to end: every entry
  parses, each one reaches WhatsApp, and traffic genuinely egresses through it
  rather than falling back to a direct connection. It compares each proxy's exit
  IP against the host's real one and exits non-zero on an unreachable proxy or a
  leak, so it can gate a deploy. SOCKS entries are flagged because their media
  downloads bypass the proxy. Passwords are never printed.
- `proxies.live.example.txt` documents the pool format. Real pools live in
  `proxies.live.txt`, which is gitignored along with any `proxies.*.txt`.

### Fixed

- **An unresolvable proxy label returned `500`.** `mapInstanceProxyError` had no
  case for pool-resolution failures, so naming a label the pool cannot satisfy
  produced "An unexpected error occurred" instead of a message identifying the
  cause. It is now a `400` carrying that message, which names the fix and
  contains no credentials.
- **The proxy log lines always reported `persisted: false`.** Both
  "Instance proxy replaced" and "Instance restored from store" called
  `describeProxy()` without its `persisted` argument, so the logs contradicted
  the API response for every stored assignment.
- **Integration tests could collide on instance ids.** `test-${Date.now()}` is
  not unique — two calls in the same millisecond return the same id. A test that
  minted one id in `beforeEach` and another in its body reused the first instance
  whenever the intervening work took under a millisecond; the duplicate create
  returned an unasserted `409` and the assertion then ran against the wrong
  instance. This produced an intermittent failure in the webhook suite. Ids now
  come from a counter-backed `uniqueInstanceId()` helper.

## [2.2.0] - 2026-09-03

Per-instance proxies become settable at connect time, visible across the fleet,
changeable on a live instance, and durable across restarts. All four land on
existing routes, so the route contract is unchanged.

### Added

- **A proxy can be set in the connect call.** `PUT /instances/:id/connection`
  and `POST /instances/:id/connection-restarts` take an optional body carrying
  `proxy`, applied before the socket opens so a pairing comes from its final
  egress IP. Sending no body connects the instance unchanged, exactly as before.
- **The effective proxy appears in instance state.** `GET /instances` and
  `GET /instances/:id` report `source`, masked `url`, `protocol`,
  `downloadProxied`, `active`, `appliesOnNextConnect`, `persisted` and
  `liveProxy`, computed on read so it cannot go stale.
- **`force` swaps a proxy on a live instance**, on `PUT /instances/:id/proxy`
  and `DELETE /instances/:id/proxy?force=true`. Without it the endpoints still
  return `409`. Changing a paired session's egress IP is read by WhatsApp as
  account takeover, so this is for a dead proxy, not routine rotation.
- **Instances and their proxies persist** to `<SESSION_PATH>/instances.json` and
  are restored at boot. This is the file `miaw-cli instance set-proxy` writes,
  and the two tools preserve each other's fields. Written `0600` via atomic
  temp-and-rename, with a write mutex the CLI's own store does not have, because
  a REST API serves concurrent writes. `RESTORE_AUTOCONNECT=true` connects
  restored instances sequentially at boot; the default is not to connect them.
- **Credential-free assignments.** `{"label":"eu"}` references a `label=` entry
  in `MIAW_PROXY_FILE` and stores no credentials, so rotating a proxy password
  touches only the pool file.
- `validate: true` probes a proxy for reachability before applying it, returning
  `400` when it cannot be reached. Off by default, so connect latency is unchanged.
- New `INSTANCE_STORE_FILE` and `RESTORE_AUTOCONNECT` environment variables.

### Changed

- Upgraded to `miaw-core` ^1.12.1.
- **Changing a proxy no longer rebuilds the `MiawClient`.** It uses core 1.11's
  `setProxy()`, following core's failover recipe: disconnect, then stage, then
  connect. Staging before the teardown would let an auto-reconnect fire on the
  old egress, and reusing the client avoids two writers on one auth state. The
  rebuild path survives only for core's custom-agent refusal.
- Proxy resolution now consults the stored assignment between an explicit
  `clientOptions.proxy` and the pool. `MIAW_PROXY` remains deliberately unread:
  a cluster-wide value would silently outrank every per-instance assignment.
- A corrupt `instances.json` fails startup rather than being treated as empty,
  which would connect every instance directly and leak the egress IP the
  assignments exist to hide.

### Fixed

- `proxy: null` was rejected as an invalid proxy. Fastify runs AJV with
  `coerceTypes`, and the string branch of the proxy schema coerced null to `""`
  before validation saw it. The null branch now comes first, with a code-level
  guard so a future schema edit cannot reintroduce it.

## [2.1.0] - 2026-07-30

### Added

- Safe proxy-pool configuration, watched reloads, masked pool status, and
  fixed-target proxy testing endpoints.
- Disconnected-only per-instance proxy replacement that preserves the instance
  identity, session path, webhooks, event listeners, and client settings.

### Changed

- Upgraded to `miaw-core` ^1.10.0, including its proxied media handling,
  credential-safe errors, rotation strategies, and `socks4a`/`socks5h` support.
- Raised the Node.js runtime requirement to >=20.18.1.

### Fixed

- Retained the pairing-code retry workaround required by core 1.10.0.

## [2.0.0] - 2026-07-29

### Changed

- Added the central `/api/v1` prefix to every protected route and standardized
  the instance path parameter as `instanceId`.
- Replaced command-style and body-identified operations with resource-oriented
  paths, path identifiers, query lookup hints, and consistent HTTP methods.
- Split generic message, contact, label, catalog, group, community, business,
  newsletter, and LID operations into the canonical v2 resource families.
- Standardized successful responses as `{success:true,data:T}` and collections
  as `{success:true,data:{items,total}}`.
- Generalized core operation validation so `success:false` becomes HTTP 400 and
  successful core results do not expose nested `data.success`.

### Removed

- Removed all 1.x compatibility aliases, including `/send-text`, `/send-media`,
  `/connect`, `/disconnect`, `/status`, body-based message operations, and
  command-style contact and LID routes.

### Testing

- Added an authoritative route manifest, removed-route 404 checks, OpenAPI
  normalization checks, envelope and creation-status assertions, and canonical
  integration/live test coverage.

## [1.2.1] - 2026-07-29

### Fixed

- Retried pairing-code retrieval after the WhatsApp socket handshake, working
  around `miaw-core` 1.9.1's premature initial request.
- Mapped failed chat mutations to `400 INVALID_REQUEST` instead of returning a
  misleading HTTP 200 response with an inner `success: false` result.
- Kept the automated integration harness isolated from ambient environment
  credentials while allowing live runs to use a dedicated session directory.

### Testing

- Added an environment-only QR/pairing-code live release suite with fail-fast
  destructive-test safeguards and capability reporting.
- Expanded the isolated live suite to reuse persisted sessions and verify real
  text/media/location/contact/poll delivery, profile/contact/chat reads,
  presence, runtime and LID controls, group cleanup, reconnects, webhooks, and
  structured account-capability reporting.

## [1.2.0] - 2026-07-12

### Added

- Full HTTP coverage for `miaw-core` 1.9.1 rich messages, chat operations,
  statuses, business extras, communities, LID operations, and runtime controls.
- Pairing-code and per-instance proxy/client configuration, with protected QR
  and pairing-code challenge endpoints.
- Webhooks for `pairing_code`, `poll_vote`, `message_receipt`, and
  `session_saved`, including disconnect status codes.

### Changed

- Migrated the API runtime and TypeScript build to native ESM/NodeNext.
- Corrected the dependency to npm-published `miaw-core ^1.9.1`, removed the
  unused direct Baileys dependency, and regenerated the pnpm lockfile.
- Existing message operations now resolve stored `MiawMessage` objects before
  invoking core; legacy generic media requests dispatch to typed media methods.

### Fixed

- Replaced obsolete core calls for group participants/admins, profiles,
  products, newsletters, reactions, forwarding, editing, and deletion.
- Prevented duplicate ready/disconnected webhooks and masked proxy credentials
  in operational responses.

### Documentation

- Replaced the legacy phase plan and test documents with current roadmap,
  automated/live testing, and release-check guidance.
- Added an API guide covering authentication, instance options, route groups,
  media/message references, webhooks, and error envelopes.
- Updated README, security examples, error-code examples, Docker, and Compose
  configuration for ESM, pnpm, and the current endpoint/environment contracts.

## [1.1.0] - 2026-07-09

### Added

- `PATCH /instances/:id` — update an instance's `webhookUrl` and/or
  `webhookEvents` without recreating it (the WhatsApp session is preserved).
- OpenAPI `securitySchemes` (Bearer token + `X-API-Key`) with a global security
  requirement, so the Scalar `/docs` UI renders a central Authentication panel —
  enter the API key once instead of on every request.

### Changed

- **BREAKING (config)**: dropped the generic `API_` prefix on server env vars —
  `API_PORT` → `PORT`, `API_HOST` → `HOST`, `API_WEBHOOK_SECRET` →
  `WEBHOOK_SECRET` (`API_KEY` unchanged). Aligns `PORT`/`HOST` with common PaaS
  conventions.
- Renamed webhook config env vars to match the code: `WEBHOOK_TIMEOUT` →
  `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_RETRY_DELAY` → `WEBHOOK_RETRY_DELAY_MS`.
- Intended to bump `miaw-core`; the published synchronization is completed in
  the Unreleased section with `^1.9.1`.

### Fixed

- `.env` was never loaded (no `dotenv` / no `--env-file`), so configuration
  silently fell back to defaults. Added `--env-file-if-exists=.env` to the
  `start`/`dev:start` scripts (native Node, no dotenv dependency).
- Removed a debug `console.log` that leaked `apiKey`/`webhookSecret` to stdout
  on startup.

### Documentation

- Documented all 11 webhook events (was 6) and the `webhookEvents` whitelist
  behaviour.
- Corrected the Swagger URL to `/docs` and env var names across README and docs.

## [1.0.0] - 2025-01-21

### Added

#### Core Features
- **Instance Management**: Full CRUD operations for WhatsApp instances
- **Messaging**: Send text, images, videos, audio, documents, and stickers
- **Message Operations**: Edit, delete, forward messages, and send reactions
- **Contact Management**: Validate phone numbers, check WhatsApp registration, get contact info
- **Group Management**: Create groups, manage participants, update settings, get invite links
- **Profile Management**: Update display name, status, and profile picture
- **Presence**: Typing indicators, read receipts, online/offline status
- **Business Features**: Labels management, catalog operations, newsletter support

#### API Infrastructure
- RESTful API built on Fastify 5.x
- Swagger/OpenAPI documentation at `/docs`
- Scalar API reference
- CORS support with configurable origins

#### Webhook System
- Event-driven webhooks for real-time notifications
- HMAC-SHA256 signature verification with timestamps
- Replay attack prevention (5-minute window)
- Automatic retry with exponential backoff
- Configurable events per instance

#### Security
- API key authentication (Bearer token or X-API-Key header)
- Timing-safe API key comparison to prevent timing attacks
- Audit logging for authentication failures
- Webhook signature verification
- Configuration validation with security warnings

#### Error Handling
- Consistent error response format with correlation IDs
- Custom error classes: `UnauthorizedError`, `BadRequestError`, `NotFoundError`, `ConflictError`, `ServiceUnavailableError`, `ValidationError`
- Centralized error handler with internal error detail protection

#### Testing
- Unit test suite with Vitest (108 tests)
- Integration test suite (14 test files)
- Code coverage with v8 provider (>80% threshold)

#### Documentation
- [API Documentation](docs/API.md) - Complete endpoint reference
- [Security Guide](docs/SECURITY.md) - Production deployment security
- [Error Codes Reference](docs/ERROR-CODES.md) - All error codes with resolution steps
- [Implementation Roadmap](docs/ROADMAP.md) - Development phases

### API Endpoints

| Category | Endpoints |
|----------|-----------|
| Instances | `GET /instances`, `POST /instances`, `GET /instances/:id`, `DELETE /instances/:id` |
| Connection | `POST /instances/:id/connect`, `POST /instances/:id/disconnect`, `POST /instances/:id/restart`, `GET /instances/:id/status`, `GET /instances/:id/qr` |
| Messaging | `POST /instances/:id/messages/text`, `POST /instances/:id/messages/media`, `PUT /instances/:id/messages/:messageId`, `DELETE /instances/:id/messages/:messageId`, `POST /instances/:id/messages/:messageId/react`, `POST /instances/:id/messages/forward` |
| Contacts | `POST /instances/:id/contacts/check`, `GET /instances/:id/contacts/:jid`, `GET /instances/:id/contacts/:jid/profile-picture`, `GET /instances/:id/contacts` |
| Groups | `POST /instances/:id/groups`, `GET /instances/:id/groups/:groupId`, `PUT /instances/:id/groups/:groupId`, `DELETE /instances/:id/groups/:groupId/leave`, `POST /instances/:id/groups/:groupId/participants`, `DELETE /instances/:id/groups/:groupId/participants`, `PUT /instances/:id/groups/:groupId/participants/admin`, `GET /instances/:id/groups/:groupId/invite-code`, `POST /instances/:id/groups/:groupId/invite-code/revoke`, `GET /instances/:id/groups` |
| Profile | `PUT /instances/:id/profile/name`, `PUT /instances/:id/profile/status`, `PUT /instances/:id/profile/picture`, `GET /instances/:id/profile` |
| Presence | `POST /instances/:id/presence/typing`, `POST /instances/:id/presence/recording`, `POST /instances/:id/presence/read`, `POST /instances/:id/presence/online`, `POST /instances/:id/presence/offline` |
| Webhooks | `GET /instances/:id/webhooks`, `PUT /instances/:id/webhooks`, `POST /instances/:id/webhooks/test` |
| Business | `GET /instances/:id/labels`, `POST /instances/:id/labels`, `PUT /instances/:id/labels/:labelId`, `DELETE /instances/:id/labels/:labelId`, `POST /instances/:id/labels/:labelId/chats`, `DELETE /instances/:id/labels/:labelId/chats`, `GET /instances/:id/catalog`, `GET /instances/:id/newsletters`, `POST /instances/:id/newsletters/:newsletterId/follow`, `POST /instances/:id/newsletters/:newsletterId/unfollow`, `POST /instances/:id/newsletters/:newsletterId/mute`, `POST /instances/:id/newsletters/:newsletterId/unmute` |
| Data | `GET /instances/:id/chats` |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `API_KEY` | `miaw-api-key` | API authentication key |
| `WEBHOOK_SECRET` | `webhook-secret` | Webhook signature secret |
| `WEBHOOK_TIMEOUT` | `10000` | Webhook request timeout (ms) |
| `WEBHOOK_MAX_RETRIES` | `5` | Max webhook retry attempts |
| `WEBHOOK_RETRY_DELAY` | `1000` | Base retry delay (ms) |
| `SESSION_PATH` | `./sessions` | Session storage directory |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

### Dependencies

- **miaw-core** v1.9.1 - WhatsApp Web API wrapper
- **fastify** v5.2.0 - Web framework
- **@fastify/swagger** v9.0.0 - OpenAPI documentation
- **@scalar/fastify-api-reference** v1.40.9 - API reference UI
- **pino** v8.19.0 - Logging

### Requirements

- Node.js >= 18.0.0
- pnpm (recommended) or npm

---

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (instance CRUD, basic messaging) | ✅ |
| 2 | Core Messaging (media, edit, delete, reactions) | ✅ |
| 3 | Contacts & Validation | ✅ |
| 4 | Group Management | ✅ |
| 5 | Profile Management | ✅ |
| 6 | Presence & UX | ✅ |
| 7 | Webhook Enhancements | ✅ |
| 8 | Business Features | ✅ |
| 9 | Basic GET Operations | ✅ |
| 10-14 | Reserved for future features | - |
| 15 | Polish & Testing | ✅ |

---

## License

MIT
