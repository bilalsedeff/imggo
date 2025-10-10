# ImgGo

> Transform images into strictly schema-conformant manifests at scale

ImgGo is a production-ready SaaS platform that converts images into structured data using AI-powered vision models. Define your schema once, and get consistent JSON/YAML/XML/CSV/TEXT output every time.

## Features

- **🎯 Schema-Driven**: Define exact output format with JSON Schema
- **📊 Multiple Formats**: Export as JSON, YAML, XML, CSV, or plain text
- **⚡ Scalable**: Process thousands of images per minute with queue-based workers
- **🔄 Idempotent**: Built-in duplicate request handling
- **🪝 Webhooks**: Real-time notifications when jobs complete
- **🔒 Secure**: Row-level security, HMAC webhook signatures, rate limiting
- **📈 Observable**: Structured logging, health checks, metrics

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API key

### 1. Clone and Install

```bash
git clone <repo-url>
cd imggo
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="images"
SUPABASE_PGMQ_QUEUE="ingest_jobs"

OPENAI_API_KEY="sk-..."

APP_BASE_URL="http://localhost:3000"
WEBHOOK_SECRET="your-webhook-secret"
```

### 3. Setup Database

Initialize Supabase locally or use cloud:

```bash
# Local (recommended for development)
npm run supabase:start

# Run migrations
npm run db:migrate
```

Manually run migrations in Supabase SQL Editor:
1. `db/migrations/001_init_schema.sql`
2. `db/migrations/002_rls_policies.sql`
3. `db/migrations/003_functions.sql`

### 4. Initialize PGMQ Queue

In Supabase SQL Editor:

```sql
SELECT pgmq.create('ingest_jobs');
```

### 5. Deploy Edge Function

```bash
supabase functions deploy worker
```

Set environment variables in Supabase Dashboard:
- `OPENAI_API_KEY`
- `SUPABASE_PGMQ_QUEUE`

Enable Cron trigger (every 10s):

```sql
SELECT cron.schedule(
  'process-ingest-jobs',
  '*/10 * * * * *',
  $$SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/worker',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )$$
);
```

### 6. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## Architecture

See [docs/architecture.md](./docs/architecture.md) for detailed architecture diagrams and system design.

## Usage

### 1. Create a Pattern

```typescript
POST /api/patterns
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Retail Shelf Audit",
  "format": "json",
  "instructions": "Identify all products on the shelf with their names, brands, and price tag visibility",
  "json_schema": {
    "type": "object",
    "properties": {
      "shelf_id": { "type": "string" },
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "brand": { "type": "string" },
            "price_tag_visible": { "type": "boolean" }
          },
          "required": ["name", "brand", "price_tag_visible"]
        }
      }
    },
    "required": ["shelf_id", "products"]
  }
}
```

### 2. Upload Image (Optional)

Two methods:

#### A. TUS Resumable Upload

```typescript
POST /api/uploads/signed-url
{
  "path": "my-image-001.jpg"
}

// Returns { url, token }
// Use tus-js-client to upload to url with token
```

#### B. Use External URL

Use any publicly accessible image URL.

### 3. Ingest Image

```typescript
POST /api/patterns/{pattern_id}/ingest
Content-Type: application/json
Idempotency-Key: unique-key-123

{
  "image_url": "https://example.com/shelf.jpg"
}

// Returns 202 Accepted
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "queued"
  }
}
```

### 4. Poll Job Status

```typescript
GET /api/jobs/{job_id}

// Returns
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "succeeded",
    "manifest": {
      "shelf_id": "A12",
      "products": [
        {
          "name": "Coca-Cola 500ml",
          "brand": "Coca-Cola",
          "price_tag_visible": true
        }
      ]
    },
    "latency_ms": 2341
  }
}
```

### 5. Setup Webhooks (Optional)

```typescript
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["job.succeeded", "job.failed"]
}
```

Webhook payload:

```json
{
  "event": "job.succeeded",
  "job_id": "uuid",
  "pattern_id": "uuid",
  "manifest": { ... },
  "timestamp": "2025-01-15T10:30:00Z"
}

// Headers:
// X-ImgGo-Signature: sha256=...
```

## API Reference

See [openapi.yaml](./openapi.yaml) for complete API documentation.

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## Deployment

### Vercel (Recommended)

```bash
vercel
```

Set environment variables in Vercel Dashboard.

### Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `APP_BASE_URL`
- `WEBHOOK_SECRET`

Optional:
- `LOG_LEVEL` (default: info)
- `SUPABASE_STORAGE_BUCKET` (default: images)
- `SUPABASE_PGMQ_QUEUE` (default: ingest_jobs)

## Scaling

### Increase Throughput

1. **More Frequent Cron**: Change from 10s to 5s or 1s intervals
2. **Larger Batch Size**: Update `BATCH_SIZE` in worker (default: 5)
3. **Multiple Queues**: Shard patterns across multiple queues
4. **Parallel Workers**: Deploy multiple worker instances

### Performance Tips

- Use WEBP/JPEG for faster uploads
- Optimize JSON schemas (fewer nested levels)
- Enable CDN caching for Pattern Studio
- Monitor queue metrics via `/api/_health`

## Troubleshooting

### Jobs Stuck in "queued"

- Check worker Cron is active: `SELECT * FROM cron.job;`
- Check worker logs in Supabase Functions dashboard
- Verify PGMQ queue exists: `SELECT * FROM pgmq.q_ingest_jobs;`

### "Pattern not found" errors

- Verify RLS policies are applied
- Check user authentication token
- Confirm pattern `is_active = true`

### High Latency

- Check OpenAI API status
- Monitor `jobs.latency_ms` in database
- Scale workers (see Scaling section)

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs/](./docs/)
- Issues: GitHub Issues
- Email: support@imggo.ai
