# Miaw API Integration Test Plan

**Status:** Active
**Last updated:** 2026-07-12

## Objectives

The integration suite verifies the compiled API contract around instance
management, validation, authentication, webhooks, and every established route
group without requiring WhatsApp for the default run. Protocol-dependent
behavior is isolated as an opt-in live layer.

## Test layers

| Layer | Command | External WhatsApp account |
| --- | --- | --- |
| Unit and route contracts | `pnpm test:unit` | No |
| Automated HTTP integration | `pnpm test:integration` | No |
| Live pairing/protocol | `MIAW_RUN_LIVE_TESTS=true pnpm test:integration -- setup` | Yes |

## Automated coverage

- Server health, startup, authentication, and instance CRUD.
- JSON Schema failures and standardized error responses.
- Connection state and disconnected-instance behavior.
- Message, contact, group, profile, presence, business, newsletter, product,
  session, and basic-data endpoints that do not require a connected socket.
- Webhook configuration, signing, delivery, retry statistics, filtering, and
  dynamic URL updates.
- Route contracts for rich messages, statuses, chats, communities, business
  extras, runtime controls, LID operations, and pairing configuration.

## Live coverage

- QR and pairing-code authentication.
- Reconnect using a persisted session.
- Actual sends, receipts, poll votes, media downloads, presence, group and
  community mutations, newsletters, catalogs, and business-only operations.

Live tests must use dedicated accounts and test data. They must not be enabled
on pull-request CI.

## Test environment

The integration helper sets the API server to `127.0.0.1:3000`, creates an
isolated `InstanceManager`, and shuts down the manager and webhook dispatcher on
server close. Local webhook receivers start at port 3001 and fall back to an
ephemeral port if necessary.

Relevant values:

```bash
API_KEY=test-api-key-for-integration-tests
WEBHOOK_SECRET=test-webhook-secret
SESSION_PATH=./test-sessions
LOG_LEVEL=error
```

## Acceptance criteria

- Frozen dependency installation succeeds.
- TypeScript and ESLint pass before integration execution.
- All non-skipped unit and integration tests pass with no unhandled errors or
  leaked server handles.
- Live failures are reported separately and never hidden by automated skips.
- New core methods have route-contract tests before release.
- New webhook events have filtering and payload-forwarding tests.

## Current baseline

| Metric | Result |
| --- | --- |
| Unit/contract tests | 127 passing |
| Automated integration tests | 114 passing |
| Explicitly skipped live scenarios | 217 |
| OpenAPI paths exercised by startup generation | 126 |

## Release execution

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test:unit
pnpm test:integration
```

When core protocol behavior changed:

```bash
MIAW_RUN_LIVE_TESTS=true pnpm test:integration -- setup
```
