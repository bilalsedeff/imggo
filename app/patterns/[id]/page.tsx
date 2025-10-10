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

type JobStatus = "queued" | "running" | "succeeded" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  manifest: Record<string, unknown> | null;
  error: string | null;
  latency_ms: number | null;
}

export default function PatternDetailPage() {
  const params = useParams();
  const { session } = useAuth();
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Job state
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
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

      const { url: signedUrl, upload_path: uploadPath } =
        await signedUrlResponse.json();

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

      const { job_id } = await ingestResponse.json();
      setUploadProgress(100);

      // Start polling for job status
      startPolling(job_id);
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

      const job: Job = await response.json();
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

  const downloadManifest = () => {
    if (!currentJob?.manifest) return;

    const blob = new Blob([JSON.stringify(currentJob.manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${currentJob.id}.json`;
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
          <div className="border border-border rounded-lg p-6 mb-6">
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
                        <h3 className="font-medium text-sm">Manifest</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(currentJob.manifest, null, 2),
                                "manifest"
                              )
                            }
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
                        {JSON.stringify(currentJob.manifest, null, 2)}
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
