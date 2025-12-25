# Miaw API

> REST API wrapper for miaw-core - Multiple Instance of App WhatsApp

**Version:** 0.1.0 (Phase 1 - MVP)

Miaw API provides a RESTful interface to manage multiple WhatsApp instances, send messages, and receive real-time webhook events. Built with Fastify and TypeScript.

## Features

- **Multi-Instance Management** - Create and manage multiple WhatsApp instances
- **RESTful API** - Clean JSON API with OpenAPI/Swagger documentation
- **Real-Time Webhooks** - Receive events (messages, status changes) via webhooks
- **Authentication** - Simple API key authentication
- **Docker Support** - Easy deployment with Docker and Docker Compose

## Current Status (Phase 1 - MVP)

### Implemented

- Instance CRUD operations (create, list, get, delete)
- Connection management (connect, disconnect, restart, status)
- Send text messages
- QR code authentication
- Webhook delivery with retry mechanism
- API documentation (Swagger UI)

### Planned (Phase 2+)

- Send media (image, video, audio, document)
- Contact operations (check numbers, get info)
- Group management (create, add/remove participants)
- Profile management (update name, status, picture)
- Presence features (typing indicators, read receipts)
- Business features (labels, products, newsletters)

See [docs/ROADMAP.md](./docs/ROADMAP.md) for the full roadmap.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd miaw-api

# Install dependencies
npm install

# Build the project
npm run build
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

# Session Storage
SESSION_PATH=./sessions

# Logging
LOG_LEVEL=info
```

### Running

```bash
# Start the server
npm start

# Or in development mode
npm run dev:start
```

The API will be available at `http://localhost:3000`

### Swagger Documentation

Open your browser:

```
http://localhost:3000/
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

| Event          | Description                    |
| -------------- | ------------------------------ |
| `qr`           | QR code available for scanning |
| `ready`        | Instance connected and ready   |
| `message`      | New message received           |
| `connection`   | Connection state changed       |
| `disconnected` | Instance disconnected          |
| `error`        | Error occurred                 |

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
│   ├── middleware/     # Express middleware (auth)
│   ├── routes/         # API route handlers
│   ├── schemas/        # JSON Schema definitions
│   ├── services/       # Business logic (InstanceManager, WebhookDispatcher)
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities (error handler)
│   └── server.ts       # Server entry point
├── test/
│   ├── integration/    # Integration tests
│   └── unit/           # Unit tests (planned)
├── sessions/           # WhatsApp session data (gitignored)
└── dist/               # Compiled output (gitignored)
```

### Scripts

```bash
# Build
npm run build

# Development (watch mode)
npm run dev

# Run tests
npm test
npm run test:unit
npm run test:integration

# Lint
npm run lint
npm run lint:fix
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
# Run integration tests (requires WhatsApp pairing)
npm run test:integration

# Setup test instance (pair via QR)
npm run test:integration -- setup
```

## API Endpoints

### Instance Management

| Method | Endpoint         | Description          |
| ------ | ---------------- | -------------------- |
| POST   | `/instances`     | Create new instance  |
| GET    | `/instances`     | List all instances   |
| GET    | `/instances/:id` | Get instance details |
| DELETE | `/instances/:id` | Delete instance      |

### Connection

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| POST   | `/instances/:id/connect`    | Connect to WhatsApp      |
| DELETE | `/instances/:id/disconnect` | Disconnect from WhatsApp |
| POST   | `/instances/:id/restart`    | Restart connection       |
| GET    | `/instances/:id/status`     | Get connection status    |

### Messaging

| Method | Endpoint                   | Description       |
| ------ | -------------------------- | ----------------- |
| POST   | `/instances/:id/send-text` | Send text message |

### Health

| Method | Endpoint  | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Documentation

- [Roadmap](./docs/ROADMAP.md) - Full development roadmap
- [Integration Test Plan](./docs/INTEGRATION-TEST-PLAN.md) - Test strategy
- [Testing Guide](./docs/TESTING.md) - How to run tests

## Configuration Reference

| Variable              | Default    | Description                          |
| --------------------- | ---------- | ------------------------------------ |
| `PORT`                | 3000       | Server port                          |
| `HOST`                | 0.0.0.0    | Server host                          |
| `API_KEY`             | -          | API key for authentication           |
| `WEBHOOK_SECRET`      | -          | Secret for webhook signature         |
| `WEBHOOK_TIMEOUT`     | 10000      | Webhook delivery timeout (ms)        |
| `WEBHOOK_MAX_RETRIES` | 5          | Max webhook retry attempts           |
| `WEBHOOK_RETRY_DELAY` | 1000       | Initial retry delay (ms)             |
| `SESSION_PATH`        | ./sessions | Session storage path                 |
| `LOG_LEVEL`           | info       | Log level (debug, info, warn, error) |
| `CORS_ORIGIN`         | \*         | CORS allowed origin                  |

## Limitations

- One WhatsApp number per instance
- Manual QR scanning required for initial connection
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

Current version: `0.1.0`

- **Major version** (0): Initial development, API may change
- **Minor version** (1): Phase 1 (MVP) features
- **Patch version** (0): Initial release

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
