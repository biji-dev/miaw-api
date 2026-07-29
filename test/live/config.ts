export interface LiveTestConfig {
  authMode: 'pairing_code' | 'qr';
  phone: string;
  contactA: string;
  contactB: string;
  groupJid?: string;
  communityJid?: string;
  instanceId: string;
}

const digits = /^[0-9]+$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env.live-test`);
  return value;
}

export function loadLiveTestConfig(): LiveTestConfig {
  if (process.env.MIAW_RUN_LIVE_TESTS !== 'true') {
    throw new Error('Set MIAW_RUN_LIVE_TESTS=true to run live WhatsApp tests');
  }
  if (process.env.MIAW_LIVE_CONFIRM_DESTRUCTIVE !== 'true') {
    throw new Error('Set MIAW_LIVE_CONFIRM_DESTRUCTIVE=true for isolated destructive tests');
  }

  const phone = required('MIAW_LIVE_PHONE');
  const contactA = required('MIAW_LIVE_CONTACT_A');
  const contactB = required('MIAW_LIVE_CONTACT_B');
  for (const [name, value] of Object.entries({ MIAW_LIVE_PHONE: phone, MIAW_LIVE_CONTACT_A: contactA, MIAW_LIVE_CONTACT_B: contactB })) {
    if (!digits.test(value)) throw new Error(`${name} must contain digits only`);
  }
  if (new Set([phone, contactA, contactB]).size !== 3) {
    throw new Error('Live phone and contacts must be three distinct dedicated accounts');
  }

  return {
    authMode: process.env.MIAW_LIVE_AUTH === 'pairing_code' ? 'pairing_code' : 'qr',
    phone,
    contactA,
    contactB,
    groupJid: process.env.MIAW_LIVE_GROUP_JID?.trim() || undefined,
    communityJid: process.env.MIAW_LIVE_COMMUNITY_JID?.trim() || undefined,
    instanceId: process.env.MIAW_LIVE_INSTANCE_ID?.trim() || 'live-integration-bot',
  };
}
