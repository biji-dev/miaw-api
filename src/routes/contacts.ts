import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const contactParams = {
  type: 'object',
  required: ['instanceId', 'contactId'],
  properties: {
    instanceId: { type: 'string' },
    contactId: { type: 'string' },
  },
};

export function normalizeContactId(contactId: string): { jid: string; phone: string } {
  const decoded = decodeURIComponent(contactId);
  if (/^[0-9]{7,15}$/.test(decoded)) {
    return { jid: `${decoded}@s.whatsapp.net`, phone: decoded };
  }
  if (/^[^@\s]+@[^@\s]+$/.test(decoded)) {
    return { jid: decoded, phone: decoded.split('@', 1)[0] };
  }
  throw new BadRequestError('contactId must be a phone number or JID');
}

export async function contactRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.post('/instances/:instanceId/contacts/checks', {
    schema: {
      tags: ['Contacts'],
      summary: 'Check phone numbers',
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: { instanceId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['phones'],
        properties: {
          phones: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: { type: 'string', pattern: '^[0-9]{7,15}$' },
          },
        },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { phones } = request.body as { phones: string[] };
    const items = await getConnectedClient(server, instanceId).checkNumbers(phones);
    return { success: true, data: { items, total: items.length } };
  });

  server.get('/instances/:instanceId/contacts/:contactId', {
    schema: { tags: ['Contacts'], summary: 'Get contact', params: contactParams },
  }, async (request) => {
    const { instanceId, contactId } = request.params as { instanceId: string; contactId: string };
    const { jid } = normalizeContactId(contactId);
    const data = await getConnectedClient(server, instanceId).getContactInfo(jid);
    return { success: true, data };
  });

  server.put('/instances/:instanceId/contacts/:contactId', {
    schema: {
      tags: ['Contacts'],
      summary: 'Create or replace contact',
      params: contactParams,
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { instanceId, contactId } = request.params as { instanceId: string; contactId: string };
    const body = request.body as { name: string; firstName?: string; lastName?: string };
    const { phone } = normalizeContactId(contactId);
    const result = await getConnectedClient(server, instanceId).addOrEditContact({ phone, ...body });
    requireCoreSuccess(result, 'Save contact');
    return { success: true, data: { contactId, phone, name: body.name } };
  });

  server.delete('/instances/:instanceId/contacts/:contactId', {
    schema: { tags: ['Contacts'], summary: 'Remove contact', params: contactParams },
  }, async (request) => {
    const { instanceId, contactId } = request.params as { instanceId: string; contactId: string };
    const { phone } = normalizeContactId(contactId);
    const result = await getConnectedClient(server, instanceId).removeContact(phone);
    requireCoreSuccess(result, 'Remove contact');
    return { success: true, data: { contactId, phone, removed: true } };
  });

  const reads = [
    ['profile', 'Get contact profile', (client: ReturnType<typeof getConnectedClient>, id: string) => client.getContactProfile(id)],
    ['profile-picture', 'Get contact profile picture', async (client: ReturnType<typeof getConnectedClient>, id: string) => ({ url: await client.getProfilePicture(id) })],
    ['business-profile', 'Get contact business profile', (client: ReturnType<typeof getConnectedClient>, id: string) => client.getBusinessProfile(id)],
  ] as const;

  for (const [path, summary, execute] of reads) {
    server.get(`/instances/:instanceId/contacts/:contactId/${path}`, {
      schema: { tags: ['Contacts'], summary, params: contactParams },
    }, async (request) => {
      const { instanceId, contactId } = request.params as { instanceId: string; contactId: string };
      const { jid } = normalizeContactId(contactId);
      return { success: true, data: await execute(getConnectedClient(server, instanceId), jid) };
    });
  }
}
