/**
 * API Type Definitions
 */

import type { MiawClientOptions, ProxyConfig } from 'miaw-core';

// ============================================================================
// Instance Types
// ============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'qr_required';

// ============================================================================
// Proxy Types
// ============================================================================

/**
 * Where an instance's effective proxy came from.
 *
 * Mirrors miaw-core's CLI precedence minus `MIAW_PROXY`, which this API
 * deliberately does not read - see docs/SECURITY.md.
 */
export type ProxySource = 'explicit' | 'pin-label' | 'pool' | 'none';

/** Names a `label=` entry in the MIAW_PROXY_FILE pool. Carries no credentials. */
export interface ProxyLabelRef {
  label: string;
}

/** Every form a caller may supply a proxy in. */
export type ProxyAssignment = ProxyConfig | string | ProxyLabelRef;

/**
 * The effective proxy for one instance, always credential-masked.
 *
 * `url`/`protocol` describe what is *configured*. The live-socket facts come
 * from miaw-core's `getProxyInfo()`, renamed here because core's `pending`
 * means the old egress still in use - the opposite of what the name suggests.
 */
export interface EffectiveProxyInfo {
  source: ProxySource;
  url: string | null;
  protocol: string | null;
  /** SOCKS proxies do not carry media downloads; only HTTP(S) do. */
  downloadProxied: boolean;
  /** The open socket is dialling through this configuration. */
  active: boolean;
  /** Configured but not yet in force; a reconnect applies it. */
  appliesOnNextConnect: boolean;
  /** Written to instances.json, so it survives a restart. */
  persisted: boolean;
  /** What the open socket is using instead, when that differs. */
  liveProxy: { url: string; protocol: string } | null;
}

// ============================================================================
// Persistent Instance Store
// ============================================================================

/**
 * A proxy assignment persisted to `<sessionPath>/instances.json`.
 *
 * Exactly one of `url` / `label` is set. A `label` names an entry in the
 * `MIAW_PROXY_FILE` pool and stores no credentials, so prefer it.
 *
 * This is miaw-core's own pin shape - the file is shared with
 * `miaw-cli instance set-proxy`.
 */
export interface InstanceProxyPin {
  url?: string;
  label?: string;
  updatedAt?: string;
}

/**
 * One instance's persisted record.
 *
 * `proxy` is miaw-core's field; the rest are this API's additions. The index
 * signature is load-bearing: miaw-cli writes records through unchanged, and we
 * must do the same for anything it adds that we do not know about.
 */
export interface StoredInstanceRecord {
  proxy?: InstanceProxyPin;
  webhookUrl?: string;
  webhookEvents?: WebhookEvent[];
  clientOptions?: Omit<InstanceClientOptions, 'proxy'>;
  [key: string]: unknown;
}

export interface InstanceConfigFile {
  version: 1;
  instances: Record<string, StoredInstanceRecord>;
}

export type InstanceClientOptions = Pick<
  MiawClientOptions,
  | 'debug'
  | 'autoReconnect'
  | 'maxReconnectAttempts'
  | 'reconnectDelay'
  | 'stuckStateTimeout'
  | 'qrGracePeriod'
  | 'qrScanTimeout'
  | 'connectionTimeout'
  | 'syncFullHistory'
  | 'browser'
  | 'proxy'
  | 'usePairingCode'
  | 'phoneNumber'
>;

export interface InstanceConfig {
  instanceId: string;
  webhookUrl?: string;
  webhookEvents?: WebhookEvent[];
  webhookEnabled?: boolean;
  clientOptions?: InstanceClientOptions;
}

export interface InstanceState {
  instanceId: string;
  status: ConnectionState;
  webhookUrl?: string;
  webhookEvents: WebhookEvent[];
  webhookEnabled: boolean;
  createdAt: Date;
  lastActivity: Date;
  connectedAt?: Date;
  phoneNumber?: string;
  authMode: 'qr' | 'pairing_code';
  /** Computed on read, so it can never go stale. Credentials are masked. */
  proxy?: EffectiveProxyInfo;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookEvent =
  | 'test'
  | 'qr'
  | 'ready'
  | 'message'
  | 'message_edit'
  | 'message_delete'
  | 'message_reaction'
  | 'message_receipt'
  | 'poll_vote'
  | 'pairing_code'
  | 'presence'
  | 'connection'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'session_saved';

export interface WebhookPayload {
  event: WebhookEvent;
  instanceId: string;
  timestamp: number;
  data: any;
}

// ============================================================================
// Message Types
// ============================================================================

export interface SendTextOptions {
  quoted?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  timestamp?: number;
  error?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResult<T = any> = ApiResponse<T> | ApiError;

// ============================================================================
// HTTP Types
// ============================================================================

export interface HttpError extends Error {
  statusCode: number;
  code: string;
}
