/**
 * Storage endpoint registrations for OpenAPI
 */

import { registry } from '../registry';
import { z } from 'zod';
import { ErrorResponseSchema, SuccessResponseSchema, CreateSignedUploadUrlRequestSchema } from '@/schemas/api';

// Signed upload response schema
const SignedUploadResponseSchema = z.object({
  url: z.string().url(),
  token: z.string(),
  expires_at: z.string().datetime(),
  upload_path: z.string(),
}).openapi('SignedUploadResponse', {
  description: 'Signed upload URL with token and expiration',
  example: {
    url: 'https://storage.imggo.ai/upload/signed-url-here',
    token: 'upload_token_abc123xyz789',
    expires_at: '2025-01-15T11:00:00Z',
    upload_path: 'uploads/user-123/image-456.jpg'
  }
});

const SignedUploadSuccessResponse = SuccessResponseSchema(SignedUploadResponseSchema);

// POST /api/uploads/signed-url - Create signed upload URL
registry.registerPath({
  method: 'post',
  path: '/api/uploads/signed-url',
  summary: 'Create signed upload URL',
  description: 'Generate a signed URL for direct image upload to storage',
  tags: ['Storage'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSignedUploadUrlRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Signed URL created successfully',
      content: {
        'application/json': {
          schema: SignedUploadSuccessResponse,
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
  },
  security: [{ bearerAuth: [] }],
});
