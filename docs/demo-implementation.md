# Landing Page Demo Implementation

## Overview

This document details the implementation of the interactive landing page demo that allows unauthenticated users to test ImgGo's capabilities.

## Implementation Summary

### Date: 2025-01-28

**Status**: ✅ Complete (pending Docker/Supabase startup for testing)

### What Was Built

1. **Demo UI Component** ([landing-demo.tsx](../src/ui/components/landing-demo.tsx))
   - 3-pillar layout (upload, format selection, results)
   - Drag-and-drop image upload with react-dropzone
   - Real-time progress tracking and polling
   - Format-aware result display
   - Signup CTA after completion

2. **Demo API Endpoints**
   - `POST /api/demo/signed-url` - Get signed upload URL (no auth)
   - `POST /api/demo/process` - Enqueue demo job (privileged)
   - `GET /api/demo/status/:job_id` - Poll job status (public)

3. **Demo Patterns** (5 fixed patterns in database)
   - JSON Analysis (structured output)
   - CSV Analysis (dynamic schema)
   - XML Analysis (schema-guided)
   - YAML Analysis (schema-guided)
   - Text Analysis (markdown)

4. **Testing Infrastructure**
   - Automated test script ([test-demo.ts](../scripts/test-demo.ts))
   - Comprehensive documentation ([demo-testing.md](./demo-testing.md))
   - npm script: `npm run test-demo`

## Key Technical Decisions

### 1. Format-Specific Schema Handling

After investigating the worker code ([supabase/functions/worker/index.ts](../supabase/functions/worker/index.ts)), we discovered that different formats use different schema columns:

| Format | Schema Column | Processing Method |
|--------|--------------|-------------------|
| JSON | `json_schema` | OpenAI Structured Output |
| CSV | `csv_schema` | Dynamic schema from headers |
| XML | `xml_schema` | Schema-guided prompting |
| YAML | `yaml_schema` | Schema-guided prompting |
| Text | `plain_text_schema` | Structured + markdown conversion |

**Why This Matters**: Initially, we tried filling `json_schema` for all formats, which was incorrect. Each format needs its own schema column populated.

### 2. Public vs Signed URLs

The worker needs to **download** uploaded images, but initially we were passing the signed **upload** URL.

**Fix**: Use public storage URL format:
```typescript
const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${imagePath}`;
```

**Error We Fixed**:
```
400 Error while downloading https://...supabase.co/storage/v1/object/upload/sign/images/...
```

### 3. Privileged Demo Endpoints

Demo users are not authenticated, so we created separate `/api/demo/*` endpoints that:
- Bypass authentication checks
- Bypass rate limiting
- Set `requested_by: null` for anonymous users
- Only allow demo pattern IDs

### 4. Next.js 15 Params

Next.js 15 changed params to be async, requiring:

```typescript
interface RouteParams {
  params: Promise<{ job_id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { job_id } = await params; // Must await!
}
```

## Files Created/Modified

### Created Files

1. **src/ui/components/landing-demo.tsx** (333 lines)
   - Main demo component with 3-pillar layout
   - Upload, format selection, and results display
   - Real-time status polling and error handling

2. **app/api/demo/signed-url/route.ts** (40 lines)
   - Public endpoint for getting signed upload URLs
   - No authentication required

3. **app/api/demo/process/route.ts** (175 lines)
   - Privileged endpoint for enqueueing demo jobs
   - Validates demo pattern IDs
   - Creates anonymous jobs

4. **app/api/demo/status/[job_id]/route.ts** (106 lines)
   - Public endpoint for polling job status
   - Returns manifest when completed
   - Next.js 15 compatible (awaits params)

5. **scripts/test-demo.ts** (268 lines)
   - Comprehensive test suite for all 5 formats
   - Tests upload, processing, and result verification
   - Schema compliance checking

6. **docs/demo-testing.md** (450+ lines)
   - Complete testing guide
   - API endpoint documentation
   - Troubleshooting section
   - Architecture diagram

7. **docs/demo-implementation.md** (this file)
   - Implementation summary
   - Technical decisions
   - Lessons learned

### Modified Files

1. **app/page.tsx**
   - Added `<LandingDemo />` component import and placement

2. **package.json**
   - Added `"test-demo": "tsx scripts/test-demo.ts"` script

3. **Database** (via SQL)
   - Created 5 demo patterns with fixed UUIDs
   - Each pattern has correct format-specific schema

## Schema Structure

All 5 demo patterns use identical fields but different formats:

```typescript
{
  title: string,           // Image description
  colors: array/string,    // Dominant colors (format-dependent)
  tags: array/string,      // Keywords/tags (format-dependent)
  is_person: boolean,      // Contains person?
  is_animal: boolean,      // Contains animal?
  is_landscape: boolean    // Is landscape?
}
```

### Example Outputs

**JSON**:
```json
{
  "title": "Mountain Road",
  "colors": ["blue", "green"],
  "tags": ["landscape", "nature"],
  "is_person": false,
  "is_animal": false,
  "is_landscape": true
}
```

**CSV**:
```csv
title,colors,tags,is_person,is_animal,is_landscape
Mountain Road,"blue,green","landscape,nature",false,false,true
```

**XML**:
```xml
<analysis>
  <title>Mountain Road</title>
  <colors><color>blue</color><color>green</color></colors>
  <tags><tag>landscape</tag><tag>nature</tag></tags>
  <is_person>false</is_person>
  <is_animal>false</is_animal>
  <is_landscape>true</is_landscape>
</analysis>
```

**YAML**:
```yaml
title: Mountain Road
colors:
  - blue
  - green
tags:
  - landscape
  - nature
is_person: false
is_animal: false
is_landscape: true
```

**Text (Markdown)**:
```markdown
# Title
Mountain Road

# Dominant Colors
- Blue
- Green

# Tags
- Landscape
- Nature

# Contains Person
No

# Contains Animal
No

# Is Landscape
Yes
```

## Errors Encountered & Fixed

### 1. UUID Format Error
**Error**: `invalid input syntax for type uuid: "demo-json-0000-0000-000000000001"`
**Fix**: Used proper UUID format with `::uuid` cast

### 2. 401 Unauthorized
**Error**: Demo upload failed with 401
**Fix**: Created `/api/demo/signed-url` endpoint (no auth required)

### 3. Schema Structure Misunderstanding
**Error**: Filled `json_schema` for all formats
**Fix**: Each format uses its own schema column

### 4. Worker 400 Error
**Error**: Worker couldn't download from signed upload URL
**Fix**: Changed to public storage URL format

### 5. Next.js 15 Params Warning
**Error**: `params should be awaited before using its properties`
**Fix**: Changed params to `Promise<{}>` and added `await`

## Testing Status

| Test | Status | Notes |
|------|--------|-------|
| JSON format | ⏳ Pending | Needs Docker/Supabase |
| CSV format | ⏳ Pending | Needs Docker/Supabase |
| XML format | ⏳ Pending | Needs Docker/Supabase |
| YAML format | ⏳ Pending | Needs Docker/Supabase |
| Text format | ⏳ Pending | Needs Docker/Supabase |
| Upload flow | ✅ Code complete | Not tested yet |
| Error handling | ✅ Code complete | Not tested yet |
| UI/UX | ✅ Code complete | Not tested yet |

## Next Steps

To complete testing:

1. **Start Docker Desktop**
   - Required for Supabase local instance

2. **Start Supabase**
   ```bash
   npm run supabase:start
   ```

3. **Verify demo patterns exist**
   ```sql
   SELECT id, name, format,
          CASE WHEN json_schema IS NOT NULL THEN 'json_schema' ELSE NULL END,
          CASE WHEN csv_schema IS NOT NULL THEN 'csv_schema' ELSE NULL END,
          CASE WHEN xml_schema IS NOT NULL THEN 'xml_schema' ELSE NULL END,
          CASE WHEN yaml_schema IS NOT NULL THEN 'yaml_schema' ELSE NULL END,
          CASE WHEN plain_text_schema IS NOT NULL THEN 'plain_text_schema' ELSE NULL END
   FROM patterns
   WHERE id::text LIKE '00000000-0000-0000-0000-00000000000%'
   ORDER BY id;
   ```

4. **Run test suite**
   ```bash
   npm run test-demo
   ```

5. **Manual browser testing**
   - Navigate to http://localhost:3000
   - Scroll to "Try It Now" section
   - Test each format with different images
   - Verify error handling (wrong file types, oversized files, etc.)

## Architecture

```
┌─────────────┐
│   Browser   │ User uploads image + selects format
└──────┬──────┘
       │
       │ 1. POST /api/demo/signed-url
       ├──────────────────────────────────┐
       │                                  │
       │ 2. PUT image to signed URL       │
       ├──────────────────────────────────┤
       │                             Supabase
       │ 3. POST /api/demo/process    Storage
       │    {pattern_id, image_url}       │
       ├──────────────────────────────────┤
       │                                  │
       │ 4. Poll GET /api/demo/status     │
       │                                  │
┌──────┴──────┐                  ┌────────┴────────┐
│  Demo API   │                  │  Worker (Deno)  │
│             │                  │                 │
│ - No auth   │───── PGMQ ──────>│ - Downloads img │
│ - No limits │      Queue       │ - Calls LLM     │
│ - Public    │                  │ - Saves result  │
└─────────────┘                  └─────────────────┘
```

## Design Principles

1. **Minimalist & Professional**
   - Clean 3-pillar layout
   - No gradients or flashy colors
   - Solid, premium feel

2. **User Experience**
   - Clear progress indicators
   - Error messages with helpful context
   - One-time generation (results are read-only)
   - Signup CTA after completion

3. **Technical Excellence**
   - Type-safe implementation
   - Proper error handling
   - Format-aware result display
   - Idempotent job processing

4. **Security**
   - No authentication leaks
   - Isolated demo storage path
   - Fixed demo pattern IDs only
   - Anonymous job tracking

## Lessons Learned

1. **Schema Investigation is Critical**
   - Don't assume all formats use the same schema column
   - Read worker code thoroughly before implementing
   - Test with actual data to verify assumptions

2. **URL Types Matter**
   - Signed upload URLs ≠ download URLs
   - Workers need public URLs to download images
   - Storage URL format is critical

3. **Next.js Version Changes**
   - Keep up with framework changes (async params in v15)
   - Type definitions help catch these issues early

4. **Demo Endpoints Need Special Handling**
   - Separate endpoints for unauthenticated users
   - Explicit bypass of rate limiting and auth
   - Clear separation from production endpoints

## Maintenance

### Regular Tasks

- **Monitor demo usage**: Track anonymous job counts
- **Clean up old demo images**: Consider cron job for `demo/*` files > 24h old
- **Update patterns**: If schema changes, update all 5 demo patterns
- **Test regularly**: Run `npm run test-demo` after any changes

### Future Enhancements

- [ ] Add demo analytics dashboard
- [ ] Implement CAPTCHA for abuse prevention
- [ ] Cache demo results (same image + pattern combo)
- [ ] Show queue position during processing
- [ ] Add "Share Result" functionality
- [ ] Implement per-IP rate limiting for demos

## References

- [Demo Testing Guide](./demo-testing.md)
- [Landing Demo Component](../src/ui/components/landing-demo.tsx)
- [Worker Implementation](../supabase/functions/worker/index.ts)
- [Pattern Detail Page](../app/patterns/[id]/page.tsx)
