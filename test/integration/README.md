# Integration Tests

Phase 1 integration tests for Miaw API.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. A dedicated WhatsApp test number (not your personal number)

## Running Tests

### Setup Test (Run First)

The setup test connects to WhatsApp via QR code:

```bash
npm run test:integration -- setup
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
npm run test:integration
```

### Run Specific Test Suite

```bash
# Instance management only
npm run test:integration -- instance

# Connection tests only
npm run test:integration -- connection

# Messaging tests only
npm run test:integration -- messaging
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
- Session persists in `./test-sessions/`
- Re-run setup test if session expires
- Some tests are skipped automatically if instance is not connected

## Troubleshooting

**QR timeout**: Re-run setup test and scan faster

**Session expired**: Delete `./test-sessions/` and re-run setup test

**Connection fails**: Check network, verify phone number format
