"use client";

import { useState, useEffect, useRef } from "react";
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
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Download,
  Edit3,
  Eye,
  History,
  ChevronDown,
} from "lucide-react";

interface Pattern {
  id: string;
  name: string;
  format: string;
  instructions: string;
  json_schema: Record<string, unknown> | null;
  yaml_schema?: string | null;
  xml_schema?: string | null;
  csv_schema?: string | null;
  plain_text_schema?: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  endpoint_url: string;
}

type JobStatus = "queued" | "running" | "succeeded" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  manifest: Record<string, unknown> | string | null;
  error: string | null;
  latency_ms: number | null;
}

interface PatternVersion {
  version: number;
  json_schema: Record<string, unknown> | null;
  yaml_schema: string | null;
  xml_schema: string | null;
  csv_schema: string | null;
  plain_text_schema: string | null;
  instructions: string;
  format: string;
  created_at: string;
}

export default function PatternDetailPage() {
  const params = useParams();
  const { session } = useAuth();
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [versions, setVersions] = useState<PatternVersion[]>([]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);
  const [codeExampleTab, setCodeExampleTab] = useState<"url" | "file">("url");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Job state
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for version dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  const patternId = params?.id as string;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

  // Fetch versions
  useEffect(() => {
    if (!session?.access_token || !patternId) return;

    const fetchVersions = async () => {
      try {
        const response = await fetch(`/api/patterns/${patternId}/versions`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setVersions(result.data.versions);
        }
      } catch (err) {
        console.error("Failed to fetch versions:", err);
      }
    };

    fetchVersions();
  }, [session, patternId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVersionDropdown(false);
      }
    };

    if (showVersionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showVersionDropdown]);

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleSwitchVersion = async (targetVersion: number) => {
    if (!session?.access_token || !patternId) return;

    setIsSwitchingVersion(true);
    setShowVersionDropdown(false);

    try {
      const response = await fetch(`/api/patterns/${patternId}/versions/switch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ version: targetVersion }),
      });

      if (response.ok) {
        const result = await response.json();
        setPattern(result.data.pattern);
        // Refresh versions
        const versionsResponse = await fetch(`/api/patterns/${patternId}/versions`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (versionsResponse.ok) {
          const versionsResult = await versionsResponse.json();
          setVersions(versionsResult.data.versions);
        }
      } else {
        setError("Failed to switch version");
      }
    } catch (err) {
      console.error("Failed to switch version:", err);
      setError("Failed to switch version");
    } finally {
      setIsSwitchingVersion(false);
    }
  };

  // Helper to sanitize file names for storage
  const sanitizeFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf(".");
    const name = lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;
    const ext = lastDotIndex !== -1 ? fileName.slice(lastDotIndex) : "";

    // Remove special characters, keep only alphanumeric, dash, underscore, dot
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    return cleanName + ext.toLowerCase();
  };

  const validateAndSetFile = (file: File): boolean => {
    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please select a valid image file (JPG, PNG, or WebP)");
      return false;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError("File size must be less than 10MB");
      return false;
    }

    setSelectedFile(file);
    setUploadError("");
    setCurrentJob(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !session?.access_token || !supabaseUrl) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");

    try {
      // Step 1: Get signed upload URL
      setUploadProgress(20);
      const sanitizedName = sanitizeFileName(selectedFile.name);
      const signedUrlResponse = await fetch("/api/uploads/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: `${Date.now()}_${sanitizedName}`,
          content_type: selectedFile.type,
        }),
      });

      if (!signedUrlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { data: signedUrlData } = await signedUrlResponse.json();
      const { url: signedUrl, upload_path: uploadPath } = signedUrlData;

      // Step 2: Upload file to signed URL
      setUploadProgress(40);
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Construct public URL
      setUploadProgress(60);
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${uploadPath}`;

      // Step 4: Enqueue job
      setUploadProgress(80);
      const ingestResponse = await fetch(
        `/api/patterns/${patternId}/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            image_url: publicUrl,
          }),
        }
      );

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json();
        throw new Error(errorData.error?.message || "Failed to enqueue job");
      }

      // Handle different response formats based on Content-Type
      const contentType = ingestResponse.headers.get("content-type") || "";
      let jobId: string;

      if (contentType.includes("application/json")) {
        // JSON format - standard response
        const { data } = await ingestResponse.json();
        jobId = data.job_id;
      } else {
        // YAML/XML/CSV/TEXT format - plain text response
        // Job ID is in header
        jobId = ingestResponse.headers.get("X-Job-Id") || "";
        if (!jobId) {
          throw new Error("Job ID not found in response");
        }
      }

      setUploadProgress(100);

      // Start polling for job status
      startPolling(jobId);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setIsUploading(false);
    }
  };

  const startPolling = (jobId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Initial fetch
    fetchJobStatus(jobId);

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchJobStatus(jobId);
    }, 2000);
  };

  const fetchJobStatus = async (jobId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }

      // Handle different response formats based on Content-Type
      const contentType = response.headers.get("content-type") || "";
      let job: Job;

      if (contentType.includes("application/json")) {
        // JSON format - standard response with job object
        const { data } = await response.json();
        job = data;
      } else {
        // YAML/XML/CSV/TEXT format - plain text manifest
        // Job details are in headers
        const manifestText = await response.text();
        const status = response.headers.get("X-Job-Status") as JobStatus || "succeeded";

        job = {
          id: jobId,
          status,
          manifest: manifestText, // Store formatted text (YAML/XML/CSV/TEXT)
          error: null,
          latency_ms: null,
        };
      }

      setCurrentJob(job);

      // Stop polling if job is complete
      if (job.status === "succeeded" || job.status === "failed") {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsUploading(false);
      }
    } catch (err) {
      console.error("Failed to fetch job status:", err);
      // Don't stop polling on fetch errors, might be transient
    }
  };

  const downloadManifest = (): void => {
    if (!currentJob?.manifest || !pattern) return;

    // Determine content and file extension based on format
    let content: string;
    let extension: string;
    let mimeType: string;

    if (typeof currentJob.manifest === 'string') {
      // Already formatted text (YAML/XML/CSV/TEXT)
      content = currentJob.manifest;
      extension = pattern.format;
      mimeType = pattern.format === 'yaml' ? 'application/x-yaml'
        : pattern.format === 'xml' ? 'application/xml'
        : pattern.format === 'csv' ? 'text/csv'
        : 'text/plain';
    } else {
      // JSON object
      content = JSON.stringify(currentJob.manifest, null, 2);
      extension = 'json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${currentJob.id}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setCurrentJob(null);
    setUploadError("");
    setUploadProgress(0);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Code examples for URL-based upload
  const curlExampleUrl = pattern
    ? `curl -X POST "${pattern.endpoint_url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "image_url": "https://example.com/image.jpg"
  }'`
    : "";

  const nodeExampleUrl = pattern
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

  const pythonExampleUrl = pattern
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

  // Code examples for file upload
  const curlExampleFile = pattern
    ? `curl -X POST "${pattern.endpoint_url}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "image=@/path/to/your/image.jpg"`
    : "";

  const nodeExampleFile = pattern
    ? `const fs = require('fs');
const FormData = require('form-data');

const formData = new FormData();
formData.append('image', fs.createReadStream('/path/to/your/image.jpg'));

const response = await fetch("${pattern.endpoint_url}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    ...formData.getHeaders()
  },
  body: formData
});

const result = await response.json();
console.log(result);`
    : "";

  const pythonExampleFile = pattern
    ? `import requests

with open('/path/to/your/image.jpg', 'rb') as image_file:
    response = requests.post(
        "${pattern.endpoint_url}",
        headers={
            "Authorization": "Bearer YOUR_API_KEY"
        },
        files={
            "image": image_file
        }
    )

result = response.json()
print(result)`
    : "";

  // Select examples based on active tab
  const curlExample = codeExampleTab === "url" ? curlExampleUrl : curlExampleFile;
  const nodeExample = codeExampleTab === "url" ? nodeExampleUrl : nodeExampleFile;
  const pythonExample = codeExampleTab === "url" ? pythonExampleUrl : pythonExampleFile;

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
            <div className="flex items-center gap-2">
              {/* Version History Dropdown */}
              {versions.length > 1 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition flex items-center gap-2"
                    disabled={isSwitchingVersion}
                  >
                    <History className="w-4 h-4" />
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showVersionDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                          Version History
                        </div>
                        {versions.map((v) => (
                          <button
                            key={v.version}
                            onClick={() => handleSwitchVersion(v.version)}
                            disabled={v.version === pattern.version || isSwitchingVersion}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent transition flex items-center justify-between ${
                              v.version === pattern.version
                                ? "bg-accent font-medium"
                                : ""
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <div className="flex items-center gap-2">
                              <Hash className="w-3 h-3" />
                              <span>Version {v.version}</span>
                              {v.version === pattern.version && (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Link
                href={`/patterns/new?pattern_id=${pattern.id}`}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Create New Version
              </Link>
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

          {/* Pattern Schema Preview */}
          {pattern.json_schema && (
            <div className="border border-border rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Pattern Example (JSON Schema)
                </h2>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(pattern.json_schema, null, 2), "schema")}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {copiedItem === "schema" ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(pattern.json_schema, null, 2)}
              </pre>
              {pattern.format !== "json" && (
                <div className="mt-4 text-xs text-muted-foreground">
                  <p>
                    Note: This pattern returns data in <span className="font-medium uppercase">{pattern.format}</span> format.
                    The JSON Schema shown above defines the structure, which is then converted to {pattern.format.toUpperCase()} in the API response.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Code Examples */}
          <div className="border border-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Code className="w-5 h-5" />
              Code Examples
            </h2>

            {/* Authentication Note */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    API Authentication Required
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    To use the API programmatically, you need an API key. Replace{" "}
                    <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono text-xs">
                      YOUR_API_KEY
                    </code>{" "}
                    in the examples below with your actual API key.
                  </p>
                  <Link
                    href="/settings/api-keys"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Create API Key
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Upload Method Tabs */}
            <div className="flex gap-2 mb-6 border-b border-border">
              <button
                onClick={() => setCodeExampleTab("url")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  codeExampleTab === "url"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Image URL
              </button>
              <button
                onClick={() => setCodeExampleTab("file")}
                className={`px-4 py-2 text-sm font-medium transition ${
                  codeExampleTab === "file"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                File Upload
              </button>
            </div>

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

          {/* Test Pattern Section */}
          <div className="border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Test Pattern
            </h2>

            {/* File Selection */}
            {!selectedFile && !currentJob && (
              <div>
                <label
                  htmlFor="file-upload"
                  className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports JPG, PNG, WebP (max 10MB)
                  </p>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                {uploadError && (
                  <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <p>{uploadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* File Preview & Upload */}
            {selectedFile && !currentJob && (
              <div>
                <div className="mb-4">
                  <div className="flex items-start gap-4">
                    {filePreview && (
                      <div className="w-32 h-32 border border-border rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpload}
                          disabled={isUploading}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Upload & Process
                            </>
                          )}
                        </button>
                        <button
                          onClick={resetUpload}
                          disabled={isUploading}
                          className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Progress */}
                {isUploading && uploadProgress > 0 && (
                  <div className="mb-4">
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {uploadProgress < 100
                        ? `Uploading... ${uploadProgress}%`
                        : "Processing..."}
                    </p>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <p>{uploadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Job Status */}
            {currentJob && (
              <div>
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    {currentJob.status === "queued" && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
                        <span className="text-sm font-medium">
                          Queued for processing...
                        </span>
                      </>
                    )}
                    {currentJob.status === "running" && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        <span className="text-sm font-medium">
                          Processing image...
                        </span>
                      </>
                    )}
                    {currentJob.status === "succeeded" && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          Complete!
                        </span>
                        {currentJob.latency_ms && (
                          <span className="text-xs text-muted-foreground">
                            ({(currentJob.latency_ms / 1000).toFixed(2)}s)
                          </span>
                        )}
                      </>
                    )}
                    {currentJob.status === "failed" && (
                      <>
                        <XCircle className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-medium text-destructive">
                          Failed
                        </span>
                      </>
                    )}
                  </div>

                  {/* Error Display */}
                  {currentJob.status === "failed" && currentJob.error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                      <p className="text-sm text-destructive">
                        {currentJob.error}
                      </p>
                    </div>
                  )}

                  {/* Manifest Display */}
                  {currentJob.status === "succeeded" && currentJob.manifest && (
                    <div className="bg-muted rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">
                          Manifest {pattern && `(${pattern.format.toUpperCase()})`}
                        </h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const text = typeof currentJob.manifest === 'string'
                                ? currentJob.manifest
                                : JSON.stringify(currentJob.manifest, null, 2);
                              copyToClipboard(text, "manifest");
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {copiedItem === "manifest" ? (
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
                          <button
                            onClick={downloadManifest}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>
                      </div>
                      <pre className="bg-background p-3 rounded text-xs overflow-x-auto max-h-96">
                        {typeof currentJob.manifest === 'string'
                          ? currentJob.manifest
                          : JSON.stringify(currentJob.manifest, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={resetUpload}
                      className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent"
                    >
                      Test Another Image
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
