/* eslint-disable react/no-array-index-key */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

type NavSection = {
  id: string;
  title: string;
  description: string;
  content: JSX.Element;
};

// Code Examples Component with Toggle
function CodeExamplesSection() {
  const [codeExampleMethod, setCodeExampleMethod] = useState<"url" | "file">("url");

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-foreground">
        Code Examples
      </h3>

      {/* Upload Method Toggle */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setCodeExampleMethod("url")}
          className={`px-4 py-2 text-sm font-medium transition ${
            codeExampleMethod === "url"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Image URL
        </button>
        <button
          onClick={() => setCodeExampleMethod("file")}
          className={`px-4 py-2 text-sm font-medium transition ${
            codeExampleMethod === "file"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Direct Upload
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          1. Submit Image for Processing (cURL)
        </h4>
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
          {codeExampleMethod === "url" ? `curl -X POST https://img-go.com/api/patterns/YOUR_PATTERN_ID/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "image_url": "https://your-cdn.com/image.jpg"
  }'

# Response (202 Accepted)
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "message": "Job queued for background processing",
    "approach": "queued"
  }
}` : `curl -X POST https://img-go.com/api/patterns/YOUR_PATTERN_ID/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "image=@/path/to/your/image.jpg"

# Response (202 Accepted)
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "message": "Job queued for background processing",
    "approach": "queued"
  }
}`}
        </pre>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          2. Node.js/TypeScript Example
        </h4>
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
          {codeExampleMethod === "url" ? `const IMGGO_API_KEY = process.env.IMGGO_API_KEY;
const PATTERN_ID = "your-pattern-id";

async function processImage(imageUrl: string) {
  const submitRes = await fetch(
    \`https://img-go.com/api/patterns/\${PATTERN_ID}/ingest\`,
    {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${IMGGO_API_KEY}\`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  const result = await submitRes.json();
  return result.data.job_id;
}` : `const fs = require('fs');
const FormData = require('form-data');

async function processImageFile(filePath: string) {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(filePath));

  const response = await fetch(
    \`https://img-go.com/api/patterns/\${PATTERN_ID}/ingest\`,
    {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${IMGGO_API_KEY}\`,
        ...formData.getHeaders()
      },
      body: formData
    }
  );
  const result = await response.json();
  return result.data.job_id;
}`}
        </pre>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          3. Python Example
        </h4>
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
          {codeExampleMethod === "url" ? `import requests

response = requests.post(
    f"https://img-go.com/api/patterns/{PATTERN_ID}/ingest",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"image_url": "https://your-cdn.com/image.jpg"}
)

result = response.json()
job_id = result["data"]["job_id"]` : `import requests

with open('/path/to/image.jpg', 'rb') as f:
    files = {'image': ('image.jpg', f, 'image/jpeg')}
    response = requests.post(
        f"https://img-go.com/api/patterns/{PATTERN_ID}/ingest",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files=files
    )

result = response.json()
job_id = result["data"]["job_id"]`}
        </pre>
      </div>
    </div>
  );
}

const sections: NavSection[] = [
  {
    id: "overview",
    title: "Overview",
    description:
      "Learn how ImgGo transforms images into structured data via API.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          <strong>ImgGo</strong> is a hosted API service that transforms images into structured,
          schema-compliant data. Upload an image, and get back precisely formatted JSON, YAML, XML,
          CSV, or plain text manifests that match your exact requirements—every single time.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            How It Works
          </h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Create a Pattern:</span>{" "}
              Define what you want to extract from images using natural language instructions
              and your desired output format (JSON/YAML/XML/CSV/TEXT).
            </li>
            <li>
              <span className="font-medium text-foreground">2. Get Your API Endpoint:</span>{" "}
              Each pattern gets a unique API endpoint. Send images to this endpoint via our REST API.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Receive Structured Results:</span>{" "}
              Get back perfectly structured manifests that match your schema, guaranteed.
              No parsing errors, no inconsistencies.
            </li>
            <li>
              <span className="font-medium text-foreground">4. Scale & Automate:</span>{" "}
              Process thousands of images per minute with webhooks, rate limits, and
              enterprise-grade reliability.
            </li>
          </ol>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              5 Output Formats
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              JSON, YAML, XML, CSV, and plain text. Define your schema once,
              get consistent results forever.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              REST API
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Simple HTTP endpoints with API key authentication. Integrates with
              any language or framework.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Enterprise Ready
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Webhooks, idempotency, rate limits, team collaboration, and 99.9% uptime SLA.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Create your account and start processing images in minutes.",
    content: (
      <div className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Quick Start: 3 Steps to Your First API Call
          </h3>
          <ol className="space-y-4 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Sign Up:</span>{" "}
              Create your ImgGo account at{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                img-go.com/sign-up
              </Link>
              . Start with our free plan (50 requests/month).
            </li>
            <li>
              <span className="font-medium text-foreground">2. Get Your API Key:</span>{" "}
              Click your profile button (upper right corner) → Settings → API Keys
              to generate a new key. Keep it secure—treat it like a password.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Create a Pattern:</span>{" "}
              Use Pattern Studio to define what data you want extracted from your images.
              Choose your output format and publish.
            </li>
          </ol>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold">Your First Pattern</h3>
          <p className="text-sm text-muted-foreground">
            Let&apos;s create a simple pattern that extracts product information from
            retail shelf images:
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              1. Navigate to{" "}
              <Link href="/patterns" className="text-primary hover:underline">
                Patterns → New Pattern
              </Link>{" "}
              in your dashboard
            </li>
            <li>
              2. Name your pattern: <code>&quot;Retail Shelf Audit&quot;</code>
            </li>
            <li>
              3. Choose output format: <code>JSON</code>
            </li>
            <li>
              4. Write instructions:{" "}
              <code>&quot;Identify all products visible on the shelf, including product name, brand, and whether the price tag is visible&quot;</code>
            </li>
            <li>
              5. Click <strong>&quot;Generate Template&quot;</strong> to let our AI suggest a schema
            </li>
            <li>
              6. Review and adjust the schema, then click <strong>&quot;Publish&quot;</strong>
            </li>
          </ol>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 text-base font-semibold">Make Your First API Call</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Once published, you&apos;ll see your pattern&apos;s unique endpoint URL and sample code.
            Here&apos;s a simple example:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm text-foreground/90">
            {`curl -X POST https://img-go.com/api/patterns/YOUR_PATTERN_ID/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique-request-id-123" \\
  -d '{
    "image_url": "https://your-cdn.com/shelf-photo.jpg"
  }'

# Response (202 Accepted)
{
  "success": true,
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "message": "Job queued for background processing",
    "approach": "queued"
  }
}`}
          </pre>
        </div>
      </div>
    ),
  },
  {
    id: "pattern-studio",
    title: "Pattern Studio",
    description:
      "Design patterns, test with real images, and manage versions.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          Pattern Studio is your visual interface for defining what data to extract
          from images. Write instructions in plain English, define your output schema,
          and let our AI generate template suggestions. Test with real images before
          publishing to production.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Instructions
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Describe in natural language what you want to extract: &quot;Identify all
              products and their prices&quot;, &quot;Count people in the image&quot;, etc.
              The more specific, the better.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Output Format
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose JSON, YAML, XML, CSV, or plain text. Define your exact schema
              or let our AI generate one based on your instructions.
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              AI-Powered Schema Generation
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                <strong>Coming Soon:</strong> Drag and drop images directly into Pattern Studio
                and our AI will automatically generate a schema based on the image content
              </li>
              <li>The AI analyzes your sample images and suggests field names, data types, and structure</li>
              <li>You can review, refine, and approve the AI-generated schema before publishing</li>
              <li>Perfect for quickly bootstrapping patterns when you have example images but aren&apos;t sure what schema to use</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Draft & Test
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Create unlimited draft versions to experiment with different schemas</li>
              <li>Test your patterns via API calls to see how they perform on real images</li>
              <li>Iterate on your instructions until you get perfect output</li>
              <li>Drafts don&apos;t consume your API quota—test freely!</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Publish & Version
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                Publishing creates a versioned snapshot of your pattern
              </li>
              <li>
                Each published version is immutable—your API responses stay consistent
              </li>
              <li>
                Roll back to previous versions anytime without breaking existing integrations
              </li>
              <li>
                View version history to track changes over time
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Best Practices
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                Be specific in instructions: Instead of &quot;find products&quot;, say &quot;identify product
                name, brand, and price from shelf labels&quot;
              </li>
              <li>
                Test with diverse images to ensure your pattern handles edge cases
              </li>
              <li>
                Keep schemas focused—one pattern per use case performs better than
                trying to do everything in one
              </li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "api-endpoints",
    title: "API Reference",
    description: "Complete API endpoints, authentication, and code examples.",
    content: (
      <div className="space-y-8">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Base URL
          </h3>
          <code className="text-sm font-mono">https://img-go.com/api</code>
          <p className="mt-3 text-sm text-muted-foreground">
            All endpoints require authentication via API key in the <code>Authorization</code> header.
            Responses are JSON by default unless you specify a different format.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Authentication
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Include your API key in every request using the Bearer token format:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm text-foreground/90">
            {`Authorization: Bearer imggo_live_your_api_key_here`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            Get your API key from Dashboard → API Keys. Keep it secret—never commit it
            to version control or expose it in client-side code.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-base font-semibold text-foreground">
            Core Endpoints
          </h3>
          <div className="rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border/80 bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Endpoint</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    POST /patterns
                  </td>
                  <td className="px-4 py-3">
                    Create a new pattern programmatically (most users create patterns
                    via the dashboard instead).
                  </td>
                </tr>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    GET /patterns
                  </td>
                  <td className="px-4 py-3">
                    List all your patterns with their IDs and endpoint URLs.
                  </td>
                </tr>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    POST /patterns/&lbrace;id&rbrace;/ingest
                  </td>
                  <td className="px-4 py-3">
                    <strong>Primary endpoint:</strong> Submit an image for processing.
                    Requires <code>Idempotency-Key</code> header to prevent duplicates.
                  </td>
                </tr>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    GET /jobs/&lbrace;id&rbrace;
                  </td>
                  <td className="px-4 py-3">
                    Check job status and retrieve the structured manifest. Add{" "}
                    <code>?format=xml</code> to get native format instead of JSON.
                  </td>
                </tr>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    POST /webhooks
                  </td>
                  <td className="px-4 py-3">
                    Register a webhook URL to receive real-time notifications when
                    jobs complete (recommended for production).
                  </td>
                </tr>
                <tr className="text-muted-foreground">
                  <td className="px-4 py-3 font-mono text-xs">
                    GET /webhooks
                  </td>
                  <td className="px-4 py-3">
                    List all your registered webhooks.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <CodeExamplesSection />

        <div className="space-y-6 mt-8">
          <h3 className="text-base font-semibold text-foreground">
            Getting Results in Native Format
          </h3>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
            <p className="text-sm text-muted-foreground mb-4">
              By default, job results are returned as JSON. However, for patterns created with non-JSON formats
              (YAML, XML, CSV, or plain text), you can request the native format using the <code className="bg-muted px-1 py-0.5 rounded">?format</code> query parameter.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
              {`# Get results in the pattern's native format
curl "https://img-go.com/api/jobs/YOUR_JOB_ID?format=yaml" \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Supported format values: json, yaml, xml, csv, text
# Example response (Content-Type: application/x-yaml):
pattern_name: landscape-analysis
scene_type: Alpine landscape
main_subjects:
  - Snow-capped mountains
  - Clear blue lake
  - Green meadows
colors:
  - Blue
  - Green
  - White
weather: Clear and sunny`}
            </pre>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>Note:</strong> The format parameter allows you to get the exact output format as defined in your pattern,
              perfect for direct integration with downstream systems that expect specific formats.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "api-permissions",
    title: "API Permissions & Scopes",
    description: "Control what your API keys can access with fine-grained permissions.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          API keys use scope-based permissions to control access to specific endpoints.
          When creating an API key, select only the scopes your application needs for security.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Available Scopes
          </h3>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">patterns:read</code>
              <p className="mt-1 text-muted-foreground">View pattern details and list all patterns</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">patterns:write</code>
              <p className="mt-1 text-muted-foreground">Create and update patterns programmatically</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">patterns:ingest</code>
              <p className="mt-1 text-muted-foreground">Submit images for processing (most common)</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">jobs:read</code>
              <p className="mt-1 text-muted-foreground">Check job status and retrieve results</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">webhooks:read</code>
              <p className="mt-1 text-muted-foreground">List registered webhooks</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">webhooks:write</code>
              <p className="mt-1 text-muted-foreground">Create and update webhooks</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <code className="text-primary font-semibold">webhooks:delete</code>
              <p className="mt-1 text-muted-foreground">Delete webhooks</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Test vs Live API Keys
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            API keys come in two flavors: <strong>Test</strong> and <strong>Live</strong>.
            They are functionally identical but help organize your environments.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="font-semibold text-foreground mb-2">Test Keys</h4>
              <code className="text-xs">imggo_test_xxxxx...</code>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>✓ Use in dev/staging</li>
                <li>✓ Testing new features</li>
                <li>✓ CI/CD pipelines</li>
                <li>✓ Local development</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="font-semibold text-foreground mb-2">Live Keys</h4>
              <code className="text-xs">imggo_live_xxxxx...</code>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>✓ Production apps</li>
                <li>✓ Customer-facing</li>
                <li>✓ Real data processing</li>
                <li>✓ Production webhooks</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 text-sm">
            <p className="font-semibold text-yellow-900 dark:text-yellow-200">
              Important: Both share the same quota
            </p>
            <p className="mt-1 text-yellow-800 dark:text-yellow-300">
              Test and Live keys count toward the same monthly request pool. There&apos;s no sandbox mode—both access your real data.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Security Note
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Pattern deletions can only be performed through the dashboard UI for security reasons.
            API keys cannot delete patterns even with write permissions.
          </p>
          <p className="text-sm text-muted-foreground">
            If an API key doesn&apos;t have the required scope for an endpoint, you&apos;ll receive a
            <code className="mx-1 bg-muted px-1 py-0.5 rounded">403 INSUFFICIENT_SCOPE</code> error.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "pattern-creation-api",
    title: "Creating Patterns via API",
    description: "Programmatically create patterns with code instead of using Pattern Studio.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          While most users create patterns through Pattern Studio, you can also create them
          programmatically via API. This is useful for automation, bulk creation, or integrating
          pattern creation into your workflow.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Requirements
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ API key with <code>patterns:write</code> scope</li>
            <li>✓ Pattern name (unique per account)</li>
            <li>✓ Instructions (what to extract from images)</li>
            <li>✓ Output format (json, yaml, xml, csv, or text)</li>
            <li>✓ Format-specific schema/template</li>
          </ul>
        </div>

        <div className="space-y-6">
          <h3 className="text-base font-semibold text-foreground">
            Code Examples
          </h3>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              JSON Format Example (cURL)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
{`curl -X POST https://img-go.com/api/patterns \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Product Extraction",
    "format": "json",
    "instructions": "Extract product name, brand, price, and availability from product images",
    "json_schema": {
      "type": "object",
      "properties": {
        "product_name": { "type": "string" },
        "brand": { "type": "string" },
        "price": { "type": "number" },
        "in_stock": { "type": "boolean" }
      },
      "required": ["product_name"],
      "additionalProperties": false
    }
  }'

# Response (201 Created)
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Product Extraction",
    "format": "json",
    "endpoint_url": "https://img-go.com/api/patterns/550e8400-e29b-41d4-a716-446655440000/ingest",
    "created_at": "2025-10-31T10:00:00Z"
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              CSV Format Example (TypeScript)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
{`const API_KEY = process.env.IMGGO_API_KEY;

async function createCsvPattern() {
  const response = await fetch("https://img-go.com/api/patterns", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Inventory Export",
      format: "csv",
      instructions: "Extract all visible products with SKU, quantity, and location",
      csv_schema: "SKU,Product_Name,Quantity,Location\\nP001,Widget,100,A1\\nP002,Gadget,50,B3",
      csv_delimiter: "comma"
    })
  });

  const result = await response.json();
  console.log("Pattern created:", result.data.endpoint_url);
  return result.data;
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              YAML Format Example (Python)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
{`import requests
import os

API_KEY = os.environ["IMGGO_API_KEY"]

def create_yaml_pattern():
    response = requests.post(
        "https://img-go.com/api/patterns",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "name": "Scene Analysis",
            "format": "yaml",
            "instructions": "Analyze scene type, main objects, colors, and weather",
            "yaml_schema": """scene_type: outdoor
main_objects:
  - mountains
  - lake
  - trees
dominant_colors:
  - blue
  - green
weather: sunny"""
        }
    )

    result = response.json()
    print(f"Pattern ID: {result['data']['id']}")
    return result["data"]

pattern = create_yaml_pattern()`}
            </pre>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Format-Specific Validation
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            All schemas are validated before pattern creation. Common validation rules:
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground">JSON:</strong> No whitespace in property keys,
              must include <code>additionalProperties: false</code> for OpenAI strict mode
            </div>
            <div>
              <strong className="text-foreground">YAML:</strong> Valid YAML syntax, must parse to an object
            </div>
            <div>
              <strong className="text-foreground">XML:</strong> Well-formed XML, matching open/close tags
            </div>
            <div>
              <strong className="text-foreground">CSV:</strong> All rows must have same column count, delimiter consistency
            </div>
            <div>
              <strong className="text-foreground">Plain Text:</strong> Must start with single # (main heading)
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Invalid schemas return <code>400 INVALID_SCHEMA</code> with a detailed error message.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20 p-6">
          <h3 className="mb-2 text-base font-semibold text-yellow-900 dark:text-yellow-200">
            Plan Limits Apply
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Pattern creation checks your plan&apos;s maximum pattern count (e.g., 5 on Free plan).
            If you&apos;ve reached your limit, you&apos;ll receive <code>403 PLAN_LIMIT_EXCEEDED</code>.
            Note: Pattern creation does <strong>not</strong> consume rate limit quota—only
            counting toward your total pattern count.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "jobs-webhooks",
    title: "Jobs & Webhooks",
    description: "Job lifecycle, status polling, and real-time webhooks.",
    content: (
      <div className="space-y-6">
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Job Lifecycle
          </h3>
          <p className="text-sm text-muted-foreground">
            When you submit an image, we create a job that goes through these states:
          </p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-xs font-semibold text-yellow-600">
                1
              </span>
              <div>
                <strong className="text-foreground">queued</strong> — Job is
                waiting to be processed. Usually takes 1-2 seconds.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-600">
                2
              </span>
              <div>
                <strong className="text-foreground">running</strong> — Our AI is
                analyzing your image. Usually takes 3-8 seconds.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-xs font-semibold text-green-600">
                3
              </span>
              <div>
                <strong className="text-foreground">succeeded</strong> — Done!
                Your structured manifest is ready to download.
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xs font-semibold text-red-600">
                ✕
              </span>
              <div>
                <strong className="text-foreground">failed</strong> — Something
                went wrong. Check the error message for details.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Polling vs Webhooks
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Polling (Simple)
              </h4>
              <p className="text-sm text-muted-foreground">
                Check job status every 2-3 seconds until it&apos;s done. Good for
                testing and low-volume use cases.
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Webhooks (Recommended)
              </h4>
              <p className="text-sm text-muted-foreground">
                We notify your server when jobs complete. More efficient and
                scalable for production applications.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Setting Up Webhooks via API
          </h3>
          <p className="text-sm text-muted-foreground">
            Webhooks are managed through our API. Here&apos;s how to create one:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
            {`curl -X POST https://img-go.com/api/webhooks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["job.succeeded", "job.failed"]
  }'

# Response (201 Created) - includes your webhook secret
{
  "success": true,
  "data": {
    "id": "b9dc9683-2bd9-457e-afe1-3555db1dff43",
    "url": "https://your-server.com/webhook",
    "events": ["job.succeeded", "job.failed"],
    "secret": "df6eb0f30ab3c49190d9bceef5ae196b9529a61ef98a694468b4882759abc533"
  }
}`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>Important:</strong> Save the <code>secret</code> from the response—it&apos;s
            shown only once and you&apos;ll need it to verify webhook signatures.
          </p>

          <div className="mt-4 rounded-md bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-foreground">
              Security: Always verify webhook signatures
            </p>
            <p className="mt-1 text-muted-foreground">
              Every webhook includes an <code>X-ImgGo-Signature</code> header with
              an HMAC SHA-256 signature. Verify it using your webhook secret before
              processing events. See the Python example in the API Reference section.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "rate-limits",
    title: "Pricing & Rate Limits",
    description: "Understand plans, quotas, and how to scale your usage.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          ImgGo pricing is based on the number of images you process per month.
          All plans include the same powerful AI features—the difference is in
          volume and rate limits.
        </p>

        <div className="rounded-lg border-2 border-primary bg-primary/5 p-6">
          <h3 className="text-lg font-semibold text-foreground">
            View Our Complete Pricing
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            We offer flexible plans starting with a free tier (50 requests/month) and scaling up to enterprise volumes. Visit our{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              pricing page
            </Link>{" "}
            for detailed information on:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>✓ Monthly request quotas for each plan</li>
            <li>✓ Rate limits and burst capacity</li>
            <li>✓ Template character limits</li>
            <li>✓ Webhook limits per plan</li>
            <li>✓ Support levels and SLAs</li>
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Reference
          </h3>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Free Plan:</span>
              <span className="font-medium text-foreground">50 requests/month</span>
            </div>
            <div className="flex justify-between">
              <span>Starter Plan:</span>
              <span className="font-medium text-foreground">500 requests/month</span>
            </div>
            <div className="flex justify-between">
              <span>Pro Plan:</span>
              <span className="font-medium text-foreground">3,000 requests/month</span>
            </div>
            <div className="flex justify-between">
              <span>Business Plan:</span>
              <span className="font-medium text-foreground">15,000 requests/month</span>
            </div>
            <div className="flex justify-between">
              <span>Enterprise:</span>
              <span className="font-medium text-foreground">Custom volume</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              How Rate Limits Work
            </h3>
            <p className="mt-2">
              When you make API requests, we track your usage against your
              plan&apos;s monthly quota. Every response includes these headers:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>
                <code>X-RateLimit-Limit</code>: Your total monthly quota
              </li>
              <li>
                <code>X-RateLimit-Remaining</code>: Requests left this period
              </li>
              <li>
                <code>X-RateLimit-Reset</code>: When your quota resets (Unix timestamp)
              </li>
            </ul>
            <p className="mt-3">
              If you exceed your quota, you&apos;ll receive a <code>429 Too Many Requests</code>{" "}
              error with instructions to upgrade your plan.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              What Has Rate Limits?
            </h3>
            <p className="mt-2">
              Rate limits apply only to <strong>image processing requests</strong> (pattern ingest endpoints).
              Pattern and webhook creation/management do NOT have rate limits—only plan-based count limits.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li><strong>Pattern Ingest (POST /patterns/:id/ingest):</strong> Has burst limits</li>
              <li><strong>Pattern Creation/Management:</strong> No rate limit, only max pattern count (e.g., 5 on Free)</li>
              <li><strong>Webhook Creation/Management:</strong> No rate limit, only max webhook count (e.g., 3 on Free)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Burst Limits (For Ingest Only)
            </h3>
            <p className="mt-2">
              Some plans have burst limits for image processing to ensure fair resource allocation:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Free:</strong> 1 request per minute</li>
              <li><strong>Starter:</strong> 10 requests per minute</li>
              <li><strong>Pro, Business, Enterprise:</strong> No burst limits</li>
            </ul>
            <p className="mt-2">
              Burst limits prevent traffic spikes from impacting other users while monthly
              quotas track your total usage.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Usage Monitoring
            </h3>
            <p className="mt-2">
              View your current usage anytime in the Dashboard under Settings → Usage.
              Track your monthly quota consumption and see when your quota resets.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 p-5 text-sm">
          <h3 className="font-semibold text-foreground">
            Need More Volume?
          </h3>
          <p className="mt-2 text-muted-foreground">
            Processing millions of images per month? Contact us at{" "}
            <a href="mailto:support@img-go.com" className="text-primary hover:underline">
              support@img-go.com
            </a>{" "}
            for custom enterprise pricing and dedicated infrastructure.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "observability",
    title: "Monitoring & Support",
    description: "Track your usage, monitor performance, and get help.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          ImgGo provides real-time visibility into your API usage, job history,
          and system performance through our dashboard and status page.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Dashboard Analytics
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              View real-time metrics including requests used, success rate, average
              processing time, and monthly usage trends.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Job History
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Review all processed images with their status, manifests, and error
              messages. Filter by pattern, date range, or status.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Webhook Logs
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitor webhook delivery status, view payloads, and debug failed
              deliveries with automatic retry logs.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Status Page
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Check system status, planned maintenance, and incident history at{" "}
              <a href="https://status.img-go.com" className="text-primary hover:underline">
                status.img-go.com
              </a>
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Performance Expectations
            </h3>
            <ul className="mt-2 space-y-2">
              <li>
                <strong className="text-foreground">Queue Time:</strong> 1-2 seconds
                (time from submission to processing start)
              </li>
              <li>
                <strong className="text-foreground">Processing Time:</strong> 3-8 seconds
                (AI analysis duration, varies by image complexity)
              </li>
              <li>
                <strong className="text-foreground">Total Time:</strong> 5-10 seconds
                end-to-end for most images
              </li>
              <li>
                <strong className="text-foreground">Availability:</strong> 99.9% uptime
                SLA on Enterprise plans
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Troubleshooting Failed Jobs
            </h3>
            <p className="mt-2">
              If a job fails, check the error message in the job details. Common
              issues include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Invalid or inaccessible image URL</li>
              <li>Image file too large (&gt;10MB)</li>
              <li>Unsupported image format (use JPG, PNG, WebP)</li>
              <li>Pattern schema validation errors</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="text-base font-semibold text-foreground">
            Need Help?
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground">Email Support:</strong>{" "}
              <a href="mailto:support@img-go.com" className="text-primary hover:underline">
                support@img-go.com
              </a>{" "}
              (Pro & Enterprise plans: &lt;24hr response time)
            </div>
            <div>
              <strong className="text-foreground">Sales & Enterprise:</strong>{" "}
              <a href="mailto:support@img-go.com" className="text-primary hover:underline">
                support@img-go.com
              </a>
            </div>
            <div>
              <strong className="text-foreground">Questions?</strong> Email us at{" "}
              <a href="mailto:contact@img-go.com" className="text-primary hover:underline">
                contact@img-go.com
              </a>{" "}
              for inquiries, partnerships, or enterprise solutions.
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "faq",
    title: "Frequently Asked Questions",
    description: "Common questions about using ImgGo.",
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            What image formats are supported?
          </h3>
          <p>
            ImgGo supports JPG, PNG, WebP, and GIF images. Images must be accessible
            via a public URL and should be under 10MB for best performance.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            How accurate is the AI extraction?
          </h3>
          <p>
            We use GPT-4 Vision with structured outputs, which enforces 100% schema
            compliance. The accuracy of extracted content depends on image quality
            and clarity. Test with your specific use case in Pattern Studio to
            validate results.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            What happens when I exceed my quota?
          </h3>
          <p>
            You&apos;ll receive a <code>429 Too Many Requests</code> error with
            instructions to upgrade. Your quota resets automatically at the start of
            each billing period. We recommend monitoring usage in the dashboard and
            upgrading proactively if you&apos;re approaching your limit.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Can I use ImgGo for sensitive data?
          </h3>
          <p>
            Yes. We use HTTPS for all connections, and your API keys are encrypted
            at rest. Images are processed in real-time and not permanently stored on
            our servers. Enterprise plans include additional security features like
            SOC 2 compliance and custom data retention policies.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Can I invite team members?
          </h3>
          <p>
            Yes! Pro and Enterprise plans support team collaboration. Invite teammates
            to your workspace, and they can create patterns and manage API keys. All
            team members share the same monthly quota.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            How do webhooks work?
          </h3>
          <p>
            Register a webhook URL in your dashboard, and we&apos;ll send an HTTP POST
            request when jobs complete. Each request includes an HMAC signature in
            the <code>X-ImgGo-Signature</code> header that you should verify to ensure
            authenticity. See the code examples in the API Reference section.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            What&apos;s your uptime guarantee?
          </h3>
          <p>
            We target 99.9% uptime across all plans. Enterprise customers receive a
            formal SLA with credits for any downtime. Check our{" "}
            <a href="https://status.img-go.com" className="text-primary hover:underline">
              status page
            </a>{" "}
            for real-time system health and incident history.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">
            Can I cancel anytime?
          </h3>
          <p>
            Yes. All plans are month-to-month with no long-term commitments (except
            custom Enterprise contracts). Cancel anytime from your dashboard. You&apos;ll
            retain access until the end of your current billing period.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h3 className="text-base font-semibold text-foreground">
            Still have questions?
          </h3>
          <div className="space-y-2">
            <p>
              <strong>Technical Support:</strong>{" "}
              <a
                className="text-primary transition hover:underline"
                href="mailto:support@img-go.com"
              >
                support@img-go.com
              </a>
            </p>
            <p>
              <strong>Sales & Enterprise:</strong>{" "}
              <a
                className="text-primary transition hover:underline"
                href="mailto:support@img-go.com"
              >
                support@img-go.com
              </a>
            </p>
            <p>
              <strong>General Inquiries:</strong>{" "}
              <a
                className="text-primary transition hover:underline"
                href="mailto:contact@img-go.com"
              >
                contact@img-go.com
              </a>
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "api-reference",
    title: "Interactive API Reference",
    description: "Explore and test all API endpoints with live examples.",
    content: (
      <div className="space-y-6">
        <p className="leading-relaxed text-muted-foreground">
          Try out the ImgGo API directly from this page! Our interactive API reference
          lets you explore all endpoints, see request/response examples, and test live
          API calls with your own API key.
        </p>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">
            How to Use
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click on any endpoint below to expand its documentation</li>
            <li>Click the <strong>Try It</strong> button to test with real data</li>
            <li>Add your API key using the authentication button (top-right)</li>
            <li>Customize the request parameters and body</li>
            <li>Click <strong>Send</strong> to make a live API call and see the response</li>
          </ol>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <ApiReferenceReact
            configuration={{
              url: '/openapi.yaml',
              theme: 'none',
              layout: 'modern',
              showSidebar: false,
              searchHotKey: 'k',
              authentication: {
                preferredSecurityScheme: 'bearerAuth',
              },
              defaultOpenAllTags: false,
            }}
          />
        </div>

        <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 p-4 text-sm">
          <p className="font-semibold text-yellow-900 dark:text-yellow-200">
            🔒 Live API Calls
          </p>
          <p className="mt-1 text-yellow-800 dark:text-yellow-300">
            When you test endpoints using the "Try It" feature, real API calls are made to
            your account. Make sure you&apos;re using a test API key if you&apos;re just
            exploring!
          </p>
        </div>
      </div>
    ),
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const [codeExampleMethod, setCodeExampleMethod] = useState<"url" | "file">("url");

  const activeSection =
    sections.find((section) => section.id === activeId) ?? sections[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs uppercase tracking-wide text-primary">
              Docs
            </span>
            ImgGo Documentation
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-1 flex-col px-6 py-12 lg:flex-row lg:px-8">
        <div className="mb-8 lg:hidden">
          <label
            htmlFor="docs-section"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Choose a topic
          </label>
          <div className="relative">
            <select
              id="docs-section"
              value={activeSection.id}
              onChange={(event) => setActiveId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 pr-8 lg:block">
          <div className="sticky top-24 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documentation
            </h2>
            <nav className="space-y-2 pb-8">
              {sections.map((section) => {
                const isActive = section.id === activeSection.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={[
                      "w-full rounded-lg border px-4 py-4 text-left transition",
                      isActive
                        ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="text-sm font-semibold">{section.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">
                      {section.description}
                    </p>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="flex-1 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Section
                </p>
                <h1 className="text-3xl font-semibold text-foreground">
                  {activeSection.title}
                </h1>
              </div>
            </div>
            <div className="space-y-6">
              {activeSection.content}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
