# ULTIMATE PROMPT

- You are a senior full-stack engineer with 20+ years of experience.
You value stupidly simple solutions, minimalist & modern UX (no gradient coloring and other not professional stuff, solid, professional, minimalist and premium), excellent documentation, and strict separation of concerns.
Do NOT use `any` in TypeScript. Prefer precise types and Zod schemas.

## Product name: ImgGo

One-liner: A SaaS that turns user-uploaded images into strictly schema-conformant manifests (JSON/YAML/XML/CSV/TEXT) and returns them via API or webhook, at scale.

## Problem & Solution

### Problem

Teams that work with large volumes of images — whether in environmental monitoring, e-commerce, mapping, or labeling pipelines — face a recurring challenge: they need consistent, structured, and context-aware outputs from visual data.

Existing image analysis tools (like generic object detection or captioning APIs) return inconsistent or overly generic results.
They’re often:

🔹 Unpredictable: Output varies from image to image, making automation difficult.
🔹 Rigid: Hard to customize for specific domains or use-cases (e.g., detecting trees vs. retail SKUs).
🔹 Unstructured: Require post-processing to fit internal schemas or database formats.

In short, teams spend more time normalizing results than actually using them.

### Solution — ImgGo

ImgGo transforms unstructured image understanding into a predictable, schema-driven workflow.
At its core, ImgGo introduces the concept of a Pattern — a configurable combination of:
Instructions: what to analyze or extract (e.g., “identify all products and their price tags” or “summarize land cover composition”), and
Schema: the expected output format (JSON structure, keys, and types).
Each Pattern automatically generates a unique ingest endpoint.
When users upload images via web or API, ImgGo:
Routes the image to the appropriate Pattern,

Uses a multimodal LLM/VLM pipeline to interpret the image based on the Pattern’s instructions,

Returns a structured manifest that precisely matches the user’s defined schema — guaranteed.

Example

Pattern: “Retail Shelf Audit”
Schema:

---

{
  "shelf_id": "string",
  "products": [
    { "name": "string", "brand": "string", "price_tag_visible": "boolean" }
  ]
}

---

Image uploaded →
POST <https://api.imggo.ai/patterns/retail-audit/analyze>

Response:

{
  "shelf_id": "A12",
  "products": [
    { "name": "Coca-Cola 500ml", "brand": "Coca-Cola", "price_tag_visible": true },
    { "name": "Pepsi 500ml", "brand": "Pepsi", "price_tag_visible": false }
  ]
}

---

No post-processing. No unpredictable responses.
Just structured, context-aware visual intelligence, tailored to your domain.

## GOAL

Build an end-to-end service called **ImgGo** that lets users:

1) Create a “Pattern” (aka schema + instructions) that defines how an image should be analyzed.
2) Get a unique ingest endpoint for each Pattern.
3) Upload images via Web UI (direct to storage) or via API (by URL), and receive a **manifest** strictly matching their chosen format (JSON/YAML/XML/CSV/plain text) with exact same structure every time.
4) Process **thousands of images per minute** by decoupling ingest from processing via a queue & workers.

This is a one-shot: generate production-ready code, infra/config, SQL migrations, tests, and docs.

---

## DELIVERABLES (create all files)

- Mono-repo Next.js 15 app (TypeScript, App Router).
- Supabase migrations (SQL), RLS policies, seed.
- Supabase Edge Function (TypeScript/Deno) as the queue worker.
- API route handlers with OpenAPI (YAML) and typed client.
- Upload UX (TUS + Signed Upload).
- LLM/VLM integration with **structured outputs**; adapter pattern to swap providers.
- Webhook signer/verifier.
- Observability (structured logs), metrics, and basic rate-limits.
- E2E tests (Playwright) + unit tests (Vitest).
- **.env.example** at repo root.
- `README.md` with step-by-step runbook.
- Architecture diagram (Mermaid) in `/docs/architecture.md`.

---

## TECH STACK (locked)

- **Frontend/UI:** Next.js App Router, React Server Components where possible. Styling with Tailwind + shadcn/ui. Form state with React Hook Form + Zod. File upload with `tus-js-client`.
- **Backend/API:** Next.js **Route Handlers** for control-plane (auth, pattern CRUD, create signed upload URLs, enqueue jobs). Avoid long blocking work here.
- **Auth/DB/Storage:** Supabase (Postgres 15+, RLS on all tables; Storage with TUS and Signed Upload URL; PGMQ queue).
- **Workers:** Supabase Edge Function (Deno/TypeScript) that consumes `pgmq`. Triggered by Supabase Cron at a short interval; implement idempotency and concurrency controls.
- **LLM/VLM:**
  - Default provider: OpenAI (Structured Outputs with JSON Schema; vision for scene understanding).
  - Pluggable OSS path (feature-flag): Florence-2 (caption/ocr/od), YOLOv10 (object detection) behind a simple HTTP micro-service (e.g., Modal/RunPod) if needed later.
- **Schema/Validation:** Zod + JSON Schema.
- **ORM/migrations:** Pure SQL migrations with Supabase CLI; type-safe queries via `postgres` tagged templates or Drizzle if you prefer, but keep it simple.

---

## PROJECT STRUCTURE

.
├─ app/
│  ├─ (marketing)/
│  ├─ dashboard/
│  ├─ patterns/
│  │  ├─ page.tsx               # list patterns
│  │  ├─ [id]/page.tsx          # pattern detail (manifest previews, endpoint, webhook sample)
│  │  └─ new/page.tsx           # Pattern Studio (instructions + format dropdown + live template)
│  └─ api/
│     ├─ patterns/route.ts      # POST create, GET list
│     ├─ patterns/[id]/route.ts # GET read, PATCH update, DELETE archive
│     ├─ patterns/[id]/ingest/route.ts  # POST enqueue image job (by image_url only)
│     ├─ uploads/signed-url/route.ts    # POST createSignedUploadUrl
│     └─ webhooks/ingest/route.ts       # (optional) sample receiver for docs
├─ edge-functions/
│  └─ worker/index.ts           # Supabase Edge Function: queue consumer
├─ db/
│  ├─ migrations/*.sql
│  └─ seeds/*.sql
├─ src/
│  ├─ lib/
│  │  ├─ supabase-server.ts     # server client (service role only in Edge Fn)
│  │  ├─ supabase-client.ts     # RLS-aware browser client
│  │  ├─ logger.ts
│  │  ├─ crypto.ts              # HMAC signing/verify for webhooks
│  │  ├─ rateLimit.ts           # token bucket (in Postgres) or simple sliding window
│  │  └─ idempotency.ts
│  ├─ llm/
│  │  ├─ providers/openai.ts    # structured outputs, vision
│  │  ├─ providers/oss.ts       # optional: calls out to OSS microservice
│  │  └─ orchestrator.ts        # chooses path per Pattern.model_profile
│  ├─ queues/pgmq.ts            # enqueue/dequeue helpers
│  ├─ schemas/
│  │  ├─ pattern.ts             # Zod schema for Pattern creation
│  │  ├─ manifest.ts            # dynamic from Pattern.format & json_schema
│  │  └─ api.ts                 # request/response schemas
│  ├─ services/
│  │  ├─ patternService.ts
│  │  ├─ jobService.ts
│  │  ├─ storageService.ts
│  │  └─ webhookService.ts
│  └─ ui/
│     └─ components/...
├─ docs/architecture.md
├─ openapi.yaml
├─ playwright.config.ts
├─ vitest.config.ts
└─ README.md

---

## CREATE `.env.example` (at repo root)

Populate with dummy values. Keep secrets server-only. The agent must create this file.

NEXT_PUBLIC_SUPABASE_URL="<https://PROJECT_REF.supabase.co>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_anon_XXXXXXXXXXXXXXXXXXXXXXXX"
SUPABASE_SERVICE_ROLE_KEY="sb_service_role_XXXXXXXXXXXXXXXXXX"
SUPABASE_JWT_SECRET="super-secret-jwt"  # for RLS testing, docs only
SUPABASE_STORAGE_BUCKET="images"
SUPABASE_PGMQ_QUEUE="ingest_jobs"

OPENAI_API_KEY="sk-openai-xxxxxxxx"

## Optional alternative providers (keep pluggable, off by default)

ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"..."}'

## App

APP_BASE_URL="<http://localhost:3000>"
WEBHOOK_SECRET="whsec_XXXXXXXXXXXXXXXX"
LOG_LEVEL="info"

## Vercel (optional local defaults)

VERCEL="0"
NODE_ENV="development"

Agent: output this file exactly as `.env.example`.

---

## DATABASE SCHEMA (SQL migrations)

- Tables:
  - `profiles` (shadow of auth.users: id UUID PK, email, created_at)
  - `api_keys` (id, user_id FK, hashed_key, scopes[], created_at)
  - `patterns` (id UUID PK, user_id, name, format enum: 'json'|'yaml'|'xml'|'csv'|'text', json_schema JSONB nullable, instructions TEXT, model_profile TEXT default 'managed-default', version INT default 1, is_active BOOL, created_at)
  - `pattern_versions` (id, pattern_id FK, version INT, json_schema JSONB, instructions TEXT, created_at)
  - `jobs` (id UUID PK, pattern_id FK, image_url TEXT, status enum: 'queued'|'running'|'succeeded'|'failed', manifest JSONB nullable, error TEXT, latency_ms INT, created_at, updated_at, idempotency_key TEXT unique nullable, requested_by UUID nullable)
  - `webhooks` (id, user_id, url TEXT, secret TEXT, events TEXT[])

- Indexes:
  - GIN on `jobs.manifest`
  - BTREE on `jobs(pattern_id, created_at)`
  - BTREE on `patterns(user_id, is_active)`

- Enums & queue extension:
  - `create extension if not exists pgmq;`
  - Create queue name from env (`SUPABASE_PGMQ_QUEUE`).

- RLS (enable and write policies):
  - Enable RLS on all tables.
  - Policy examples:
    - `profiles`: user can select/update only own row.
    - `patterns`: owner CRUD (`user_id = auth.uid()`).
    - `pattern_versions`: read by owner; insert by owner.
    - `jobs`: read own jobs (via pattern owner join).
    - `api_keys`: owner only.
    - `webhooks`: owner only.

Agent: generate full SQL with `alter table ... enable row level security;` and `create policy` statements referencing `auth.uid()` and secure joins. Include a dedicated `rpc.get_my_jobs(pattern_id)` if helpful.

---

## STORAGE & UPLOAD

- Create bucket `${SUPABASE_STORAGE_BUCKET}` private by default.
- Implement **two** flows:
  1) **Resumable (TUS) direct → Storage** from the browser using `tus-js-client`. After upload completes, we have the `image_url` (public or signed URL) to hand to API.
  2) **Signed Upload URL**: backend issues `createSignedUploadUrl`; client `uploadToSignedUrl`; returns canonical `image_url`.

In UI, show progress, resume support, and post-upload “Test in Pattern Studio”.

---

## API DESIGN (Route Handlers)

All types strictly defined (no `any`). Validate with Zod. Produce `openapi.yaml`.

### Auth

- Supabase Auth (PKCE). Use RLS in browser; for privileged ops (queues), use service role only inside Edge Function.

### Endpoints

- `POST /api/patterns` → create pattern (name, format, instructions, optional json_schema). Returns pattern with endpoint URL.
- `GET /api/patterns` → list
- `GET /api/patterns/:id` → get detail + latest version
- `PATCH /api/patterns/:id` → update (version++ on publish)
- `DELETE /api/patterns/:id` → soft delete
- `POST /api/uploads/signed-url` → {path} → {url, token, expires_at}
- `POST /api/patterns/:id/ingest` → body: `{ image_url: string, extras?: unknown, idempotency_key?: string }`
  - Validates pattern ownership via RLS or server assertion.
  - Enqueues job to PGMQ with payload (job_id, pattern_id, image_url, extras).
  - Returns `{ job_id, status: "queued" }` with 202.
- `GET /api/jobs/:job_id` → status & manifest
- **Webhooks**: user registers URL; on success we `POST` `{job_id, pattern_id, manifest, signature}` with HMAC `X-ImgGo-Signature`.

### Multipart note

For small demos only, support `multipart/form-data` (`image` field). In production docs, recommend direct-to-storage + `image_url` to bypass function size limits.

### Idempotency & Rate limiting

- Require `Idempotency-Key` header on ingest; store in `jobs.idempotency_key`.
- Simple token bucket per user in Postgres (or throttle by plan).

Agent: implement each route with strict request/response types, Zod validation, and exhaustiveness checks.

---

## PATTERN STUDIO (Frontend)

- Left column: **Instructions** (multi-line), **Format** dropdown (JSON/YAML/XML/CSV/TEXT), optional **JSON Schema** editor (Monaco).
- Right column: **Generated Template Preview** button (calls LLM with user instructions + selected format to propose an example manifest). Provide an editable output area. Save as `pattern_versions`.
- “Publish Pattern” assigns/update version and shows:
  - **Endpoint URL** `POST /api/patterns/:id/ingest`
  - **cURL** and **Node/Python** snippets (URL upload).
- Pattern detail page: dropzone to upload via TUS; “See manifest” after processing.

---

## LLM/VLM ORCHESTRATION

- **Default provider (managed):** OpenAI with **Structured Outputs** (JSON Schema) to guarantee exact shape that matches Pattern.format/schema.
  - `generate_template(pattern)` → returns example manifest in chosen format.
  - `infer_manifest({ image_url, pattern })` → single call (vision+text) conditioned on pattern.instructions; outputs strictly validated JSON first; if user chose YAML/XML/CSV/TEXT, convert from the validated JSON via a pure formatter.
- **OSS (optional, feature flag):**
  - `detectors` microservice (Python/FastAPI) that runs YOLOv10/Florence-2 to produce a normalized JSON; then same formatter path as above.
- Implement retries with jitter, and circuit breaker. Log raw model outputs (hashed image URL in logs only).

Agent: write `src/llm/providers/openai.ts` with:

- `generateTemplate(schemaOrFormat, instructions)`
- `inferManifest(image_url, instructions, schemaOrFormat)`
Use the OpenAI JS SDK; wire Structured Outputs (Zod → JSON Schema). Ensure deterministic output under temperature=0.2. Type all responses with Zod.

---

## QUEUE WORKER (Supabase Edge Function)

- Function `worker`:
  - On invocation, pull N messages from `pgmq.read(queue, vt_seconds, batch_size)`.
  - For each message: set status `running`, call `infer_manifest`, persist manifest JSONB, measure latency, send webhook (HMAC sign).
  - On success: `pgmq.delete(...)`. On failure: `pgmq.archive(...)` and set job `failed` with error payload.
- Concurrency & scale:
  - Use Cron to invoke `worker` every X seconds; allow multiple concurrent jobs.
  - Visibility timeout > expected processing time.

Agent: implement Deno TypeScript code using `supabase-js` Edge client; include `vt_seconds`, `batch_size`, backoff, and structured logs.

---

## RLS POLICIES (examples)

- `patterns`:
  - `for all using (user_id = auth.uid()) with check (user_id = auth.uid())`
- `jobs`:
  - allow select where `exists(select 1 from patterns p where p.id = jobs.pattern_id and p.user_id = auth.uid())`
- `api_keys`, `webhooks`: owner-only policies.
- Ensure Storage policies: users can read files they own; writes via signed URLs/TUS do not require auth at time of upload, but ownership metadata is associated post-upload.

Agent: include full `create policy` statements in migrations with comments.

---

## OPENAPI

- Generate `openapi.yaml` covering all endpoints, request/response examples, error shapes, webhooks (callback). Add `components/schemas` aligned with Zod. Ship a small TS client (`/src/gen/client.ts`) using `openapi-fetch`.

---

## OBSERVABILITY

- Structured logs (`logger.ts`) with fields: `request_id`, `user_id`, `job_id`, `pattern_id`, timings, provider, token usage.
- RequestId middleware.
- Simple `/api/_health` endpoint.

---

## TESTS

- **Unit**: LLM adapters (mocked), Zod validation, queue helpers.
- **E2E (Playwright):**
  - Auth + create pattern + publish + upload image (TUS) + poll job + see manifest.
  - Webhook signature verification test app.

---

## SECURITY

- HMAC for webhooks (`X-ImgGo-Signature: sha256=...`).
- Input validation everywhere; no `any`.
- RLS mandatory; service role key never shipped to browser.
- Encrypted secrets in Supabase Vault; env only for local dev.

---

## DEPLOY

- Vercel for Next.js app.
- Supabase project for DB/Storage/Queues/Cron.
- Create bucket `${SUPABASE_STORAGE_BUCKET}`; enable TUS.
- Set Cron to trigger `worker` every 5–10s initially (adjust per traffic).
- Confirm CORS for Storage direct host.

---

## DOCUMENTATION

- `README.md`:
  - Quickstart (local & prod).
  - How uploads work (TUS vs Signed URL).
  - API usage with cURL, Node, Python.
  - Pattern Studio tutorial.
  - Scaling playbook (increase Cron frequency, worker batch_size, shard queues).
- `/docs/architecture.md`: Mermaid diagram and sequence charts for ingest → queue → worker → manifest → webhook.

Deliver all code, SQL, and docs now.
