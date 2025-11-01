/**
 * Pattern endpoint registrations for OpenAPI
 */

import { registry } from '../registry';
import { z } from 'zod';
import {
  CreatePatternSchema,
  UpdatePatternSchema,
  PatternSchema
} from '@/schemas/pattern';
import { ErrorResponseSchema, SuccessResponseSchema, PaginatedResponseSchema } from '@/schemas/api';

// Register Pattern schema components
registry.register('Pattern', PatternSchema);

// Success response wrappers
const PatternSuccessResponse = SuccessResponseSchema(PatternSchema);
const PatternsListResponse = SuccessResponseSchema(
  PaginatedResponseSchema(PatternSchema)
);

// POST /api/patterns - Create pattern
registry.registerPath({
  method: 'post',
  path: '/api/patterns',
  summary: 'Create a new pattern',
  description: 'Create a new image analysis pattern with custom instructions and schema',
  tags: ['Patterns'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePatternSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Pattern created successfully',
      content: {
        'application/json': {
          schema: PatternSuccessResponse,
        },
      },
    },
    400: {
      description: 'Invalid request body or schema validation failed',
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
      description: 'Insufficient permissions or plan limit exceeded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// GET /api/patterns - List patterns
registry.registerPath({
  method: 'get',
  path: '/api/patterns',
  summary: 'List all patterns',
  description: 'Retrieve a paginated list of patterns for the authenticated user',
  tags: ['Patterns'],
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1).openapi({
        description: 'Page number for pagination',
        example: 1,
      }),
      per_page: z.coerce.number().int().positive().max(100).optional().default(20).openapi({
        description: 'Items per page (max 100)',
        example: 20,
      }),
      is_active: z.enum(['true', 'false']).optional().openapi({
        description: 'Filter by active status',
        example: 'true',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Patterns retrieved successfully',
      content: {
        'application/json': {
          schema: PatternsListResponse,
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

// GET /api/patterns/:id - Get pattern
registry.registerPath({
  method: 'get',
  path: '/api/patterns/{id}',
  summary: 'Get a specific pattern',
  description: 'Retrieve details of a specific pattern by ID',
  tags: ['Patterns'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Pattern ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Pattern retrieved successfully',
      content: {
        'application/json': {
          schema: PatternSuccessResponse,
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
      description: 'Pattern not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// PATCH /api/patterns/:id - Update pattern
registry.registerPath({
  method: 'patch',
  path: '/api/patterns/{id}',
  summary: 'Update a pattern',
  description: 'Update an existing pattern\'s configuration',
  tags: ['Patterns'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Pattern ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePatternSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Pattern updated successfully',
      content: {
        'application/json': {
          schema: PatternSuccessResponse,
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
    404: {
      description: 'Pattern not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

// DELETE /api/patterns/:id - Delete pattern
registry.registerPath({
  method: 'delete',
  path: '/api/patterns/{id}',
  summary: 'Delete a pattern',
  description: 'Soft delete a pattern. Note: Can only be done via dashboard UI, not via API',
  tags: ['Patterns'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: 'Pattern ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Pattern deleted successfully',
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
    403: {
      description: 'Pattern deletion via API not allowed',
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
  },
  security: [{ bearerAuth: [] }],
});
