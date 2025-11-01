/**
 * OpenAPI Registry - Central place for all API documentation
 *
 * This file sets up the OpenAPI 3.1.0 specification generator
 * using @asteasolutions/zod-to-openapi to auto-generate docs
 * from our existing Zod schemas.
 */

import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Create global registry
export const registry = new OpenAPIRegistry();

// Register security schemes
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'API key authentication using Bearer token',
});

/**
 * Generate complete OpenAPI 3.1.0 document
 */
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'ImgGo API',
      version: '1.0.0',
      description: 'Schema-conformant image analysis at scale. Transform images into structured data (JSON/YAML/XML/CSV/TEXT) with AI-powered pattern matching.',
      contact: {
        name: 'ImgGo Support',
        email: 'support@imggo.ai',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
      {
        url: 'https://api.imggo.ai',
        description: 'Production',
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Patterns', description: 'Pattern management and configuration' },
      { name: 'Jobs', description: 'Image processing jobs and results' },
      { name: 'API Keys', description: 'API key management' },
      { name: 'Webhooks', description: 'Webhook configuration and management' },
      { name: 'Storage', description: 'File upload and signed URLs' },
      { name: 'System', description: 'Health checks and system status' },
      { name: 'Demo', description: 'Public demo endpoints (no authentication required)' },
    ],
  });
}
