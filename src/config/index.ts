/**
 * Environment configuration
 */

interface Config {
  // API Configuration
  port: number;
  host: string;
  apiKey: string;
  webhookSecret: string;

  // CORS
  corsOrigin: string;

  // Session Storage
  sessionPath: string;

  // Webhook Configuration
  webhookTimeout: number;
  webhookMaxRetries: number;
  webhookRetryDelay: number;

  // Logging
  logLevel: string;
}

function loadConfig(): Config {
  return {
    port: parseInt(process.env.API_PORT || '3000', 10),
    host: process.env.API_HOST || '0.0.0.0',
    apiKey: process.env.API_KEY || 'miaw-api-key',
    webhookSecret: process.env.API_WEBHOOK_SECRET || 'webhook-secret',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    sessionPath: process.env.SESSION_PATH || './sessions',
    webhookTimeout: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
    webhookMaxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '6', 10),
    webhookRetryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '60000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

export const config = loadConfig();
