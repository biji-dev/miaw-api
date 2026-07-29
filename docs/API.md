# Miaw API Guide

**API version:** 1.2.1
**Core compatibility:** `miaw-core` 1.9.1
**Last updated:** 2026-07-29

The generated API reference is the authoritative field-level contract:

- Scalar UI: `GET /docs`
- OpenAPI JSON: `GET /documentation/json`

All routes except `/health`, `/docs`, and the OpenAPI document require either:

```http
Authorization: Bearer <API_KEY>
```

or:

```http
X-API-Key: <API_KEY>
```

## Create an instance

QR authentication is the default:

```json
{
  "instanceId": "support",
  "webhookUrl": "https://example.com/whatsapp-events",
  "webhookEvents": ["ready", "message", "message_receipt", "error"]
}
```

Pairing-code authentication and HTTP proxy configuration are set at creation:

```json
{
  "instanceId": "support",
  "clientOptions": {
    "usePairingCode": true,
    "phoneNumber": "6281234567890",
    "proxy": {
      "url": "http://proxy.example.com:8080",
      "username": "proxy-user",
      "password": "proxy-password"
    },
    "autoReconnect": true,
    "syncFullHistory": true
  }
}
```

Proxy credentials are never returned. Runtime inspection uses the masked proxy
information supplied by core.

Connect with `POST /instances/:id/connect`, then retrieve a transient challenge
from `GET /instances/:id/auth/qr` or
`GET /instances/:id/auth/pairing-code`. Challenges are API-key protected and
cleared once the client is ready.

## Route groups

| Group | Route prefix | Capabilities |
| --- | --- | --- |
| Instances | `/instances` | CRUD and webhook configuration |
| Connection/session | `/instances/:id` | Connect, restart, logout, dispose, session clear, status |
| Messaging | `/instances/:id/messages` and legacy `/send-*` | Rich sends, edits, deletes, reactions, forwarding, stars, media |
| Chats/statuses | `/instances/:id/chats`, `/instances/:id/statuses` | Inbox state and status stories |
| Contacts/profiles | `/instances/:id/contacts`, `/instances/:id/profile` | Lookup, validation, writes, own profile |
| Groups | `/instances/:id/groups` | Metadata, participants, admins, invites |
| Communities | `/instances/:id/communities` | Lifecycle, linked groups, members, admins, invites |
| Business | `/instances/:id/business`, `/labels`, `/products` | Profile, covers, orders, replies, labels, catalog |
| Newsletters | `/instances/:id/newsletters` | Lifecycle, messages, subscriptions, admin operations |
| Operations | `/instances/:id/runtime`, `/instances/:id/lids` | Runtime toggles, proxy info, LID resolution |
| Webhooks | `/instances/:id/webhook` | Test delivery and statistics |

## Media inputs

REST media fields accept HTTP(S) URLs only. Local server paths, raw buffers, and
multipart uploads are intentionally unsupported. The legacy generic media route
accepts an optional `type` (`image`, `video`, `audio`, or `document`) and falls
back to MIME type or URL-extension inference.

## Message references

Core operations require a stored `MiawMessage`. HTTP clients provide a
`messageId` and may include `chatJid` to make lookup deterministic. Reply-capable
send routes accept `quoted` and optional `quotedChatJid`. A missing stored
message returns `404`.

## Webhook events

Supported filters are:

`test`, `qr`, `pairing_code`, `ready`, `message`, `message_edit`,
`message_delete`, `message_reaction`, `message_receipt`, `poll_vote`, `presence`,
`connection`, `disconnected`, `reconnecting`, `session_saved`, and `error`.

Omit `webhookEvents` or pass `[]` to receive all events. Deliveries include
`X-Miaw-Signature` and `X-Miaw-Timestamp`; see [SECURITY.md](./SECURITY.md) for
verification guidance.

## Errors

Errors use a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed",
    "correlationId": "..."
  }
}
```

See [ERROR-CODES.md](./ERROR-CODES.md) for status codes and troubleshooting.
