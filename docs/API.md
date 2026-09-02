# Miaw API v2 Guide

**API version:** 2.1.0
**Core compatibility:** `miaw-core` 1.10.0
**Last updated:** 2026-07-29

The generated reference is the authoritative field-level contract:

- Scalar UI: `GET /docs`
- OpenAPI JSON: `GET /documentation/json`

`/health`, `/docs`, and `/documentation/json` are unversioned. Protected
routes start with `/api/v1` and accept either
`Authorization: Bearer <API_KEY>` or `X-API-Key: <API_KEY>`.

## Response contract

Successful single-resource responses use:

```json
{"success":true,"data":{}}
```

Collections put pagination metadata inside `data`:

```json
{"success":true,"data":{"items":[],"total":0}}
```

Errors retain the existing envelope:

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

A `miaw-core` result containing `success:false` is translated to HTTP `400`.
Successful core results never expose a nested `data.success`.

## Instance setup

Create an instance with `POST /api/v1/instances`:

```json
{
  "instanceId": "support",
  "webhookUrl": "https://example.com/whatsapp-events",
  "webhookEvents": ["ready", "message", "message_receipt", "error"]
}
```

Pairing-code authentication and proxy configuration can be supplied through
`clientOptions`. Proxy credentials are never returned. Connect using
`PUT /api/v1/instances/support/connection`, then read the transient challenge
from `/authentication/qr-code` or `/authentication/pairing-code`.

Supported proxy schemes are `http`, `https`, `socks`, `socks4`, `socks4a`,
`socks5`, and `socks5h`. Prefer HTTP(S) when media downloads must also use the
proxy; SOCKS carries the WhatsApp connection and media uploads, but incoming
media downloads remain direct.

## Proxy management

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/proxy-pool` | Inspect the configured pool with masked credentials |
| `POST` | `/api/v1/proxy-pool/reloads` | Atomically reload the mounted pool file |
| `POST` | `/api/v1/proxy-tests` | Test reachability without creating or pairing an instance |
| `GET` | `/api/v1/instances/:instanceId/proxy` | Inspect the effective instance proxy |
| `PUT` | `/api/v1/instances/:instanceId/proxy` | Set an explicit proxy on an instance |
| `DELETE` | `/api/v1/instances/:instanceId/proxy` | Clear the override and return to the pool/direct route |

### Setting a proxy

`PUT /api/v1/instances/:instanceId/proxy` accepts:

```jsonc
{
  "proxy": { "url": "socks5h://host:1080", "username": "u", "password": "p" },
  "validate": false,  // probe reachability first; 400 when unreachable
  "force": false,     // permit the change on a live instance
  "persist": true     // write the assignment to instances.json
}
```

`proxy` also accepts a plain URL string, a `{ "label": "eu" }` reference to the
pool, or `null` to clear the assignment. `DELETE` takes `?force=true` for the
same effect as `{ "proxy": null, "force": true }`.

The instance must be `disconnected` unless `force` is set, and the operation
returns `409` otherwise. With `force`, the instance is disconnected, the new
proxy is staged, and it is reconnected — in that order, because miaw-core stages
a proxy for the next connect rather than touching a live socket.

**Changing a paired session's egress IP is read by WhatsApp as account
takeover.** `force` exists for a dead proxy, not for routine rotation.

### Setting a proxy while connecting

`PUT /api/v1/instances/:instanceId/connection` and
`POST /api/v1/instances/:instanceId/connection-restarts` accept the same body,
with every field optional. Sending no body at all connects the instance
unchanged, exactly as before.

```bash
curl -X PUT .../instances/support/connection \
  -d '{"proxy":"socks5h://host:1080","validate":true}'
```

The proxy is applied before the socket opens, so the pairing itself comes from
the final egress IP.

### Reading the effective proxy

`GET /api/v1/instances/:instanceId/proxy` returns, and every instance in
`GET /api/v1/instances` now carries, the same object:

```jsonc
{
  "source": "pin-label",         // explicit | pin-label | pool | none
  "url": "socks5h://user:****@eu1.example.com:1080/",
  "protocol": "socks5h",
  "downloadProxied": false,      // false for SOCKS: downloads bypass the proxy
  "active": true,                // the open socket is using this configuration
  "appliesOnNextConnect": false, // configured, but a reconnect is needed
  "persisted": true,             // survives a restart
  "liveProxy": null              // what the socket uses instead, when it differs
}
```

Precedence is: an explicit assignment, then the stored pin, then the
`MIAW_PROXY_FILE` pool, then a direct connection. Unlike `miaw-cli`, this API
does **not** read `MIAW_PROXY` — a global environment proxy would silently
outrank every per-instance assignment.

### Persistence

Instances and their proxy assignments are written to
`<SESSION_PATH>/instances.json` and restored at boot, so a restart cannot
silently move a paired session to a different egress IP. This is the same file
`miaw-cli instance set-proxy` uses, and the two interoperate: each preserves the
other's fields.

Restored instances are **not** connected automatically. Set
`RESTORE_AUTOCONNECT=true` to connect them sequentially at boot.

A `label` pin stores no credentials — only the label — so prefer it over a URL
when the proxy is in the pool. A corrupt `instances.json` fails startup rather
than being treated as empty, because an empty store would connect every instance
directly and leak the egress IP the pins exist to hide.

### Testing a proxy

`POST /api/v1/proxy-tests` accepts:

```json
{
  "proxy": {
    "url": "http://proxy.example.com:8080",
    "username": "region-id",
    "password": "secret"
  },
  "timeoutMs": 10000
}
```

The timeout range is 1–30 seconds. A completed probe returns HTTP `200` even
when `data.reachable` is false; invalid proxy configuration returns `400`.

## Canonical route families

The tables omit the common `/api/v1/instances/:instanceId` prefix.

### Instances and lifecycle

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/v1/instances` | List or create instances |
| `GET`, `DELETE` | `/api/v1/instances/:instanceId` | Inspect or remove an instance |
| `PATCH` | `/api/v1/instances/:instanceId/webhook` | Update instance webhook configuration |
| `GET`, `PUT`, `DELETE` | `/connection` | Inspect, connect, or disconnect |
| `POST` | `/connection-restarts` | Restart a connection |
| `DELETE` | `/session` | Log out of WhatsApp |
| `DELETE` | `/authentication` | Remove local credentials |
| `GET` | `/authentication/qr-code`, `/authentication/pairing-code` | Read an authentication challenge |
| `GET`, `PATCH`, `DELETE` | `/runtime` | Inspect, update, or dispose runtime state |
| `GET` | `/stats/messages`, `/stats/labels` | Read statistics |
| `GET`, `PATCH` | `/webhook` | Read or update webhook configuration |
| `GET` | `/webhook/stats` | Read delivery statistics |
| `POST` | `/webhook-tests` | Send an isolated test event |

### Messages, chats, statuses, and presence

| Method | Path |
| --- | --- |
| `POST` | `/messages/text`, `/messages/image`, `/messages/video`, `/messages/audio`, `/messages/document` |
| `POST` | `/messages/location`, `/messages/contact`, `/messages/sticker`, `/messages/poll` |
| `PATCH`, `DELETE` | `/messages/:messageId` |
| `PUT`, `DELETE` | `/messages/:messageId/reaction` |
| `POST` | `/messages/:messageId/forward` |
| `PUT`, `DELETE` | `/messages/:messageId/star` |
| `GET` | `/messages/:messageId/media` |
| `PUT` | `/messages/:messageId/read-receipt` |
| `GET` | `/chats`, `/chats/:chatJid/messages` |
| `POST` | `/chats/:chatJid/message-history-loads` |
| `PUT`, `DELETE` | `/chats/:chatJid/archive`, `/pin`, `/mute` |
| `PUT` | `/chats/:chatJid/read-state`, `/chats/:chatJid/presence` |
| `DELETE` | `/chats/:chatJid/messages`, `/chats/:chatJid` |
| `PUT` | `/presence` |
| `POST` | `/statuses/text`, `/statuses/image`, `/statuses/video` |

Message deletion accepts `scope=everyone|local`, optional `chatJid`, and
`deleteMedia=true|false`. Message lookup hints belong in the query. History
loading uses a JSON body with optional `count` and `timeoutMs`.

### Contacts and own profile

| Method | Path |
| --- | --- |
| `GET` | `/contacts` |
| `POST` | `/contacts/checks` with `{"phones":[...]}` |
| `GET`, `PUT`, `DELETE` | `/contacts/:contactId` |
| `GET` | `/contacts/:contactId/profile`, `/profile-picture`, `/business-profile` |
| `PUT` | `/contacts/:contactId/presence-subscription` |
| `GET`, `PATCH` | `/profile` |
| `PUT`, `DELETE` | `/profile/picture` |

`contactId` accepts either a 7–15 digit phone number or a JID. `PATCH /profile`
accepts `name` and/or `about`.

### Groups and communities

Group and community collections use standard `GET`/`POST`; items use
`GET`/`PATCH`/`DELETE`. Participant changes use:

```json
{"operation":"add","participants":["6281234567890"]}
```

`operation` is `add`, `remove`, `promote`, or `demote`. Pictures and linked-group
assignments use `PUT`. Invites use `GET`/`DELETE` on
`/groups/:groupJid/invite` or `/communities/:communityJid/invite`. Invite
inspection and joining use `/group-invites/:inviteCode`,
`/group-memberships`, `/community-invites/:inviteCode`, and
`/community-memberships`.

### Business, catalog, and newsletters

| Method | Path |
| --- | --- |
| `GET`, `POST` | `/labels` |
| `PATCH`, `DELETE` | `/labels/:labelId` |
| `PUT`, `DELETE` | `/chats/:chatJid/labels/:labelId` |
| `PUT`, `DELETE` | `/messages/:messageId/labels/:labelId` |
| `GET`, `POST` | `/catalog/products` |
| `PATCH`, `DELETE` | `/catalog/products/:productId` |
| `GET` | `/catalog/collections` |
| `POST` | `/catalog/product-deletions` |
| `PATCH` | `/business/profile` |
| `POST` | `/business/cover-photos`, `/business/order-lookups`, `/business/quick-replies` |
| `DELETE` | `/business/cover-photos/:coverPhotoId`, `/business/quick-replies/:timestamp` |
| `POST` | `/newsletters` |
| `GET`, `PATCH`, `DELETE` | `/newsletters/:newsletterId` |
| `PUT`, `DELETE` | Newsletter picture, follow, mute, and message-reaction state |
| `PUT` | `/newsletters/:newsletterId/updates-subscription` |
| `PATCH` | `/newsletters/:newsletterId/owner` |

### LID operations

| Method | Path |
| --- | --- |
| `GET`, `DELETE` | `/lids` |
| `GET`, `PUT` | `/lids/:lid` |
| `POST` | `/lid-resolutions` |
| `GET` | `/phone-numbers/:phone/lid` |

## Webhooks and media

REST media fields accept HTTP(S) URLs. Local paths, raw buffers, and multipart
uploads are not accepted. Webhook deliveries include `X-Miaw-Signature` and
`X-Miaw-Timestamp`; see [SECURITY.md](./SECURITY.md).

## Verification

```bash
pnpm build
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:coverage
```

Run `pnpm test:live` only with the isolated `.env.live-test` account and its
destructive-operation safeguards enabled.
