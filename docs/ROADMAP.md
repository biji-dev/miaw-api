# Miaw API - Project Plan

**Version:** 1.4.0
**Date:** 2026-01-20
**Status:** Active (Phase 9 Complete, Phase 2-3 Gaps Filled, Planning Phase 10-15)

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

## Implementation Status

**Current Version:** v0.10.0 (Phase 9 Complete + Phase 2-3 Gaps Filled)
**miaw-core Version:** v1.0.0 (Production-ready)

| Phase | Name                       | Status         | Version |
| ----- | -------------------------- | -------------- | ------- |
| 1     | Foundation                 | ✅ Complete    | v0.1.0  |
| 2     | Core Messaging             | ✅ Complete    | v0.10.0 |
| 3     | Contacts & Validation      | ✅ Complete    | v0.10.0 |
| 4     | Group Management           | ✅ Complete    | v0.4.0  |
| 5     | Profile Management         | ✅ Complete    | v0.5.0  |
| 6     | Presence & UX              | ✅ Complete    | v0.6.0  |
| 7     | Webhook Enhancements       | ✅ Complete    | v0.7.0  |
| 8     | Business Features          | ✅ Complete    | v0.8.0  |
| 9     | Basic GET Operations       | ✅ Complete    | v0.9.0  |
| 10    | Enhanced Contact Operations| 📋 Planned     | v0.10.0 |
| 11    | Advanced Messaging         | 📋 Planned     | v0.11.0 |
| 12    | Full Newsletter Support    | 📋 Planned     | v0.12.0 |
| 13    | Full Product Management    | 📋 Planned     | v0.13.0 |
| 14    | Session & Lifecycle        | 📋 Planned     | v0.14.0 |
| 15    | Polish & Testing           | 📋 Planned     | v1.0.0  |

**Legend:**

- ✅ Complete - Implemented and tested
- 🔄 Partial - Most features implemented, some missing
- 📋 Planned - Not started

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

### Phase 1: Foundation (Week 1-2) ✅ COMPLETE

**Goal:** Basic API with instance management and simple messaging

| Feature                                           | Priority | Effort  | Status  |
| ------------------------------------------------- | -------- | ------- | ------- |
| Project setup (Fastify, TypeScript)               | P0       | 1 day   | ✅ Done |
| Authentication middleware (API key)               | P0       | 0.5 day | ✅ Done |
| InstanceManager service (CRUD)                    | P0       | 2 days  | ✅ Done |
| Basic instance routes (create, list, get, delete) | P0       | 1 day   | ✅ Done |
| Connect/disconnect routes                         | P0       | 1 day   | ✅ Done |
| Send text message endpoint                        | P0       | 1 day   | ✅ Done |
| Basic webhook dispatcher (message event only)     | P0       | 2 days  | ✅ Done |
| Swagger documentation setup                       | P1       | 0.5 day | ✅ Done |
| Docker setup                                      | P1       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Working API server (v0.1.0)
- ✅ Can create/delete/list instances
- ✅ Can connect instance and scan QR
- ✅ Can send text messages
- ✅ Webhook fires for incoming messages

### Phase 2: Core Messaging (Week 3) 🔄 PARTIAL

**Goal:** Complete messaging features

| Feature                                              | Priority | Effort  | Status  |
| ---------------------------------------------------- | -------- | ------- | ------- |
| Send media endpoints (image, video, audio, document) | P0       | 1 day   | ✅ Done |
| Message edit/delete endpoints                        | P1       | 0.5 day | ✅ Done |
| Reaction endpoint                                    | P1       | 0.5 day | ✅ Done |
| Forward message endpoint                             | P1       | 0.5 day | ✅ Done |
| Download media endpoint                              | P1       | 0.5 day | ✅ Done |
| Webhook events (edit, delete, reaction)              | P1       | 1 day   | ✅ Done |
| Quoting/replying support                             | P2       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Complete messaging capabilities (v0.10.0)
- ✅ All webhook events for messaging

### Phase 3: Contacts & Validation (Week 4) 🔄 PARTIAL

**Goal:** Contact management and number validation

| Feature                           | Priority | Effort  | Status  |
| --------------------------------- | -------- | ------- | ------- |
| Check number endpoint             | P0       | 0.5 day | ✅ Done |
| Batch check numbers endpoint      | P1       | 0.5 day | ✅ Done |
| Get contact info endpoint         | P1       | 0.5 day | ✅ Done |
| Get profile picture endpoint      | P1       | 0.5 day | ✅ Done |
| Add/edit/remove contact endpoints | P2       | 1 day   | ✅ Done |

**Deliverables:**

- ✅ Contact validation endpoints (v0.3.0)
- ✅ Contact CRUD operations (add/edit/remove) (v0.10.0)

### Phase 4: Group Management (Week 5) ✅ COMPLETE

**Goal:** Full group management capabilities

| Feature                               | Priority | Effort  | Status  |
| ------------------------------------- | -------- | ------- | ------- |
| Create group endpoint                 | P0       | 0.5 day | ✅ Done |
| Get group info endpoint               | P0       | 0.5 day | ✅ Done |
| Add/remove participants endpoints     | P0       | 1 day   | ✅ Done |
| Promote/demote admin endpoints        | P1       | 0.5 day | ✅ Done |
| Update group name/description/picture | P1       | 0.5 day | ✅ Done |
| Group invite link endpoints           | P1       | 1 day   | ✅ Done |
| Leave group endpoint                  | P2       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Complete group management API (v0.4.0)
- ✅ Integration tests for group operations
- ✅ Documentation updated

### Phase 5: Profile Management (Week 7) ✅ COMPLETE

**Goal:** Bot profile management

| Feature                         | Priority | Effort  | Status  |
| ------------------------------- | -------- | ------- | ------- |
| Update profile picture endpoint | P1       | 0.5 day | ✅ Done |
| Remove profile picture endpoint | P1       | 0.5 day | ✅ Done |
| Update profile name endpoint    | P1       | 0.5 day | ✅ Done |
| Update profile status endpoint  | P1       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Profile management endpoints (v0.5.0)
- ✅ Integration tests for profile operations
- ✅ Documentation updated

### Phase 6: Presence & UX (Week 6) ✅ COMPLETE

**Goal:** Presence indicators and UX features

| Feature                        | Priority | Effort  | Status  |
| ------------------------------ | -------- | ------- | ------- |
| Set presence endpoint          | P1       | 0.5 day | ✅ Done |
| Typing/recording indicators    | P1       | 0.5 day | ✅ Done |
| Mark as read endpoint          | P2       | 0.5 day | ✅ Done |
| Subscribe to presence endpoint | P2       | 0.5 day | ✅ Done |
| Webhook events for presence    | P2       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Presence and UX endpoints (v0.6.0)
- ✅ Integration tests (33 tests)
- ✅ Documentation updated

### Phase 7: Webhook Enhancements (Week 8) ✅ COMPLETE

**Goal:** Production-ready webhooks

| Feature                                  | Priority | Effort  | Status  |
| ---------------------------------------- | -------- | ------- | ------- |
| Webhook retry mechanism with backoff     | P0       | 1 day   | ✅ Done |
| Signature generation/verification        | P0       | 1 day   | ✅ Done |
| Webhook test endpoint                    | P1       | 0.5 day | ✅ Done |
| Webhook status dashboard endpoint        | P2       | 1 day   | ✅ Done |
| Configurable webhook events per instance | P1       | 0.5 day | ✅ Done |

**Deliverables:**

- ✅ Production-ready webhook system (v0.7.0)
- ✅ Integration tests (26 tests)
- ✅ Documentation updated

### Phase 8: Business Features (Week 9-10) ✅ COMPLETE

**Goal:** WhatsApp Business features

| Feature                      | Priority | Effort | Status  |
| ---------------------------- | -------- | ------ | ------- |
| Label management endpoints   | P2       | 1 day  | ✅ Done |
| Product catalog endpoints    | P2       | 1 day  | ✅ Done |
| Newsletter/channel endpoints | P2       | 1 day  | ✅ Done |

**Deliverables:**

- ✅ Optional Business features API (v0.8.0)
- ✅ Integration tests (27 tests)
- ✅ Documentation updated

### Phase 9: Basic GET Operations (Week 10) ✅ COMPLETE

**Goal:** Add missing basic GET endpoints for contacts, groups, profile, labels, chats, and messages

| Feature                                | Priority | Effort | Status  |
| -------------------------------------- | -------- | ------ | ------- |
| GET /instances/:id/contacts            | P0       | 2 days | ✅ Done |
| GET /instances/:id/groups              | P0       | 2 days | ✅ Done |
| GET /instances/:id/profile             | P0       | 1 day  | ✅ Done |
| GET /instances/:id/labels              | P0       | 1 day  | ✅ Done |
| GET /instances/:id/chats               | P0       | 1 day  | ✅ Done |
| GET /instances/:id/chats/:jid/messages | P0       | 1 day  | ✅ Done |
| Integration tests                      | P0       | 1 day  | ✅ Done |
| Update miaw-core with new methods      | P0       | 2 days | ✅ Done |

**New miaw-core Methods:**

- `fetchAllContacts()` - Get all contacts from in-memory store
- `fetchAllGroups()` - Get all groups via Baileys API
- `getOwnProfile()` - Get authenticated user's profile
- `fetchAllLabels()` - Get all labels from in-memory store
- `fetchAllChats()` - Get all chats from in-memory store
- `getChatMessages(jid)` - Get messages from a specific chat

**New API Endpoints:**
| Method | Endpoint | Description |
| ------ | ------------------------------------- | ------------------------ |
| GET | `/instances/:id/contacts` | Get all contacts |
| GET | `/instances/:id/groups` | Get all groups |
| GET | `/instances/:id/profile` | Get own profile |
| GET | `/instances/:id/labels` | Get all labels |
| GET | `/instances/:id/chats` | Get all chats |
| GET | `/instances/:id/chats/:jid/messages` | Get chat messages |

**Deliverables:**

- ✅ Basic GET operations API (v0.9.0)
- ✅ In-memory stores for contacts, labels, messages, chats
- ✅ Integration tests (12 tests total)

---

### Phase 10: Enhanced Contact Operations (Week 11) 📋 PLANNED

**Goal:** Full contact management capabilities matching miaw-core

| Feature                              | Priority | Effort  | Status  | miaw-core Method        |
| ------------------------------------ | -------- | ------- | ------- | ----------------------- |
| Get contact profile endpoint         | P0       | 0.5 day | 📋 Todo | `getContactProfile()`   |
| Get business profile endpoint        | P1       | 0.5 day | 📋 Todo | `getBusinessProfile()`  |
| Add/edit contact endpoint            | P1       | 1 day   | 📋 Todo | `addOrEditContact()`    |
| Remove contact endpoint              | P1       | 0.5 day | 📋 Todo | `removeContact()`       |
| Get group participants endpoint      | P1       | 0.5 day | 📋 Todo | `getGroupParticipants()`|
| Get group invite info endpoint       | P2       | 0.5 day | 📋 Todo | `getGroupInviteInfo()`  |

**New API Endpoints:**

| Method | Endpoint                                       | Description              |
| ------ | ---------------------------------------------- | ------------------------ |
| GET    | `/instances/:id/contacts/:jid/profile`         | Get full contact profile |
| GET    | `/instances/:id/contacts/:jid/business`        | Get business profile     |
| POST   | `/instances/:id/contacts`                      | Add or edit contact      |
| DELETE | `/instances/:id/contacts/:phone`               | Remove contact           |
| GET    | `/instances/:id/groups/:groupJid/participants` | Get group participants   |
| GET    | `/instances/:id/groups/invite/:code/info`      | Preview group before join|

**Deliverables:**

- Full contact management API (v0.10.0)
- Integration tests
- Documentation updated

---

### Phase 11: Advanced Messaging (Week 12) 📋 PLANNED

**Goal:** Complete messaging capabilities including media download and message pagination

| Feature                              | Priority | Effort  | Status  | miaw-core Method        |
| ------------------------------------ | -------- | ------- | ------- | ----------------------- |
| Download media endpoint              | P0       | 1 day   | 📋 Todo | `downloadMedia()`       |
| Remove reaction endpoint             | P1       | 0.5 day | 📋 Todo | `removeReaction()`      |
| Delete message for me endpoint       | P1       | 0.5 day | 📋 Todo | `deleteMessageForMe()`  |
| Load more messages (pagination)      | P1       | 1 day   | 📋 Todo | `loadMoreMessages()`    |
| Direct send image endpoint           | P2       | 0.5 day | 📋 Todo | `sendImage()`           |
| Direct send video endpoint           | P2       | 0.5 day | 📋 Todo | `sendVideo()`           |
| Direct send audio endpoint           | P2       | 0.5 day | 📋 Todo | `sendAudio()`           |
| Direct send document endpoint        | P2       | 0.5 day | 📋 Todo | `sendDocument()`        |

**New API Endpoints:**

| Method | Endpoint                                              | Description                    |
| ------ | ----------------------------------------------------- | ------------------------------ |
| GET    | `/instances/:id/messages/:messageId/media`            | Download media from message    |
| DELETE | `/instances/:id/messages/:messageId/reaction`         | Remove reaction from message   |
| DELETE | `/instances/:id/messages/:messageId/local`            | Delete message for self only   |
| GET    | `/instances/:id/chats/:jid/messages/load`             | Load older messages (paginate) |
| POST   | `/instances/:id/messages/image`                       | Send image (direct)            |
| POST   | `/instances/:id/messages/video`                       | Send video (direct)            |
| POST   | `/instances/:id/messages/audio`                       | Send audio (direct)            |
| POST   | `/instances/:id/messages/document`                    | Send document (direct)         |

**Deliverables:**

- Complete messaging API (v0.11.0)
- Media download functionality
- Message pagination support
- Integration tests

---

### Phase 12: Full Newsletter/Channel Support (Week 13-14) 📋 PLANNED

**Goal:** Complete newsletter/channel management matching miaw-core

| Feature                              | Priority | Effort  | Status  | miaw-core Method              |
| ------------------------------------ | -------- | ------- | ------- | ----------------------------- |
| Create newsletter endpoint           | P0       | 0.5 day | 📋 Todo | `createNewsletter()`          |
| Send newsletter text endpoint        | P0       | 0.5 day | 📋 Todo | `sendNewsletterMessage()`     |
| Send newsletter image endpoint       | P0       | 0.5 day | 📋 Todo | `sendNewsletterImage()`       |
| Send newsletter video endpoint       | P1       | 0.5 day | 📋 Todo | `sendNewsletterVideo()`       |
| Follow/unfollow newsletter           | P1       | 0.5 day | 📋 Todo | `followNewsletter()` / `unfollowNewsletter()` |
| Mute/unmute newsletter               | P1       | 0.5 day | 📋 Todo | `muteNewsletter()` / `unmuteNewsletter()`     |
| Update newsletter name               | P1       | 0.5 day | 📋 Todo | `updateNewsletterName()`      |
| Update newsletter description        | P1       | 0.5 day | 📋 Todo | `updateNewsletterDescription()`|
| Update newsletter picture            | P1       | 0.5 day | 📋 Todo | `updateNewsletterPicture()`   |
| Remove newsletter picture            | P2       | 0.5 day | 📋 Todo | `removeNewsletterPicture()`   |
| React to newsletter message          | P2       | 0.5 day | 📋 Todo | `reactToNewsletterMessage()`  |
| Subscribe to newsletter updates      | P2       | 0.5 day | 📋 Todo | `subscribeNewsletterUpdates()`|
| Get newsletter subscribers           | P2       | 0.5 day | 📋 Todo | `getNewsletterSubscribers()`  |
| Get newsletter admin count           | P2       | 0.5 day | 📋 Todo | `getNewsletterAdminCount()`   |
| Change newsletter owner              | P2       | 0.5 day | 📋 Todo | `changeNewsletterOwner()`     |
| Demote newsletter admin              | P2       | 0.5 day | 📋 Todo | `demoteNewsletterAdmin()`     |
| Delete newsletter                    | P2       | 0.5 day | 📋 Todo | `deleteNewsletter()`          |

**New API Endpoints:**

| Method | Endpoint                                                | Description                     |
| ------ | ------------------------------------------------------- | ------------------------------- |
| POST   | `/instances/:id/newsletters`                            | Create newsletter               |
| POST   | `/instances/:id/newsletters/:id/messages/text`          | Send text to newsletter         |
| POST   | `/instances/:id/newsletters/:id/messages/image`         | Send image to newsletter        |
| POST   | `/instances/:id/newsletters/:id/messages/video`         | Send video to newsletter        |
| POST   | `/instances/:id/newsletters/:id/follow`                 | Follow newsletter               |
| DELETE | `/instances/:id/newsletters/:id/follow`                 | Unfollow newsletter             |
| POST   | `/instances/:id/newsletters/:id/mute`                   | Mute newsletter                 |
| DELETE | `/instances/:id/newsletters/:id/mute`                   | Unmute newsletter               |
| PATCH  | `/instances/:id/newsletters/:id/name`                   | Update newsletter name          |
| PATCH  | `/instances/:id/newsletters/:id/description`            | Update newsletter description   |
| POST   | `/instances/:id/newsletters/:id/picture`                | Update newsletter picture       |
| DELETE | `/instances/:id/newsletters/:id/picture`                | Remove newsletter picture       |
| POST   | `/instances/:id/newsletters/:id/messages/:msgId/reaction`| React to newsletter message    |
| POST   | `/instances/:id/newsletters/:id/subscribe`              | Subscribe to updates            |
| GET    | `/instances/:id/newsletters/:id/subscribers`            | Get subscriber info             |
| GET    | `/instances/:id/newsletters/:id/admins/count`           | Get admin count                 |
| POST   | `/instances/:id/newsletters/:id/owner`                  | Transfer ownership              |
| DELETE | `/instances/:id/newsletters/:id/admins/:adminId`        | Demote admin                    |
| DELETE | `/instances/:id/newsletters/:id`                        | Delete newsletter               |

**Deliverables:**

- Complete newsletter/channel API (v0.12.0)
- Full CRUD operations for newsletters
- Integration tests

---

### Phase 13: Full Product Catalog Management (Week 15) 📋 PLANNED

**Goal:** Complete product catalog CRUD operations for WhatsApp Business

| Feature                              | Priority | Effort  | Status  | miaw-core Method        |
| ------------------------------------ | -------- | ------- | ------- | ----------------------- |
| Create product endpoint              | P0       | 1 day   | 📋 Todo | `createProduct()`       |
| Update product endpoint              | P0       | 1 day   | 📋 Todo | `updateProduct()`       |
| Delete products endpoint             | P1       | 0.5 day | 📋 Todo | `deleteProducts()`      |
| Get chats by label endpoint          | P2       | 0.5 day | 📋 Todo | `getChatsByLabel()`     |

**New API Endpoints:**

| Method | Endpoint                                    | Description          |
| ------ | ------------------------------------------- | -------------------- |
| POST   | `/instances/:id/products`                   | Create product       |
| PATCH  | `/instances/:id/products/:productId`        | Update product       |
| DELETE | `/instances/:id/products`                   | Delete products      |
| GET    | `/instances/:id/labels/:labelId/chats`      | Get chats by label   |

**Deliverables:**

- Complete product management API (v0.13.0)
- Full CRUD for products
- Integration tests

---

### Phase 14: Session & Lifecycle Management (Week 16) 📋 PLANNED

**Goal:** Complete session and instance lifecycle management

| Feature                              | Priority | Effort  | Status  | miaw-core Method        |
| ------------------------------------ | -------- | ------- | ------- | ----------------------- |
| Logout endpoint                      | P0       | 0.5 day | 📋 Todo | `logout()`              |
| Dispose endpoint                     | P1       | 0.5 day | 📋 Todo | `dispose()`             |
| Clear session endpoint               | P1       | 0.5 day | 📋 Todo | `clearSession()`        |
| Get message counts endpoint          | P2       | 0.5 day | 📋 Todo | `getMessageCounts()`    |
| Get labels store info endpoint       | P2       | 0.5 day | 📋 Todo | `getLabelsStoreInfo()`  |

**New API Endpoints:**

| Method | Endpoint                                    | Description              |
| ------ | ------------------------------------------- | ------------------------ |
| POST   | `/instances/:id/logout`                     | Logout (clears session)  |
| POST   | `/instances/:id/dispose`                    | Dispose and cleanup      |
| DELETE | `/instances/:id/session`                    | Clear session manually   |
| GET    | `/instances/:id/stats/messages`             | Get message counts       |
| GET    | `/instances/:id/stats/labels`               | Get labels store info    |

**Deliverables:**

- Complete lifecycle management API (v0.14.0)
- Session control endpoints
- Integration tests

---

### Phase 15: Polish & Testing (Week 17-18) 📋 PLANNED

**Goal:** Production readiness - Final phase before v1.0.0

| Feature                      | Priority | Effort | Status  |
| ---------------------------- | -------- | ------ | ------- |
| Comprehensive error handling | P0       | 2 days | 📋 Todo |
| Integration tests            | P0       | 3 days | 📋 Todo |
| Performance optimization     | P1       | 2 days | 📋 Todo |
| Documentation completion     | P1       | 2 days | 📋 Todo |
| Security audit               | P1       | 2 days | 📋 Todo |
| Load testing                 | P2       | 2 days | 📋 Todo |

**Deliverables:**

- Production-ready API (v1.0.0)
- Complete documentation
- Test coverage > 80%

---

## API Coverage Summary

### Current Coverage (v0.9.0)

| Category              | miaw-core Methods | API Endpoints | Coverage | Missing Features |
| --------------------- | ----------------- | ------------- | -------- | ---------------- |
| Instance Management   | 4                 | 4             | 100%     | - |
| Connection            | 5                 | 4             | 80%      | logout |
| Core Messaging        | 5                 | 5             | 100%     | - |
| Media Operations      | 1                 | 1             | 100%     | - |
| Message Manipulation  | 5                 | 4             | 80%      | removeReaction |
| Contact Management    | 9                 | 6             | 67%      | profile, business |
| Profile Management    | 5                 | 5             | 100%     | - |
| Presence & UX         | 5                 | 6             | 100%     | - |
| Group Management      | 15                | 12            | 80%      | participants, inviteInfo |
| Labels                | 5                 | 6             | 100%     | - |
| Product Catalog       | 5                 | 2             | 40%      | create, update, delete |
| Newsletters           | 17                | 2             | 12%      | Most operations |
| Data Fetch            | 6                 | 6             | 100%     | - |
| **TOTAL**             | **92+**           | **57**        | **~62%** | |

### Completed Gap-Fill (v0.10.0)

**Phase 2 (Core Messaging):** ✅ Download media endpoint added
**Phase 3 (Contacts & Validation):** ✅ Add/edit/remove contact endpoints added

### Target Coverage (v1.0.0)

After completing Phases 10-15, the API will have **100% coverage** of all miaw-core public methods.

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
