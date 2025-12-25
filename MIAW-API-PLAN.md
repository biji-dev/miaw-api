# Miaw API - Project Plan

**Version:** 1.0.0
**Date:** 2025-12-25
**Status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Frameworks](#2-technology-stack--frameworks)
3. [Architecture](#3-architecture)
4. [API Design](#4-api-design)
5. [Webhook Design](#5-webhook-design)
6. [Project Structure](#6-project-structure)
7. [Phase-based Roadmap](#7-phase-based-roadmap)
8. [Configuration & Environment](#8-configuration--environment)
9. [Deployment](#9-deployment)
10. [Security Considerations](#10-security-considerations)

---

## 1. Project Overview

### 1.1 Purpose

**miaw-api** is a REST API server that exposes **miaw-core** functionalities through HTTP endpoints. It enables developers to integrate WhatsApp automation into their applications without managing the underlying WhatsApp connection directly.

### 1.2 Key Features

- **Multi-Instance Management**: Run multiple WhatsApp instances simultaneously
- **RESTful API**: Standard HTTP endpoints for all operations
- **Webhook Support**: Real-time event forwarding to configured URLs
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Simple Authentication**: Single API key for all requests
- **No Rate Limiting**: Unbounded requests (self-hosted)
- **Real-time Forwarding**: Instant webhook delivery for events

### 1.3 Use Cases

- Integration with existing web/mobile applications
- Chatbot platforms
- Customer service automation
- Notification systems
- Business workflow automation

---

## 2. Technology Stack & Frameworks

### 2.1 Framework Recommendation: **Fastify**

After researching available options, **Fastify** is recommended for miaw-api:

| Feature             | Fastify                     | Express               | NestJS           |
| ------------------- | --------------------------- | --------------------- | ---------------- |
| TypeScript Support  | Native (first-class)        | Requires setup        | Built-in         |
| Performance         | Fastest                     | Moderate              | Good             |
| Schema Validation   | Built-in (JSON Schema)      | Manual                | Built-in         |
| Swagger Integration | Native (`@fastify/swagger`) | Manual (`swagger-ui`) | Built-in         |
| Learning Curve      | Low                         | Low                   | High             |
| Plugin Ecosystem    | Rich                        | Mature                | Rich             |
| Overhead            | Minimal                     | Low                   | High (framework) |

**Why Fastify?**

- **TypeScript-first**: Excellent type safety and developer experience
- **Performance**: Up to 2x faster than Express (important for webhook throughput)
- **Built-in Validation**: JSON schema validation reduces boilerplate
- **Native Swagger**: Auto-generated API documentation with `@fastify/swagger`
- **Active Community**: 30k+ GitHub stars, regular updates

### 2.2 Complete Technology Stack

| Component           | Technology                             | Purpose                       |
| ------------------- | -------------------------------------- | ----------------------------- |
| **Runtime**         | Node.js >= 18                          | Runtime environment           |
| **Language**        | TypeScript 5.x                         | Type safety                   |
| **Framework**       | Fastify 5.x                            | Web framework                 |
| **Validation**      | fastify-typebox-zod                    | Schema validation             |
| **Documentation**   | @fastify/swagger + @fastify/swagger-ui | OpenAPI/Swagger UI            |
| **WhatsApp**        | miaw-core (local)                      | WhatsApp client library       |
| **Docker**          | Docker + Docker Compose                | Containerization              |
| **Process Manager** | PM2 (optional)                         | Production process management |
| **Testing**         | Vitest                                 | Unit/integration tests        |
| **Linting**         | ESLint + Prettier                      | Code quality                  |

### 2.3 External Dependencies (None!)

All WhatsApp functionality comes from **miaw-core** (installed as local dependency or npm package).

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
│                    (Mobile, Web, Backend, etc.)                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP/REST
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          miaw-api Server                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     API Layer (Fastify)                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │   Auth       │  │  Validation  │  │   Routes     │    │  │
│  │  │  Middleware  │  │  Middleware  │  │   Handler    │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Service Layer                          │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │           InstanceManager Service                   │   │  │
│  │  │  - Create/Delete/List instances                    │   │  │
│  │  │  - Route requests to correct instance              │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │           WebhookDispatcher Service                │   │  │
│  │  │  - Queue webhook deliveries                        │   │  │
│  │  │  - Retry failed deliveries                         │   │  │
│  │  │  - Signature generation                            │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Events
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         miaw-core Clients                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Instance 1│  │Instance 2│  │Instance 3│  │  Instance│  ...   │
│  │ (MiawClient)│ (MiawClient)│ (MiawClient)│    N     │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ WhatsApp Protocol
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WhatsApp Servers                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Webhook Consumer URLs                         │
│              (Configured per instance or globally)               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

```
Client Request
      │
      ▼
┌─────────────┐
│ API Key Auth│ ──────► Invalid? ─────► 401 Unauthorized
└─────────────┘
      │ Valid
      ▼
┌─────────────┐
│  Validation │ ──────► Invalid? ─────► 400 Bad Request
└─────────────┘
      │ Valid
      ▼
┌──────────────────┐
│ Instance Manager │ ──────► Not Found? ─────► 404 Not Found
└──────────────────┘
      │ Found
      ▼
┌──────────────────┐
│   miaw-core      │
│   Instance       │
└──────────────────┘
      │
      ▼
Response to Client
```

### 3.3 Webhook Flow

```
miaw-core Event (message, qr, ready, etc.)
      │
      ▼
┌─────────────────────┐
│ Event Normalizer    │ Convert to webhook format
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Webhook Dispatcher  │ Queue for delivery
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ HTTP POST           │ Send to configured URL
│ + Signature Header  │
└─────────────────────┘
      │
      ├─────────────► Success ──────► Mark Delivered
      │
      └─────────────► Failure ──────► Retry Queue (exponential backoff)
```

---

## 4. API Design

### 4.1 Base URL

```
http://localhost:3000/api/v1
```

### 4.2 Authentication

**Method**: API Key in Header

```
Authorization: Bearer YOUR_API_KEY
```

or

```
X-API-Key: YOUR_API_KEY
```

### 4.3 Response Format

**Success Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

### 4.4 API Endpoints

#### 4.4.1 Instance Management

| Method   | Endpoint                            | Description              |
| -------- | ----------------------------------- | ------------------------ |
| `POST`   | `/instances`                        | Create new instance      |
| `GET`    | `/instances`                        | List all instances       |
| `GET`    | `/instances/:instanceId`            | Get instance details     |
| `DELETE` | `/instances/:instanceId`            | Delete instance          |
| `GET`    | `/instances/:instanceId/status`     | Get connection status    |
| `POST`   | `/instances/:instanceId/connect`    | Connect to WhatsApp      |
| `POST`   | `/instances/:instanceId/disconnect` | Disconnect from WhatsApp |
| `POST`   | `/instances/:instanceId/restart`    | Restart instance         |

##### Create Instance

```http
POST /api/v1/instances
Content-Type: application/json

{
  "instanceId": "my-bot-1",
  "webhookUrl": "https://myapp.com/webhook",
  "webhookEvents": ["message", "qr", "ready", "disconnected"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "instanceId": "my-bot-1",
    "status": "disconnected",
    "sessionPath": "/app/sessions/my-bot-1",
    "webhookUrl": "https://myapp.com/webhook",
    "webhookEvents": ["message", "qr", "ready", "disconnected"],
    "createdAt": "2025-12-25T10:00:00Z"
  }
}
```

#### 4.4.2 Messaging (Priority Features)

| Method   | Endpoint                                              | Description       |
| -------- | ----------------------------------------------------- | ----------------- |
| `POST`   | `/instances/:instanceId/messages/text`                | Send text message |
| `POST`   | `/instances/:instanceId/messages/image`               | Send image        |
| `POST`   | `/instances/:instanceId/messages/video`               | Send video        |
| `POST`   | `/instances/:instanceId/messages/audio`               | Send audio        |
| `POST`   | `/instances/:instanceId/messages/document`            | Send document     |
| `POST`   | `/instances/:instanceId/messages/:messageId`          | Edit message      |
| `DELETE` | `/instances/:instanceId/messages/:messageId`          | Delete message    |
| `POST`   | `/instances/:instanceId/messages/:messageId/reaction` | React to message  |
| `POST`   | `/instances/:instanceId/messages/:messageId/forward`  | Forward message   |
| `GET`    | `/instances/:instanceId/messages/:messageId/media`    | Download media    |

##### Send Text Message

```http
POST /api/v1/instances/my-bot-1/messages/text
Content-Type: application/json

{
  "to": "6281234567890",
  "text": "Hello from API!",
  "quotedMessageId": "optional_msg_id_to_reply"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messageId": "3EB0xxxxxxxxxxxx",
    "timestamp": 1735118400000
  }
}
```

#### 4.4.3 Contact & Validation

| Method   | Endpoint                                       | Description                 |
| -------- | ---------------------------------------------- | --------------------------- |
| `POST`   | `/instances/:instanceId/contacts/check`        | Check if number on WhatsApp |
| `POST`   | `/instances/:instanceId/contacts/check-batch`  | Batch check numbers         |
| `GET`    | `/instances/:instanceId/contacts/:jid`         | Get contact info            |
| `GET`    | `/instances/:instanceId/contacts/:jid/picture` | Get profile picture         |
| `POST`   | `/instances/:instanceId/contacts`              | Add/edit contact            |
| `DELETE` | `/instances/:instanceId/contacts/:phone`       | Remove contact              |

#### 4.4.4 Group Management

| Method   | Endpoint                                                | Description                      |
| -------- | ------------------------------------------------------- | -------------------------------- |
| `POST`   | `/instances/:instanceId/groups`                         | Create group                     |
| `GET`    | `/instances/:instanceId/groups/:groupJid`               | Get group info                   |
| `POST`   | `/instances/:instanceId/groups/:groupJid/participants`  | Add participants                 |
| `DELETE` | `/instances/:instanceId/groups/:groupJid/participants`  | Remove participants              |
| `POST`   | `/instances/:instanceId/groups/:groupJid/admins`        | Promote to admin                 |
| `DELETE` | `/instances/:instanceId/groups/:groupJid/admins`        | Demote admin                     |
| `PATCH`  | `/instances/:instanceId/groups/:groupJid`               | Update group (name, description) |
| `POST`   | `/instances/:instanceId/groups/:groupJid/picture`       | Update group picture             |
| `GET`    | `/instances/:instanceId/groups/:groupJid/invite`        | Get invite link                  |
| `POST`   | `/instances/:instanceId/groups/:groupJid/revoke-invite` | Revoke invite link               |
| `POST`   | `/instances/:instanceId/groups/join/:inviteCode`        | Join group via invite            |
| `DELETE` | `/instances/:instanceId/groups/:groupJid`               | Leave group                      |

#### 4.4.5 Profile Management

| Method   | Endpoint                                 | Description            |
| -------- | ---------------------------------------- | ---------------------- |
| `POST`   | `/instances/:instanceId/profile/picture` | Update profile picture |
| `DELETE` | `/instances/:instanceId/profile/picture` | Remove profile picture |
| `PATCH`  | `/instances/:instanceId/profile/name`    | Update profile name    |
| `PATCH`  | `/instances/:instanceId/profile/status`  | Update profile status  |

#### 4.4.6 Presence & UX

| Method | Endpoint                                 | Description                   |
| ------ | ---------------------------------------- | ----------------------------- |
| `POST` | `/instances/:instanceId/presence`        | Set presence (online/offline) |
| `POST` | `/instances/:instanceId/typing/:to`      | Send typing indicator         |
| `POST` | `/instances/:instanceId/recording/:to`   | Send recording indicator      |
| `POST` | `/instances/:instanceId/stop-typing/:to` | Stop typing/recording         |
| `POST` | `/instances/:instanceId/read/:messageId` | Mark message as read          |
| `POST` | `/instances/:instanceId/subscribe/:jid`  | Subscribe to presence         |

#### 4.4.7 Webhook Configuration

| Method | Endpoint                              | Description           |
| ------ | ------------------------------------- | --------------------- |
| `GET`  | `/instances/:instanceId/webhook`      | Get webhook config    |
| `PUT`  | `/instances/:instanceId/webhook`      | Update webhook config |
| `POST` | `/instances/:instanceId/webhook/test` | Test webhook delivery |

#### 4.4.8 Health & Status

| Method | Endpoint  | Description                    |
| ------ | --------- | ------------------------------ |
| `GET`  | `/health` | API health check               |
| `GET`  | `/`       | API documentation (Swagger UI) |

---

## 5. Webhook Design

### 5.1 Webhook Events

| Event              | Trigger                 | Payload                       |
| ------------------ | ----------------------- | ----------------------------- |
| `qr`               | QR code available       | `{ qr: string }`              |
| `ready`            | Instance connected      | `{ instanceId, connectedAt }` |
| `message`          | New message received    | Full message object           |
| `message_edit`     | Message edited          | Edit details                  |
| `message_delete`   | Message deleted         | Delete details                |
| `message_reaction` | Reaction received       | Reaction details              |
| `presence`         | Presence update         | Presence details              |
| `connection`       | Connection state change | `{ state }`                   |
| `disconnected`     | Disconnected            | `{ reason }`                  |
| `reconnecting`     | Reconnecting            | `{ attempt }`                 |
| `error`            | Instance error          | `{ error }`                   |

### 5.2 Webhook Payload Format

**Headers:**

```
Content-Type: application/json
X-Miaw-Instance: my-bot-1
X-Miaw-Event: message
X-Miaw-Signature: sha256=HASH
X-Miaw-Timestamp: 1735118400000
```

**Body (Example - Message Event):**

```json
{
  "event": "message",
  "instanceId": "my-bot-1",
  "timestamp": 1735118400000,
  "data": {
    "id": "3EB0xxxxxxxxxxxx",
    "from": "6281234567890@s.whatsapp.net",
    "senderPhone": "6281234567890",
    "senderName": "John Doe",
    "text": "Hello!",
    "timestamp": 1735118400,
    "isGroup": false,
    "fromMe": false,
    "type": "text"
  }
}
```

### 5.3 Signature Verification

```
signature = hmac_sha256(API_SECRET + timestamp, JSON.stringify(body))
```

**Verification (Consumer side):**

```javascript
const receivedSignature = req.headers["x-miaw-signature"];
const computedSignature = crypto
  .createHmac("sha256", API_SECRET + req.headers["x-miaw-timestamp"])
  .update(JSON.stringify(req.body))
  .digest("hex");

if (receivedSignature !== `sha256=${computedSignature}`) {
  // Invalid signature
}
```

### 5.4 Retry Mechanism

| Attempt | Delay      |
| ------- | ---------- |
| 1       | Immediate  |
| 2       | 1 minute   |
| 3       | 5 minutes  |
| 4       | 15 minutes |
| 5       | 1 hour     |
| 6+      | Give up    |

### 5.5 Webhook Responses

**Expected from consumer:**

- `200 OK` or `204 No Content` - Success, stop retrying
- Any other status - Retry with backoff

---

## 6. Project Structure

```
miaw-api/
├── src/
│   ├── server.ts                 # Fastify server entry point
│   ├── app.ts                    # App initialization
│   ├── config/
│   │   ├── index.ts              # Config loader
│   │   ├── env.ts                # Environment variables
│   │   └── constants.ts          # Constants
│   ├── routes/
│   │   ├── index.ts              # Route registration
│   │   ├── instances.ts          # Instance routes
│   │   ├── messages.ts           # Message routes
│   │   ├── contacts.ts           # Contact routes
│   │   ├── groups.ts             # Group routes
│   │   ├── profile.ts            # Profile routes
│   │   ├── presence.ts           # Presence routes
│   │   ├── webhooks.ts           # Webhook config routes
│   │   └── health.ts             # Health check
│   ├── services/
│   │   ├── InstanceManager.ts    # Instance CRUD + routing
│   │   ├── WebhookDispatcher.ts  # Webhook queue + delivery
│   │   └── SignatureService.ts   # Signature generation/verification
│   ├── middleware/
│   │   ├── auth.ts               # API key validation
│   │   ├── validation.ts         # Request validation schemas
│   │   └── errorHandler.ts       # Global error handler
│   ├── schemas/
│   │   ├── instance.ts           # Instance DTOs
│   │   ├── message.ts            # Message DTOs
│   │   ├── contact.ts            # Contact DTOs
│   │   ├── group.ts              # Group DTOs
│   │   └── webhook.ts            # Webhook DTOs
│   ├── types/
│   │   ├── index.ts              # TypeScript types
│   │   ├── api.ts                # API-related types
│   │   └── instance.ts           # Instance-related types
│   └── utils/
│       ├── logger.ts             # Pino logger
│       ├── errors.ts             # Custom error classes
│       └── helpers.ts            # Utility functions
├── test/
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── fixtures/                 # Test data
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── sessions/                     # miaw-core session storage
│   └── .gitkeep
├── .env.example                  # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── README.md
└── MIAW-API-PLAN.md              # This document
```

---

## 7. Phase-based Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Basic API with instance management and simple messaging

| Feature                                           | Priority | Effort  |
| ------------------------------------------------- | -------- | ------- |
| Project setup (Fastify, TypeScript)               | P0       | 1 day   |
| Authentication middleware (API key)               | P0       | 0.5 day |
| InstanceManager service (CRUD)                    | P0       | 2 days  |
| Basic instance routes (create, list, get, delete) | P0       | 1 day   |
| Connect/disconnect routes                         | P0       | 1 day   |
| Send text message endpoint                        | P0       | 1 day   |
| Basic webhook dispatcher (message event only)     | P0       | 2 days  |
| Swagger documentation setup                       | P1       | 0.5 day |
| Docker setup                                      | P1       | 0.5 day |

**Deliverables:**

- Working API server
- Can create/delete/list instances
- Can connect instance and scan QR
- Can send text messages
- Webhook fires for incoming messages

### Phase 2: Core Messaging (Week 3)

**Goal:** Complete messaging features

| Feature                                              | Priority | Effort  |
| ---------------------------------------------------- | -------- | ------- |
| Send media endpoints (image, video, audio, document) | P0       | 1 day   |
| Message edit/delete endpoints                        | P1       | 0.5 day |
| Reaction endpoint                                    | P1       | 0.5 day |
| Forward message endpoint                             | P1       | 0.5 day |
| Download media endpoint                              | P1       | 0.5 day |
| Webhook events (edit, delete, reaction)              | P1       | 1 day   |
| Quoting/replying support                             | P2       | 0.5 day |

**Deliverables:**

- Full messaging capabilities
- All webhook events for messaging

### Phase 3: Contacts & Validation (Week 4)

**Goal:** Contact management and number validation

| Feature                           | Priority | Effort  |
| --------------------------------- | -------- | ------- |
| Check number endpoint             | P0       | 0.5 day |
| Batch check numbers endpoint      | P1       | 0.5 day |
| Get contact info endpoint         | P1       | 0.5 day |
| Get profile picture endpoint      | P1       | 0.5 day |
| Add/edit/remove contact endpoints | P2       | 1 day   |

**Deliverables:**

- Contact validation endpoints
- Contact CRUD operations

### Phase 4: Group Management (Week 5)

**Goal:** Full group management capabilities

| Feature                               | Priority | Effort  |
| ------------------------------------- | -------- | ------- |
| Create group endpoint                 | P0       | 0.5 day |
| Get group info endpoint               | P0       | 0.5 day |
| Add/remove participants endpoints     | P0       | 1 day   |
| Promote/demote admin endpoints        | P1       | 0.5 day |
| Update group name/description/picture | P1       | 0.5 day |
| Group invite link endpoints           | P1       | 1 day   |
| Leave group endpoint                  | P2       | 0.5 day |

**Deliverables:**

- Complete group management API

### Phase 5: Presence & UX (Week 6)

**Goal:** Presence indicators and UX features

| Feature                        | Priority | Effort  |
| ------------------------------ | -------- | ------- |
| Set presence endpoint          | P1       | 0.5 day |
| Typing/recording indicators    | P1       | 0.5 day |
| Mark as read endpoint          | P2       | 0.5 day |
| Subscribe to presence endpoint | P2       | 0.5 day |
| Webhook events for presence    | P2       | 0.5 day |

**Deliverables:**

- Presence and UX endpoints

### Phase 6: Profile Management (Week 7)

**Goal:** Bot profile management

| Feature                         | Priority | Effort  |
| ------------------------------- | -------- | ------- |
| Update profile picture endpoint | P1       | 0.5 day |
| Remove profile picture endpoint | P1       | 0.5 day |
| Update profile name endpoint    | P1       | 0.5 day |
| Update profile status endpoint  | P1       | 0.5 day |

**Deliverables:**

- Profile management endpoints

### Phase 7: Webhook Enhancements (Week 8)

**Goal:** Production-ready webhooks

| Feature                                  | Priority | Effort  |
| ---------------------------------------- | -------- | ------- |
| Webhook retry mechanism with backoff     | P0       | 1 day   |
| Signature generation/verification        | P0       | 1 day   |
| Webhook test endpoint                    | P1       | 0.5 day |
| Webhook status dashboard endpoint        | P2       | 1 day   |
| Configurable webhook events per instance | P1       | 0.5 day |

**Deliverables:**

- Production-ready webhook system

### Phase 8: Business Features (Week 9-10)

**Goal:** WhatsApp Business features

| Feature                      | Priority | Effort |
| ---------------------------- | -------- | ------ |
| Label management endpoints   | P2       | 1 day  |
| Product catalog endpoints    | P2       | 1 day  |
| Newsletter/channel endpoints | P2       | 1 day  |

**Deliverables:**

- Optional Business features API

### Phase 9: Polish & Testing (Week 11-12)

**Goal:** Production readiness

| Feature                      | Priority | Effort |
| ---------------------------- | -------- | ------ |
| Comprehensive error handling | P0       | 2 days |
| Integration tests            | P0       | 3 days |
| Performance optimization     | P1       | 2 days |
| Documentation completion     | P1       | 2 days |
| Security audit               | P1       | 2 days |
| Load testing                 | P2       | 2 days |

**Deliverables:**

- Production-ready API
- Complete documentation
- Test coverage > 80%

---

## 8. Configuration & Environment

### 8.1 Environment Variables

```bash
# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_KEY=your-secret-api-key-here
API_WEBHOOK_SECRET=your-webhook-secret-here

# CORS
CORS_ORIGIN=*

# Session Storage
SESSION_PATH=./sessions

# Webhook Configuration
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=6
WEBHOOK_RETRY_DELAY_MS=60000

# Logging
LOG_LEVEL=info

# Node
NODE_ENV=production
```

### 8.2 Instance Configuration

Per-instance configuration (stored in memory):

```typescript
interface InstanceConfig {
  instanceId: string;
  webhookUrl?: string;
  webhookEvents: WebhookEvent[];
  webhookEnabled: boolean;
  status: ConnectionStatus;
  createdAt: Date;
  lastActivity: Date;
}
```

---

## 9. Deployment

### 9.1 Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

**Docker Compose:**

```yaml
version: "3.8"
services:
  miaw-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_KEY=${API_KEY}
      - API_WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - NODE_ENV=production
    volumes:
      - ./sessions:/app/sessions
    restart: unless-stopped
```

### 9.2 Production Deployment Options

| Option         | Description                 | Complexity |
| -------------- | --------------------------- | ---------- |
| **PM2**        | Process manager for Node.js | Low        |
| **Docker**     | Containerized deployment    | Medium     |
| **Kubernetes** | Orchestrated containers     | High       |

**Recommended:** Docker for simplicity and portability.

---

## 10. Security Considerations

### 10.1 Authentication

- **Single API Key**: Simple but requires secure storage
- **Recommended**: Use environment variable for API key
- **Future**: Consider multiple API keys with different permissions

### 10.2 Webhook Security

- **Signature Verification**: HMAC-SHA256 signature
- **Timestamp**: Prevent replay attacks (reject > 5 min old)
- **HTTPS**: Always use HTTPS for webhook URLs

### 10.3 Input Validation

- JSON Schema validation on all inputs
- Sanitize phone numbers (remove non-digits)
- Validate JID formats

### 10.4 Rate Limiting (Optional)

While not required by spec, consider implementing:

- Per-IP rate limiting
- Per-instance rate limiting
- DDoS protection

### 10.5 Session Security

- Sessions stored in `./sessions` directory
- Ensure proper file permissions (600)
- Don't commit sessions to version control

---

## Appendix A: Example Usage

### A.1 Complete Flow Example

```javascript
// 1. Create instance
const instance = await fetch("http://localhost:3000/api/v1/instances", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    instanceId: "customer-service-bot",
    webhookUrl: "https://myapp.com/webhook",
    webhookEvents: ["message", "ready", "disconnected"],
  }),
});

// 2. Connect to get QR code
await fetch(
  "http://localhost:3000/api/v1/instances/customer-service-bot/connect",
  {
    method: "POST",
    headers: { Authorization: "Bearer YOUR_API_KEY" },
  }
);

// 3. Webhook receives QR code
// POST https://myapp.com/webhook
// { event: 'qr', instanceId: 'customer-service-bot', data: { qr: '...' } }

// 4. Scan QR with phone

// 5. Webhook receives ready event
// POST https://myapp.com/webhook
// { event: 'ready', instanceId: 'customer-service-bot', data: {...} }

// 6. Send message
await fetch(
  "http://localhost:3000/api/v1/instances/customer-service-bot/messages/text",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "6281234567890",
      text: "Hello! How can I help you?",
    }),
  }
);

// 7. Receive message via webhook
// POST https://myapp.com/webhook
// { event: 'message', instanceId: 'customer-service-bot', data: {...} }
```

### A.2 Webhook Consumer Example (Node.js)

```javascript
import crypto from "crypto";
import express from "express";

const app = express();
const API_SECRET = "your-webhook-secret";

app.use(express.json());

app.post("/webhook", (req, res) => {
  // Verify signature
  const receivedSignature = req.headers["x-miaw-signature"];
  const timestamp = req.headers["x-miaw-timestamp"];
  const computedSignature = crypto
    .createHmac("sha256", API_SECRET + timestamp)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (receivedSignature !== `sha256=${computedSignature}`) {
    console.error("Invalid signature");
    return res.status(401).send("Invalid signature");
  }

  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  if (now - parseInt(timestamp) > 5 * 60 * 1000) {
    console.error("Request too old");
    return res.status(401).send("Request too old");
  }

  // Handle event
  const { event, instanceId, data } = req.body;

  console.log(`Received ${event} from ${instanceId}:`, data);

  // Respond with success
  res.status(200).send("OK");
});

app.listen(3000, () => console.log("Webhook server running on port 3000"));
```

---

## Appendix B: Error Codes

| Code                     | HTTP | Description                        |
| ------------------------ | ---- | ---------------------------------- |
| `UNAUTHORIZED`           | 401  | Invalid or missing API key         |
| `INVALID_REQUEST`        | 400  | Request validation failed          |
| `INSTANCE_NOT_FOUND`     | 404  | Instance does not exist            |
| `INSTANCE_NOT_CONNECTED` | 503  | Instance not connected to WhatsApp |
| `WHATSAPP_ERROR`         | 500  | WhatsApp operation failed          |
| `WEBHOOK_FAILED`         | 500  | Webhook delivery failed            |
| `RATE_LIMITED`           | 429  | Too many requests (if enabled)     |

---

## Summary

This plan provides a comprehensive roadmap for building **miaw-api**, a REST API wrapper around **miaw-core**. The key points are:

- **Fastify** for the web framework (performance, TypeScript-first)
- **8 development phases** from foundation to production
- **Phase 1-2** deliver core messaging functionality
- **Single API key** authentication for simplicity
- **Webhook retry mechanism** with signature verification
- **Docker-ready** for easy deployment
- **Swagger documentation** integrated

The total estimated development time is **12 weeks** for a production-ready API, with **usable MVP** available after **3 weeks** (Phase 1-2).
