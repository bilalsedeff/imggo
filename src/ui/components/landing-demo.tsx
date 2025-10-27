"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DemoPattern {
  id: string;
  name: string;
  format: string;
}

const DEMO_PATTERNS: DemoPattern[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "JSON Analysis", format: "json" },
  { id: "00000000-0000-0000-0000-000000000002", name: "CSV Analysis", format: "csv" },
  { id: "00000000-0000-0000-0000-000000000003", name: "XML Analysis", format: "xml" },
  { id: "00000000-0000-0000-0000-000000000004", name: "YAML Analysis", format: "yaml" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Text Analysis", format: "text" },
];

type ProcessingState = "idle" | "uploading" | "processing" | "completed" | "error";

export function LandingDemo() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<string>(DEMO_PATTERNS[0].id);
  const [state, setState] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10MB");
      return;
    }

    setUploadedFile(file);
    setError(null);
    setResult(null);
    setState("idle");

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleProcess = async () => {
    if (!uploadedFile || state === "completed") return;

    setState("uploading");
    setError(null);

    try {
      // Step 1: Get signed upload URL
      const urlResponse = await fetch("/api/uploads/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `demo/${Date.now()}-${uploadedFile.name}`,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { url: uploadUrl } = await urlResponse.json();

      // Step 2: Upload file to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadedFile,
        headers: {
          "Content-Type": uploadedFile.type,
          "x-upsert": "true",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Extract image URL from upload URL (remove query params)
      const imageUrl = uploadUrl?.split("?")?.[0] || uploadUrl;

      // Step 3: Process with demo endpoint (privileged, no rate limit)
      setState("processing");

      const processResponse = await fetch("/api/demo/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern_id: selectedPattern,
          image_url: imageUrl,
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.message || "Processing failed");
      }

      const { job_id } = await processResponse.json();

      // Step 4: Poll for result
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(`/api/demo/status/${job_id}`);

        if (!statusResponse.ok) {
          throw new Error("Failed to check status");
        }

        const { status, manifest, error: jobError } = await statusResponse.json();

        if (status === "succeeded") {
          // Format result based on pattern format
          const pattern = DEMO_PATTERNS.find((p) => p.id === selectedPattern);
          let formattedResult = "";

          if (pattern?.format === "json") {
            formattedResult = JSON.stringify(manifest, null, 2);
          } else if (pattern?.format === "yaml") {
            formattedResult = manifest;
          } else if (pattern?.format === "xml") {
            formattedResult = manifest;
          } else if (pattern?.format === "csv") {
            formattedResult = manifest;
          } else {
            formattedResult = manifest;
          }

          setResult(formattedResult);
          setState("completed");
          return;
        }

        if (status === "failed") {
          throw new Error(jobError || "Processing failed");
        }

        attempts++;
      }

      throw new Error("Processing timeout - please try again");
    } catch (err) {
      console.error("Demo processing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  const canProcess = uploadedFile && state !== "completed" && state !== "uploading" && state !== "processing";

  return (
    <div className="w-full max-w-7xl mx-auto mt-24 mb-16">
      {/* Demo Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3">Try It Now</h2>
        <p className="text-muted-foreground">
          Upload an image, select a format, and see structured data extraction in action
        </p>
      </div>

      {/* Three-Pillar Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Pillar: Upload */}
        <div className="border border-border rounded-lg p-6 flex flex-col">
          <h3 className="font-semibold mb-4 text-center">1. Upload Image</h3>

          <div
            {...getRootProps()}
            className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition ${
              isDragActive
                ? "border-primary bg-accent"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            } ${state === "completed" ? "pointer-events-none opacity-50" : ""}`}
          >
            <input {...getInputProps()} disabled={state === "completed"} />

            {imagePreview ? (
              <div className="w-full">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
                <p className="text-sm text-muted-foreground text-center truncate">
                  {uploadedFile?.name}
                </p>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {isDragActive
                    ? "Drop image here"
                    : "Drag & drop an image, or click to select"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, WEBP (max 10MB)
                </p>
              </>
            )}
          </div>
        </div>

        {/* Middle Pillar: Pattern Selection */}
        <div className="border border-border rounded-lg p-6 flex flex-col">
          <h3 className="font-semibold mb-4 text-center">2. Select Format</h3>

          <select
            value={selectedPattern}
            onChange={(e) => setSelectedPattern(e.target.value)}
            disabled={state === "completed"}
            className="w-full p-3 border border-border rounded-lg bg-background text-foreground mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {DEMO_PATTERNS.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name}
              </option>
            ))}
          </select>

          <div className="flex-1 flex flex-col justify-center items-center">
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {state === "uploading" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              )}
              {state === "processing" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              )}
              {state === "completed" && (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </>
              )}
              {state === "idle" && "Process Image"}
              {state === "error" && "Try Again"}
            </button>

            {error && (
              <p className="text-sm text-destructive mt-3 text-center">{error}</p>
            )}
          </div>
        </div>

        {/* Right Pillar: Results */}
        <div className="border border-border rounded-lg p-6 flex flex-col">
          <h3 className="font-semibold mb-4 text-center">3. View Results</h3>

          <div className="flex-1 flex flex-col">
            {result ? (
              <>
                <pre className="flex-1 p-4 bg-accent rounded-lg text-xs overflow-auto font-mono border border-border">
                  {result}
                </pre>

                <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5">
                  <p className="text-sm mb-3 text-center">
                    Want to process unlimited images with custom patterns?
                  </p>
                  <Link
                    href="/auth/signin"
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                  >
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center">
                {state === "processing" || state === "uploading" ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p>Processing your image...</p>
                  </div>
                ) : (
                  <p>Results will appear here after processing</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
