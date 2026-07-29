# Miaw API

> REST API wrapper for miaw-core - Multiple Instance of App WhatsApp

**Version:** 2.0.0 · synchronized with `miaw-core` 1.9.1

Miaw API provides a RESTful interface to manage multiple WhatsApp instances, send messages, and receive real-time webhook events. Built with Fastify and TypeScript.

## Features

- **Multi-Instance Management** - Create and manage multiple WhatsApp instances
- **Full Messaging** - Text, media, edit, delete, reactions, forward
- **Rich Messaging** - Locations, contact cards, stickers, polls, mentions, and replies
- **Chat & Status Management** - Archive, pin, mute, star, read state, and status stories
- **Contact Validation** - Check numbers, get contact info, profile pictures
- **Group Management** - Create groups, manage participants, admin operations
- **Community Management** - Communities, linked groups, members, admins, and invites
- **Business Extras** - Business profile, cover photo, orders, and quick replies
- **Operations** - Pairing-code auth, per-instance proxies, runtime controls, and LID resolution
- **Profile Management** - Update profile name, status, picture
- **RESTful API** - Clean JSON API with OpenAPI/Swagger documentation
- **Real-Time Webhooks** - Receive events (messages, edits, reactions, etc.) via webhooks
- **Authentication** - Simple API key authentication
- **Docker Support** - Easy deployment with Docker and Docker Compose

## Current Status

The API exposes the HTTP-serializable `miaw-core` 1.9.1 surface through one
versioned v2 contract. The former 1.x command-style routes were removed; all
protected endpoints now live under `/api/v1`.

### miaw-core 1.9.1 synchronization

- QR or pairing-code authentication with protected challenge retrieval
- Rich messaging, chat operations, statuses, business extras, and communities
- LID mapping/resolution and masked proxy/runtime inspection
- Webhooks for pairing codes, poll votes, message receipts, and session saves
- ESM runtime compatible with the ESM-only `miaw-core`

### Implemented (Phase 1-9)

**Phase 1 - Foundation (v0.1.0)**

- Instance CRUD operations (create, list, get, delete)
- Connection management (connect, disconnect, restart, status)
- Send text messages
- QR code authentication
- Webhook delivery with retry mechanism
- API documentation (Swagger UI)

**Phase 2 - Core Messaging (v0.2.0)**

- Send media (image, video, audio, document)
- Edit text messages
- Delete messages (for everyone / for me)
- Emoji reactions (add/remove)
- Forward messages (to multiple recipients)
- Extended webhook events (edit, delete, reaction)

**Phase 3 - Contacts & Validation (v0.3.0)**

- Check phone number (is on WhatsApp?)
- Batch check numbers (up to 50 at once)
- Get contact information
- Get profile picture URL

**Phase 4 - Group Management (v0.4.0)**

- Create groups
- Get group info/metadata
- Add/remove participants
- Promote/demote admin
- Update group name, description, picture
- Group invite link management (get, revoke, join)
- Leave group

**Phase 5 - Profile Management (v0.5.0)**

- Update profile picture
- Remove profile picture
- Update profile name
- Update profile status (About)

**Phase 6 - Presence & UX (v0.6.0)**

- Set presence (available/unavailable)
- Send typing indicator
- Send recording indicator
- Stop typing/recording indicator
- Mark message as read
- Subscribe to presence updates

**Phase 7 - Webhook Enhancements (v0.7.0)**

- Enhanced webhook signature (X-Miaw-Signature, X-Miaw-Timestamp)
- Signature format: sha256=<hex>
- Timestamp-based replay prevention
- Webhook test endpoint
- Webhook delivery statistics
- Signature verification utility

**Phase 8 - Business Features (v0.8.0)**

- Label management (create, delete, chat labels, message labels)
- Product catalog (get catalog, get collections)
- Newsletters (get metadata, get messages)
- WhatsApp Business account required

**Phase 9 - Basic GET Operations (v0.9.0)**

- Get all contacts
- Get all groups
- Get own profile
- Get all labels
- Get all chats
- Get chat messages

See [docs/ROADMAP.md](./docs/ROADMAP.md) for the full roadmap.

## Quick Start

### Prerequisites

- Node.js >= 20.18.1
- pnpm 10 (via Corepack)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd miaw-api

# Install dependencies
corepack enable
pnpm install --frozen-lockfile

# Build the project
pnpm build
```

### Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# API Key (change this!)
API_KEY=your-secret-api-key-here

# Webhook
WEBHOOK_SECRET=your-webhook-secret-here
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=5
WEBHOOK_RETRY_DELAY_MS=1000

# Session Storage
SESSION_PATH=./sessions

# Optional mounted proxy pool
# MIAW_PROXY_FILE=/run/secrets/miaw-proxies.txt
MIAW_PROXY_STRATEGY=deterministic

# Logging
LOG_LEVEL=info
```

`MIAW_PROXY_FILE` accepts the TXT and JSON formats supported by
`miaw-core` 1.10.0. Pool entries are assigned to new instances using
`deterministic` selection by default, so a stable `instanceId` keeps a stable
egress proxy. An explicit `clientOptions.proxy` supplied during instance
creation takes precedence over the pool.

Proxy passwords are never returned by the API. Manage the pool file as a
mounted secret and use `POST /api/v1/proxy-pool/reloads` after replacing it
when an immediate reload is required.

### Running

```bash
# Start the server
pnpm start

# Or in development mode
pnpm dev:start
```

The API will be available at `http://localhost:3000`

### Swagger Documentation

Open your browser:

```
http://localhost:3000/docs
```

## API Usage

### Authentication

All API requests require an API key:

```bash
curl http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer your-api-key"
```

Or use the `X-API-Key` header:

```bash
curl http://localhost:3000/api/v1/instances \
  -H "X-API-Key: your-api-key"
```

### Create Instance

```bash
curl -X POST http://localhost:3000/api/v1/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "instanceId": "my-bot",
    "webhookUrl": "https://your-server.com/webhook",
    "webhookEvents": ["message", "qr", "ready"]
  }'
```

### Connect Instance (Scan QR)

```bash
curl -X PUT http://localhost:3000/api/v1/instances/my-bot/connection \
  -H "Authorization: Bearer your-api-key"
```

The QR code will be sent to your webhook URL. Scan it with WhatsApp.

### Send Text Message

```bash
curl -X POST http://localhost:3000/api/v1/instances/my-bot/messages/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "to": "6281234567890",
    "text": "Hello from Miaw API!"
  }'
```

### List Instances

```bash
curl http://localhost:3000/api/v1/instances \
  -H "Authorization: Bearer your-api-key"
```

### Check Instance Status

```bash
curl http://localhost:3000/api/v1/instances/my-bot/connection \
  -H "Authorization: Bearer your-api-key"
```

### Delete Instance

```bash
curl -X DELETE http://localhost:3000/api/v1/instances/my-bot \
  -H "Authorization: Bearer your-api-key"
```

## Webhook Events

When events occur, POST requests are sent to your configured webhook URL:

```json
{
  "event": "message",
  "instanceId": "my-bot",
  "timestamp": 1735147200000,
  "data": {
    "id": "message-id",
    "from": "6281234567890@s.whatsapp.net",
    "text": "Hello!",
    "timestamp": 1735147200
  }
}
```

### Event Types

| Event               | Description                                   |
| ------------------- | --------------------------------------------- |
| `qr`                | QR code available for scanning                |
| `ready`             | Instance connected and ready                  |
| `message`           | New inbound message received                  |
| `message_edit`      | A message was edited                          |
| `message_delete`    | A message was deleted/revoked                 |
| `message_reaction`  | A message received an emoji reaction          |
| `message_receipt`   | Sent message delivery/read/played receipt     |
| `poll_vote`         | Aggregated poll vote changed                  |
| `pairing_code`      | Pairing code generated for phone-number auth  |
| `presence`          | Subscribed contact's presence changed         |
| `connection`        | Connection state changed                      |
| `disconnected`      | Instance disconnected                         |
| `reconnecting`      | Reconnection attempt in progress              |
| `error`             | Error occurred                                |
| `session_saved`     | Authentication session was persisted          |

When creating an instance, `webhookEvents` acts as a whitelist: list specific
events to receive only those, or omit it / pass `[]` to receive all events.

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker

```bash
# Build
docker build -t miaw-api .

# Run
docker run -d \
  -p 3000:3000 \
  -e API_KEY=your-api-key \
  -e WEBHOOK_SECRET=your-secret \
  -v $(pwd)/sessions:/app/sessions \
  miaw-api
```

## Development

### Project Structure

```
miaw-api/
├── src/
│   ├── config/         # Configuration loader
│   ├── middleware/     # Fastify authentication hooks
│   ├── routes/         # API route handlers
│   ├── schemas/        # JSON Schema definitions
│   ├── services/       # Business logic (InstanceManager, WebhookDispatcher)
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities (error handler)
│   └── server.ts       # Server entry point
├── test/
│   ├── integration/    # Integration tests
│   └── unit/           # Unit and route-contract tests
├── sessions/           # WhatsApp session data (gitignored)
└── dist/               # Compiled output (gitignored)
```

### Scripts

```bash
# Build
pnpm build

# Development (watch mode)
pnpm dev

# Run tests
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:live

# Lint
pnpm lint
pnpm lint:fix
```

### Adding New Features

1. Add route in `src/routes/`
2. Add schema in `src/schemas/index.ts`
3. Add implementation if needed
4. Add integration tests in `test/integration/`
5. Update Swagger documentation

## Testing

See [docs/TESTING.md](./docs/TESTING.md) for detailed testing guide.

```bash
# Run automated integration tests
pnpm test:integration

# Run the isolated-account live suite using .env.live-test
pnpm test:live
```

## API Endpoints

All protected endpoints use the `/api/v1/instances/:instanceId` prefix. The
canonical contract is summarized in [docs/API.md](docs/API.md), and the
generated field-level reference is available from `GET /docs` and
`GET /documentation/json`.

Core route families:

- lifecycle: `/connection`, `/connection-restarts`, `/session`, `/authentication`, and `/runtime`;
- resources: `/messages`, `/chats`, `/contacts`, `/groups`, `/communities`, and `/newsletters`;
- business: `/labels`, `/catalog`, and `/business`;
- operations: `/stats`, `/webhook`, `/lids`, `/lid-resolutions`, and `/phone-numbers`;
- unversioned utilities: `/health`, `/docs`, and `/documentation/json`.

The v1-style command routes and body-based identifiers were removed in 2.0.0.

## Documentation

- [API Guide](./docs/API.md) - Authentication, route groups, media and webhook contracts
- [Roadmap](./docs/ROADMAP.md) - Full development roadmap
- [Integration Test Plan](./docs/INTEGRATION-TEST-PLAN.md) - Test strategy
- [Testing Guide](./docs/TESTING.md) - How to run tests

## Configuration Reference

| Variable                 | Default    | Description                          |
| ------------------------ | ---------- | ------------------------------------ |
| `PORT`               | 3000       | Server port                          |
| `HOST`               | 0.0.0.0    | Server host                          |
| `API_KEY`                | -          | API key for authentication           |
| `WEBHOOK_SECRET`     | -          | Secret for webhook signature         |
| `WEBHOOK_TIMEOUT_MS`     | 10000      | Webhook delivery timeout (ms)        |
| `WEBHOOK_MAX_RETRIES`    | 6          | Max webhook retry attempts           |
| `WEBHOOK_RETRY_DELAY_MS` | 60000      | Initial retry delay (ms)             |
| `SESSION_PATH`           | ./sessions | Session storage path                 |
| `MIAW_PROXY_FILE`        | -          | Optional mounted TXT/JSON proxy pool |
| `MIAW_PROXY_STRATEGY`    | deterministic | Pool selection strategy           |
| `LOG_LEVEL`              | info       | Log level (debug, info, warn, error) |
| `CORS_ORIGIN`            | \*         | CORS allowed origin                  |

## Limitations

- One WhatsApp number per instance
- QR scan or phone-number pairing code required for initial connection
- Sessions expire after inactivity (requires re-pairing)
- Rate limiting by WhatsApp (may need delays between operations)

## Security Considerations

1. **API Key**: Use a strong, random API key in production
2. **Webhook Secret**: Keep webhook secret secure to verify webhook signatures
3. **HTTPS**: Use HTTPS in production for all API communication
4. **Firewall**: Restrict access to webhook endpoints
5. **Session Files**: Protect `./sessions/` directory (contains auth credentials)
6. **Proxy Credentials**: Mount proxy lists as secrets and never commit them

## Troubleshooting

### Connection Issues

**Problem**: QR code not received

- Check webhook URL is accessible
- Verify webhook events include `qr`

**Problem**: Connection fails after QR scan

- Check network connectivity
- Verify WhatsApp can reach the server
- Check logs for errors

### Session Issues

**Problem**: Instance always shows QR required

- Delete instance's session directory: `rm -rf sessions/{instanceId}/`
- Re-scan QR code

**Problem**: Session expired

- Sessions expire after ~30 days of inactivity
- Re-pair by scanning QR code again

## Versioning

This project follows Semantic Versioning (semver).

Current version: `2.0.0`

- **Major version**: breaking HTTP or configuration changes
- **Minor version**: backward-compatible capabilities
- **Patch version**: backward-compatible fixes

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines first.

## Support

For issues and questions:

- GitHub Issues: <repository-url>/issues
- Documentation: See [docs/TESTING.md](./docs/TESTING.md) and [docs/ROADMAP.md](./docs/ROADMAP.md)

---

**Miaw API** - Multiple Instance of App WhatsApp REST API

Built with ❤️ using Fastify, TypeScript, and miaw-core
