# Miaw API Testing Guide

**Last updated:** 2026-07-12

Miaw API uses Vitest. Automated tests do not require a WhatsApp account; live
protocol scenarios are opt-in.

## Prerequisites

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

## Unit and contract tests

```bash
pnpm test:unit
pnpm test:watch
pnpm test:coverage
```

Unit tests cover configuration, authentication, error handling, webhook
delivery, instance lifecycle/event forwarding, and route-to-core contracts.
Route tests mock `miaw-core` and use Fastify injection.

Use Vitest imports in new tests:

```ts
import { describe, expect, it, vi } from 'vitest';
```

## Automated integration tests

```bash
pnpm test:integration
pnpm test:integration -- instance-management
pnpm test:integration -- messaging
```

The integration helper starts and stops the Fastify server itself. Test files
run serially to avoid sharing ports and session state. WhatsApp-dependent cases
are marked skipped; the remaining HTTP, validation, authentication, webhook,
and lifecycle scenarios are suitable for CI.

Current baseline:

- 127 unit/contract tests.
- 93 automated integration tests.
- 265 explicitly skipped live scenarios.

## Live WhatsApp tests

Use a dedicated WhatsApp account, never a personal production account.

```bash
MIAW_RUN_LIVE_TESTS=true pnpm test:integration -- setup
```

The setup suite creates `integration-test-bot`, starts a local webhook receiver,
and waits for QR pairing. Pairing-code authentication can instead be exercised
through instance `clientOptions.usePairingCode` and the protected
`GET /instances/:id/auth/pairing-code` endpoint.

Configure real test contacts in `test/integration/fixtures/data.ts`. Sessions
are stored under `./test-sessions` and are ignored by Git.

## Recommended CI checks

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test:unit
pnpm test:integration
```

Do not enable `MIAW_RUN_LIVE_TESTS` in ordinary CI. Live tests depend on manual
pairing, WhatsApp availability, network conditions, and rate limits.

## Troubleshooting

| Problem | Resolution |
| --- | --- |
| Port 3000 is occupied | Stop the other API process; integration tests need the port |
| Webhook test port is occupied | The test helper automatically falls back to an ephemeral port |
| Pairing challenge expires | Restart the instance connection and request the protected challenge endpoint again |
| Session is invalid | Remove `./test-sessions` and repeat the live setup |
| WhatsApp throttles requests | Stop the test run and retry later with fewer live operations |
| Frozen install fails | Run `pnpm install`, inspect the lockfile diff, and commit it with the dependency change |

## Adding tests for a core upgrade

1. Add or update a mocked method on the route-contract client.
2. Assert the HTTP handler sends the exact argument shape required by core.
3. Test request validation and missing-instance/not-connected behavior.
4. Add event-forwarding coverage for every new core event.
5. Add a live scenario only when a mocked contract cannot verify protocol behavior.
