"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";
import { useAuth } from "@/providers/auth-provider";
import {
  Copy,
  CheckCircle,
  ExternalLink,
  Code,
  FileText,
  Calendar,
  Hash,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface Pattern {
  id: string;
  name: string;
  format: string;
  instructions: string;
  json_schema: Record<string, unknown> | null;
  is_active: boolean;
  version: number;
  created_at: string;
  endpoint_url: string;
}

export default function PatternDetailPage() {
  const params = useParams();
  const { session } = useAuth();
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const patternId = params?.id as string;

  useEffect(() => {
    if (!session?.access_token || !patternId) return;

    const fetchPattern = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/patterns/${patternId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setPattern(result.data);
        } else {
          setError("Failed to load pattern");
        }
      } catch (err) {
        console.error("Failed to fetch pattern:", err);
        setError("Failed to load pattern");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPattern();
  }, [session, patternId]);

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const curlExample = pattern
    ? `curl -X POST "${pattern.endpoint_url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://example.com/image.jpg"
  }'`
    : "";

  const nodeExample = pattern
    ? `const response = await fetch("${pattern.endpoint_url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    image_url: "https://example.com/image.jpg"
  })
});

const result = await response.json();
console.log(result);`
    : "";

  const pythonExample = pattern
    ? `import requests

response = requests.post(
    "${pattern.endpoint_url}",
    headers={
        "Authorization": "Bearer YOUR_API_KEY"
    },
    json={
        "image_url": "https://example.com/image.jpg"
    }
)

result = response.json()
print(result)`
    : "";

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <p className="text-muted-foreground">Loading pattern...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pattern) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 text-destructive mb-4">
              <AlertCircle className="w-5 h-5" />
              <p>{error || "Pattern not found"}</p>
            </div>
            <Link
              href="/patterns"
              className="text-primary hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patterns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <Link
            href="/patterns"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Patterns
          </Link>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{pattern.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  Version {pattern.version}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(pattern.created_at).toLocaleDateString()}
                </span>
                <span className="uppercase px-2 py-0.5 bg-muted rounded text-xs">
                  {pattern.format}
                </span>
                {pattern.is_active && (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Endpoint Section */}
          <div className="border border-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              API Endpoint
            </h2>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4 flex items-center justify-between">
              <code className="break-all">{pattern.endpoint_url}</code>
              <button
                onClick={() => copyToClipboard(pattern.endpoint_url, "endpoint")}
                className="ml-2 p-2 hover:bg-accent rounded transition flex-shrink-0"
                title="Copy endpoint"
              >
                {copiedItem === "endpoint" ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Send POST requests to this endpoint with your image URL to process images.
            </p>
          </div>

          {/* Instructions */}
          <div className="border border-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Instructions
            </h2>
            <p className="text-sm whitespace-pre-wrap">{pattern.instructions}</p>
          </div>

          {/* JSON Schema */}
          {pattern.json_schema && (
            <div className="border border-border rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Code className="w-5 h-5" />
                JSON Schema
              </h2>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(pattern.json_schema, null, 2)}
              </pre>
            </div>
          )}

          {/* Code Examples */}
          <div className="border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="w-5 h-5" />
              Code Examples
            </h2>

            {/* cURL */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">cURL</h3>
                <button
                  onClick={() => copyToClipboard(curlExample, "curl")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {copiedItem === "curl" ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {curlExample}
              </pre>
            </div>

            {/* Node.js */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Node.js</h3>
                <button
                  onClick={() => copyToClipboard(nodeExample, "node")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {copiedItem === "node" ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {nodeExample}
              </pre>
            </div>

            {/* Python */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Python</h3>
                <button
                  onClick={() => copyToClipboard(pythonExample, "python")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {copiedItem === "python" ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {pythonExample}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
