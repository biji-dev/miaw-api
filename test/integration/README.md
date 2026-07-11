# Integration Tests

Automated HTTP and opt-in live WhatsApp integration tests for Miaw API.

## Prerequisites

1. Install dependencies:
   ```bash
   corepack enable && pnpm install --frozen-lockfile
   ```

2. Build the project:
   ```bash
   pnpm build
   ```

3. For live tests only, a dedicated WhatsApp test number (not your personal number)

## Running Tests

### Live Setup Test

The setup test connects to WhatsApp via QR code:

```bash
MIAW_RUN_LIVE_TESTS=true pnpm test:integration -- setup
```

This will:
1. Start the API server
2. Create a test instance
3. Initiate connection
4. Display QR code (scan with WhatsApp)
5. Wait for successful connection
6. Save session for subsequent tests

### Run All Tests

```bash
pnpm test:integration
```

### Run Specific Test Suite

```bash
# Instance management only
pnpm test:integration -- instance

# Connection tests only
pnpm test:integration -- connection

# Messaging tests only
pnpm test:integration -- messaging
```

## Test Files

| File | Description | Requires Connection |
|------|-------------|---------------------|
| `setup.test.ts` | Initial QR pairing | Yes (manual) |
| `instance-management.test.ts` | Instance CRUD operations | No |
| `connection.test.ts` | Connect/disconnect/status | Optional |
| `messaging.test.ts` | Send text messages | Yes |

## Test Configuration

Edit `test/integration/fixtures/data.ts` to configure:

- `TEST_CONTACT_A`: First test contact phone number
- `TEST_CONTACT_B`: Second test contact phone number
- Timeouts and connection settings

## Notes

- Tests marked with `it.skip` require manual WhatsApp connection
- The interactive setup suite only runs when `MIAW_RUN_LIVE_TESTS=true`
- Session persists in `./test-sessions/`
- Re-run setup test if session expires
- Some tests are skipped automatically if instance is not connected

## Troubleshooting

**QR timeout**: Re-run setup test and scan faster

**Session expired**: Delete `./test-sessions/` and re-run setup test

**Connection fails**: Check network, verify phone number format
