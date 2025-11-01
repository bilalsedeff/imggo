/**
 * Job endpoint registrations for OpenAPI
 */

import { registry } from '../registry';
import { z } from 'zod';
import {
  IngestRequestSchema,
  JobSchema,
} from '@/schemas/manifest';
import { ErrorResponseSchema, SuccessResponseSchema } from '@/schemas/api';

// Register Job schema components
registry.register('Job', JobSchema);

// Success response wrappers
const JobSuccessResponse = SuccessResponseSchema(JobSchema);
const IngestSuccessResponse = SuccessResponseSchema(
  z.object({
    job_id: z.string().uuid(),
    status: z.enum(['queued']),
    message: z.string(),
  }).openapi('IngestResponse', {
    example: {
      job_id: '770e8400-e29b-41d4-a716-446655440000',
      status: 'queued',
      message: 'Image queued for processing'
    }
  })
);

// POST /api/patterns/:id/ingest - Submit image for processing
registry.registerPath({
  method: 'post',
  path: '/api/patterns/{id}/ingest',
  summary: 'Submit image for processing',
  description: 'Queue an image for analysis using the specified pattern',
  tags: ['Jobs'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Pattern ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
    headers: z.object({
      'Idempotency-Key': z.string().optional().openapi({
        description: 'Optional idempotency key to prevent duplicate processing',
        example: 'unique-request-id-12345',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: IngestRequestSchema,
        },
      },
    },
  },
  responses: {
    202: {
      description: 'Image queued for processing',
      content: {
        'application/json': {
          schema: IngestSuccessResponse,
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
      description: 'Insufficient permissions or rate limit exceeded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Pattern not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// GET /api/jobs/:id - Get job status
registry.registerPath({
  method: 'get',
  path: '/api/jobs/{id}',
  summary: 'Get job status and results',
  description: 'Retrieve the current status and results of a processing job',
  tags: ['Jobs'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Job ID',
        example: '770e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Job retrieved successfully',
      content: {
        'application/json': {
          schema: JobSuccessResponse,
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
      description: 'Job not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});
