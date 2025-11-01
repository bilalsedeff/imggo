/**
 * System endpoint registrations for OpenAPI (Health checks, Demo endpoints)
 */

import { registry } from '../registry';
import { z } from 'zod';
import { ErrorResponseSchema, SuccessResponseSchema } from '@/schemas/api';

// Health check response schema
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.enum(['up', 'down']),
    storage: z.enum(['up', 'down']),
    queue: z.enum(['up', 'down']),
  }),
}).openapi('HealthResponse', {
  description: 'System health status',
  example: {
    status: 'healthy',
    timestamp: '2025-01-15T10:00:00Z',
    services: {
      database: 'up',
      storage: 'up',
      queue: 'up'
    }
  }
});

// GET /api/_health - Health check
registry.registerPath({
  method: 'get',
  path: '/api/_health',
  summary: 'Health check',
  description: 'Check the health status of the ImgGo API and its dependencies',
  tags: ['System'],
  responses: {
    200: {
      description: 'System is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
    503: {
      description: 'System is degraded or unhealthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
  security: [], // No authentication required for health check
});

// Demo endpoints (public, no auth)
const DemoProcessResponseSchema = SuccessResponseSchema(
  z.object({
    job_id: z.string().uuid(),
    status: z.enum(['queued']),
    message: z.string(),
    demo_expires_at: z.string().datetime(),
  }).openapi('DemoProcessResponse', {
    example: {
      job_id: '770e8400-e29b-41d4-a716-446655440000',
      status: 'queued',
      message: 'Demo image queued for processing',
      demo_expires_at: '2025-01-15T11:00:00Z'
    }
  })
);

// POST /api/demo/process - Demo image processing
registry.registerPath({
  method: 'post',
  path: '/api/demo/process',
  summary: 'Process demo image (public)',
  description: 'Try ImgGo with a demo image without authentication. Limited to 3 requests per hour.',
  tags: ['Demo'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            image_url: z.string().url(),
            pattern_type: z.enum(['product', 'receipt', 'document']).optional(),
          }).openapi('DemoProcessRequest', {
            example: {
              image_url: 'https://example.com/demo-image.jpg',
              pattern_type: 'product'
            }
          }),
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Demo image queued successfully',
      content: {
        'application/json': {
          schema: DemoProcessResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: 'Demo rate limit exceeded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [], // Public endpoint
});

// GET /api/demo/status/:job_id - Get demo job status
registry.registerPath({
  method: 'get',
  path: '/api/demo/status/{job_id}',
  summary: 'Get demo job status (public)',
  description: 'Check the status of a demo processing job',
  tags: ['Demo'],
  request: {
    params: z.object({
      job_id: z.string().uuid().openapi({
        description: 'Demo job ID',
        example: '770e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Demo job status retrieved',
      content: {
        'application/json': {
          schema: SuccessResponseSchema(
            z.object({
              job_id: z.string().uuid(),
              status: z.enum(['queued', 'running', 'succeeded', 'failed']),
              manifest: z.record(z.unknown()).nullable(),
              error: z.string().nullable(),
            })
          ),
        },
      },
    },
    404: {
      description: 'Demo job not found or expired',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [], // Public endpoint
});
