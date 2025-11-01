/**
 * Webhook endpoint registrations for OpenAPI
 */

import { registry } from '../registry';
import { z } from 'zod';
import { WebhookCreateSchema } from '@/schemas/api';
import { ErrorResponseSchema, SuccessResponseSchema } from '@/schemas/api';

// Webhook response schema
const WebhookSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_triggered_at: z.string().datetime().nullable(),
}).openapi('Webhook', {
  description: 'Webhook configuration',
  example: {
    id: '990e8400-e29b-41d4-a716-446655440000',
    user_id: '660e8400-e29b-41d4-a716-446655440000',
    url: 'https://your-server.com/webhooks/imggo',
    events: ['job.succeeded', 'job.failed'],
    secret: 'whsec_abc123xyz789...',
    is_active: true,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    last_triggered_at: '2025-01-20T14:30:00Z'
  }
});

const WebhookSuccessResponse = SuccessResponseSchema(WebhookSchema);
const WebhookListResponse = SuccessResponseSchema(z.array(WebhookSchema));

// POST /api/webhooks - Create webhook
registry.registerPath({
  method: 'post',
  path: '/api/webhooks',
  summary: 'Create a new webhook',
  description: 'Register a webhook URL to receive notifications when jobs complete',
  tags: ['Webhooks'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: WebhookCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Webhook created successfully. Save the secret for signature verification!',
      content: {
        'application/json': {
          schema: WebhookSuccessResponse,
        },
      },
    },
    400: {
      description: 'Invalid request body or webhook URL',
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
      description: 'Plan limit exceeded (max webhooks reached)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// GET /api/webhooks - List webhooks
registry.registerPath({
  method: 'get',
  path: '/api/webhooks',
  summary: 'List all webhooks',
  description: 'Retrieve all registered webhooks for the authenticated user',
  tags: ['Webhooks'],
  responses: {
    200: {
      description: 'Webhooks retrieved successfully',
      content: {
        'application/json': {
          schema: WebhookListResponse,
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

// DELETE /api/webhooks/:id - Delete webhook
registry.registerPath({
  method: 'delete',
  path: '/api/webhooks/{id}',
  summary: 'Delete a webhook',
  description: 'Remove a webhook configuration',
  tags: ['Webhooks'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Webhook ID',
        example: '990e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Webhook deleted successfully',
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
      description: 'Webhook not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});
