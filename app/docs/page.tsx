/* eslint-disable react/no-array-index-key */

"use client";

import { useState } from "react";
import Link from "next/link";

type NavSection = {
  id: string;
  title: string;
  description: string;
  content: JSX.Element;
};

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

# Response
{
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued"
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
              Draft & Test
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Create unlimited draft versions to experiment with different schemas</li>
              <li>Upload test images directly in the dashboard to preview results</li>
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
    id: "api-reference",
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

        <div className="space-y-6">
          <h3 className="text-base font-semibold text-foreground">
            Code Examples
          </h3>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              1. Submit Image for Processing (cURL)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
              {`curl -X POST https://img-go.com/api/patterns/YOUR_PATTERN_ID/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: \$(uuidgen)" \\
  -d '{
    "image_url": "https://your-cdn.com/image.jpg"
  }'

# Response
{
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued"
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              2. Check Job Status & Get Results (cURL)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
              {`curl https://img-go.com/api/jobs/JOB_ID \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Response (when completed)
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "succeeded",
    "manifest": {
      "products": [
        {
          "name": "Coca-Cola 500ml",
          "brand": "Coca-Cola",
          "price_tag_visible": true
        }
      ]
    },
    "latency_ms": 3200
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              3. Complete Workflow (Node.js/TypeScript)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
              {`const IMGGO_API_KEY = process.env.IMGGO_API_KEY;
const PATTERN_ID = "your-pattern-id";

async function processImage(imageUrl: string) {
  // 1. Submit image
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
  const { data: { job_id } } = await submitRes.json();

  // 2. Poll for results
  let result;
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(
      \`https://img-go.com/api/jobs/\${job_id}\`,
      {
        headers: { "Authorization": \`Bearer \${IMGGO_API_KEY}\` },
      }
    );
    const { data } = await statusRes.json();

    if (data.status === "succeeded") {
      return data.manifest;
    }
    if (data.status === "failed") {
      throw new Error(data.error);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("Timeout waiting for job");
}`}
            </pre>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              4. Using Webhooks (Python)
            </h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground/90">
              {`import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)
WEBHOOK_SECRET = "your_webhook_secret"

@app.route("/imggo-webhook", methods=["POST"])
def handle_webhook():
    # 1. Verify signature
    signature = request.headers.get("X-ImgGo-Signature")
    payload = request.get_json()

    computed = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed, signature):
        return "Invalid signature", 401

    # 2. Process event
    if payload["event"] == "job.succeeded":
        manifest = payload["manifest"]
        print(f"Job {payload['job_id']} succeeded:", manifest)
        # Process your data here...

    return "OK", 200`}
            </pre>
          </div>
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
            Setting Up Webhooks
          </h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              1. Go to <strong>Dashboard → Webhooks</strong> and click{" "}
              <strong>&quot;Add Webhook&quot;</strong>
            </li>
            <li>
              2. Enter your server&apos;s URL (must be HTTPS in production)
            </li>
            <li>
              3. Select events: <code>job.succeeded</code> and <code>job.failed</code>
            </li>
            <li>
              4. Save and copy your webhook secret—you&apos;ll need it to verify
              signatures
            </li>
          </ol>

          <div className="mt-4 rounded-md bg-primary/5 p-4 text-sm">
            <p className="font-semibold text-foreground">
              Security: Always verify webhook signatures
            </p>
            <p className="mt-1 text-muted-foreground">
              We sign every webhook with HMAC SHA-256. Verify the{" "}
              <code>X-ImgGo-Signature</code> header before processing events to
              prevent spoofing attacks. See code examples in the API Reference
              section.
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Free
            </h3>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">50</div>
              <div className="text-sm text-muted-foreground">requests/month</div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>✓ All 5 output formats</li>
              <li>✓ Pattern Studio access</li>
              <li>✓ API & webhooks</li>
              <li>• 1 request per minute</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-5">
            <div className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
              POPULAR
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pro
            </h3>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">10,000</div>
              <div className="text-sm text-muted-foreground">requests/month</div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>✓ Everything in Free</li>
              <li>✓ No burst limits</li>
              <li>✓ Priority processing</li>
              <li>✓ Email support</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Enterprise
            </h3>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">Custom</div>
              <div className="text-sm text-muted-foreground">volume pricing</div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>✓ Everything in Pro</li>
              <li>✓ Dedicated support</li>
              <li>✓ 99.9% SLA</li>
              <li>✓ Custom contracts</li>
            </ul>
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
              Burst Limits (Free Plan Only)
            </h3>
            <p className="mt-2">
              Free plans have an additional burst limit of 1 request per minute to
              ensure fair resource allocation. If you need to process images faster,
              upgrade to Pro for unlimited burst capacity.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              Usage Monitoring
            </h3>
            <p className="mt-2">
              View your current usage anytime in the Dashboard. You&apos;ll also receive
              email alerts when you reach 80% and 100% of your monthly quota.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 p-5 text-sm">
          <h3 className="font-semibold text-foreground">
            Need More Volume?
          </h3>
          <p className="mt-2 text-muted-foreground">
            Processing millions of images per month? Contact us at{" "}
            <a href="mailto:sales@img-go.com" className="text-primary hover:underline">
              sales@img-go.com
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
              <a href="mailto:sales@img-go.com" className="text-primary hover:underline">
                sales@img-go.com
              </a>
            </div>
            <div>
              <strong className="text-foreground">Documentation:</strong> Check our{" "}
              <Link href="/docs" className="text-primary hover:underline">
                full documentation
              </Link>{" "}
              and{" "}
              <a href="https://help.img-go.com" className="text-primary hover:underline">
                help center
              </a>
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
                href="mailto:sales@img-go.com"
              >
                sales@img-go.com
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
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  const activeSection =
    sections.find((section) => section.id === activeId) ?? sections[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
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
          <div className="sticky top-24 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documentation
            </h2>
            <nav className="space-y-2">
              {sections.map((section) => {
                const isActive = section.id === activeSection.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={[
                      "w-full rounded-lg border px-4 py-3 text-left transition",
                      isActive
                        ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="text-sm font-semibold">{section.title}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
