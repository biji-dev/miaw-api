# Miaw API

> REST API wrapper for miaw-core - Multiple Instance of App WhatsApp

**Version:** 1.2.0 · synchronized with `miaw-core` 1.9.1

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

The API exposes the HTTP-serializable `miaw-core` 1.9.1 surface. Existing endpoint
contracts remain available, while their internal calls now use the current core
method names and message-object semantics.

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

- Node.js >= 18.0.0
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

# Logging
LOG_LEVEL=info
```

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
curl http://localhost:3000/instances \
  -H "Authorization: Bearer your-api-key"
```

Or use the `X-API-Key` header:

```bash
curl http://localhost:3000/instances \
  -H "X-API-Key: your-api-key"
```

### Create Instance

```bash
curl -X POST http://localhost:3000/instances \
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
curl -X POST http://localhost:3000/instances/my-bot/connect \
  -H "Authorization: Bearer your-api-key"
```

The QR code will be sent to your webhook URL. Scan it with WhatsApp.

### Send Text Message

```bash
curl -X POST http://localhost:3000/instances/my-bot/send-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "to": "6281234567890",
    "text": "Hello from Miaw API!"
  }'
```

### List Instances

```bash
curl http://localhost:3000/instances \
  -H "Authorization: Bearer your-api-key"
```

### Check Instance Status

```bash
curl http://localhost:3000/instances/my-bot/status \
  -H "Authorization: Bearer your-api-key"
```

### Delete Instance

```bash
curl -X DELETE http://localhost:3000/instances/my-bot \
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

# Opt in to the interactive live pairing suite
MIAW_RUN_LIVE_TESTS=true pnpm test:integration -- setup
```

## API Endpoints

### Instance Management

| Method | Endpoint         | Description          |
| ------ | ---------------- | -------------------- |
| POST   | `/instances`     | Create new instance          |
| GET    | `/instances`     | List all instances           |
| GET    | `/instances/:id` | Get instance details         |
| PATCH  | `/instances/:id` | Update webhook URL/events    |
| DELETE | `/instances/:id` | Delete instance              |

### Connection

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/instances/:id/connect`    | Connect to WhatsApp      |
| DELETE | `/instances/:id/disconnect` | Disconnect from WhatsApp |
| POST   | `/instances/:id/restart`    | Restart connection       |
| GET    | `/instances/:id/status`     | Get connection status    |

### Messaging

| Method | Endpoint                             | Description                    |
| ------ | ------------------------------------ | ------------------------------ |
| POST   | `/instances/:id/send-text`           | Send text message              |
| POST   | `/instances/:id/send-media`          | Send media (image/video/audio) |
| PATCH  | `/instances/:id/messages/edit`       | Edit text message              |
| DELETE | `/instances/:id/messages/:messageId` | Delete message                 |
| POST   | `/instances/:id/messages/reaction`   | React to message               |
| POST   | `/instances/:id/messages/forward`    | Forward message                |
| POST   | `/instances/:id/messages/location`   | Send location                  |
| POST   | `/instances/:id/messages/contact`    | Send contact cards             |
| POST   | `/instances/:id/messages/sticker`    | Send WebP sticker              |
| POST   | `/instances/:id/messages/poll`       | Send poll                      |

### Chats and Statuses

| Method | Endpoint                                      | Description                    |
| ------ | --------------------------------------------- | ------------------------------ |
| POST/DELETE | `/instances/:id/chats/:jid/archive`    | Archive/unarchive chat         |
| POST/DELETE | `/instances/:id/chats/:jid/pin`        | Pin/unpin chat                 |
| POST/DELETE | `/instances/:id/chats/:jid/mute`       | Mute/unmute chat               |
| POST/DELETE | `/instances/:id/chats/:jid/read`       | Mark chat read/unread          |
| POST   | `/instances/:id/statuses/text`                | Post text status               |
| POST   | `/instances/:id/statuses/image`               | Post image status              |
| POST   | `/instances/:id/statuses/video`               | Post video status              |

### Contacts

| Method | Endpoint                               | Description                   |
| ------ | -------------------------------------- | ----------------------------- |
| POST   | `/instances/:id/check-number`          | Check if phone is on WhatsApp |
| POST   | `/instances/:id/check-batch`           | Batch check numbers (max 50)  |
| GET    | `/instances/:id/contacts/:jid`         | Get contact information       |
| GET    | `/instances/:id/contacts/:jid/picture` | Get profile picture URL       |

### Groups

| Method | Endpoint                                        | Description                   |
| ------ | ----------------------------------------------- | ----------------------------- |
| POST   | `/instances/:id/groups`                         | Create group                  |
| GET    | `/instances/:id/groups/:groupJid`               | Get group info                |
| PATCH  | `/instances/:id/groups/:groupJid`               | Update group name/description |
| POST   | `/instances/:id/groups/:groupJid/participants`  | Add participants              |
| DELETE | `/instances/:id/groups/:groupJid/participants`  | Remove participants           |
| POST   | `/instances/:id/groups/:groupJid/admins`        | Promote to admin              |
| DELETE | `/instances/:id/groups/:groupJid/admins`        | Demote admin                  |
| POST   | `/instances/:id/groups/:groupJid/picture`       | Update group picture          |
| GET    | `/instances/:id/groups/:groupJid/invite`        | Get invite link               |
| POST   | `/instances/:id/groups/:groupJid/revoke-invite` | Revoke invite link            |
| POST   | `/instances/:id/groups/join/:inviteCode`        | Join via invite code          |
| DELETE | `/instances/:id/groups/:groupJid`               | Leave group                   |

### Communities

Community lifecycle, participants/admins, linked groups, nested group creation,
and invite operations are available under `/instances/:id/communities`.

### Profile

| Method | Endpoint                         | Description            |
| ------ | -------------------------------- | ---------------------- |
| POST   | `/instances/:id/profile/picture` | Update profile picture |
| DELETE | `/instances/:id/profile/picture` | Remove profile picture |
| PATCH  | `/instances/:id/profile/name`    | Update profile name    |
| PATCH  | `/instances/:id/profile/status`  | Update profile status  |

### Presence

| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| POST   | `/instances/:id/presence`        | Set presence (online/offline) |
| POST   | `/instances/:id/typing/:to`      | Send typing indicator         |
| POST   | `/instances/:id/recording/:to`   | Send recording indicator      |
| POST   | `/instances/:id/stop-typing/:to` | Stop typing/recording         |
| POST   | `/instances/:id/read`            | Mark message as read          |
| POST   | `/instances/:id/subscribe/:jid`  | Subscribe to presence updates |

### Webhooks

| Method | Endpoint                        | Description                     |
| ------ | ------------------------------- | ------------------------------- |
| POST   | `/instances/:id/webhook/test`   | Send test webhook event         |
| GET    | `/instances/:id/webhook/status` | Get webhook delivery statistics |

### Business (WhatsApp Business Only)

| Method | Endpoint                                             | Description               |
| ------ | ---------------------------------------------------- | ------------------------- |
| POST   | `/instances/:id/labels`                              | Create/edit label         |
| DELETE | `/instances/:id/labels/:labelId`                     | Delete label              |
| POST   | `/instances/:id/chats/:jid/labels/:labelId`          | Add label to chat         |
| DELETE | `/instances/:id/chats/:jid/labels/:labelId`          | Remove label from chat    |
| POST   | `/instances/:id/messages/:messageId/labels/:labelId` | Add label to message      |
| DELETE | `/instances/:id/messages/:messageId/labels/:labelId` | Remove label from message |
| GET    | `/instances/:id/products/catalog`                    | Get product catalog       |
| GET    | `/instances/:id/products/collections`                | Get product collections   |
| GET    | `/instances/:id/newsletters/:newsletterId`           | Get newsletter metadata   |
| GET    | `/instances/:id/newsletters/:newsletterId/messages`  | Get newsletter messages   |

Business profile, cover-photo, order-detail, and quick-reply routes are under
`/instances/:id/business`.

### Runtime and LID Operations

| Method | Endpoint                               | Description                    |
| ------ | -------------------------------------- | ------------------------------ |
| GET/PATCH | `/instances/:id/runtime`           | Inspect or update runtime flags|
| GET/DELETE | `/instances/:id/lids`             | Inspect or clear LID cache     |
| POST   | `/instances/:id/lids/register`         | Register mapping               |
| POST   | `/instances/:id/lids/resolve`          | Resolve one LID                |
| POST   | `/instances/:id/lids/resolve-batch`    | Resolve LIDs in bulk           |

### Basic GET Operations

| Method | Endpoint                                | Description                |
| ------ | --------------------------------------- | -------------------------- |
| GET    | `/instances/:id/contacts`              | Get all contacts           |
| GET    | `/instances/:id/groups`                | Get all groups             |
| GET    | `/instances/:id/profile`               | Get own profile            |
| GET    | `/instances/:id/labels`                | Get all labels             |
| GET    | `/instances/:id/chats`                 | Get all chats              |
| GET    | `/instances/:id/chats/:jid/messages`   | Get chat messages          |

### Health

| Method | Endpoint  | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

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

Current version: `1.2.0`

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
