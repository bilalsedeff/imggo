/**
 * API Key endpoint registrations for OpenAPI
 */

import { registry } from '../registry';
import { z } from 'zod';
import { ApiKeyCreateSchema } from '@/schemas/api';
import { ErrorResponseSchema, SuccessResponseSchema } from '@/schemas/api';

// API Key response schema
const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  key: z.string(),
  key_type: z.enum(['test', 'live']),
  scopes: z.array(z.string()),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
}).openapi('ApiKeyResponse', {
  description: 'API key with secret included (only shown once)',
  example: {
    id: '880e8400-e29b-41d4-a716-446655440000',
    name: 'Production Server Key',
    key: 'imggo_live_abc123xyz789...',
    key_type: 'live',
    scopes: ['patterns:read', 'patterns:ingest', 'jobs:read'],
    created_at: '2025-01-15T10:00:00Z',
    expires_at: '2026-12-31T23:59:59Z'
  }
});

const ApiKeyListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
  key_type: z.enum(['test', 'live']),
  scopes: z.array(z.string()),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
  last_used_at: z.string().datetime().nullable(),
}).openapi('ApiKeyListItem', {
  description: 'API key list item (secret not included)',
  example: {
    id: '880e8400-e29b-41d4-a716-446655440000',
    name: 'Production Server Key',
    key_prefix: 'imggo_live_abc123',
    key_type: 'live',
    scopes: ['patterns:read', 'patterns:ingest'],
    created_at: '2025-01-15T10:00:00Z',
    expires_at: '2026-12-31T23:59:59Z',
    last_used_at: '2025-01-20T14:30:00Z'
  }
});

const ApiKeySuccessResponse = SuccessResponseSchema(ApiKeyResponseSchema);
const ApiKeyListResponse = SuccessResponseSchema(z.array(ApiKeyListItemSchema));

// POST /api/api-keys - Create API key
registry.registerPath({
  method: 'post',
  path: '/api/api-keys',
  summary: 'Create a new API key',
  description: 'Generate a new API key with specified scopes and expiration',
  tags: ['API Keys'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ApiKeyCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'API key created successfully. Save the key now - it won\'t be shown again!',
      content: {
        'application/json': {
          schema: ApiKeySuccessResponse,
        },
      },
    },
    400: {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Plan limit exceeded (max API keys reached)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// GET /api/api-keys - List API keys
registry.registerPath({
  method: 'get',
  path: '/api/api-keys',
  summary: 'List all API keys',
  description: 'Retrieve all API keys for the authenticated user (secrets not included)',
  tags: ['API Keys'],
  responses: {
    200: {
      description: 'API keys retrieved successfully',
      content: {
        'application/json': {
          schema: ApiKeyListResponse,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// DELETE /api/api-keys/:id - Delete API key
registry.registerPath({
  method: 'delete',
  path: '/api/api-keys/{id}',
  summary: 'Delete an API key',
  description: 'Permanently revoke an API key',
  tags: ['API Keys'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'API key ID',
        example: '880e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'API key deleted successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.object({ message: z.string() })),
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'API key not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});
