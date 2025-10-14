"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/ui/components/navbar";
import { useAuth } from "@/providers/auth-provider";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/components/sheet";

interface Job {
  id: string;
  pattern_id: string;
  image_url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  manifest: Record<string, unknown> | null;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  idempotency_key: string | null;
  extras: Record<string, unknown> | null;
  requested_by: string | null;
  patterns: {
    id: string;
    name: string;
    format: string;
  };
}

interface Pattern {
  id: string;
  name: string;
  format: string;
}

export default function LogsPage() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);

  // Filters
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [selectedPatternId, setSelectedPatternId] = useState<string>(
    searchParams?.get("pattern_id") || ""
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Job Detail Drawer
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoadingJobDetail, setIsLoadingJobDetail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchPatterns = async () => {
      try {
        const response = await fetch("/api/patterns", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setPatterns(result.data?.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch patterns:", err);
      }
    };

    fetchPatterns();
  }, [session]);

  const fetchJobs = async () => {
    if (!session?.access_token) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        time_range: timeRange,
        page: page.toString(),
        per_page: "50",
      });

      if (selectedPatternId) params.append("pattern_id", selectedPatternId);
      if (selectedStatus) params.append("status", selectedStatus);

      const response = await fetch(`/api/logs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setJobs(result.data?.data || []);
        setTotalPages(result.data?.pagination?.total_pages || 1);
        setTotalJobs(result.data?.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [session, timeRange, selectedPatternId, selectedStatus, page]);

  // Fetch job detail when selectedJobId changes
  useEffect(() => {
    if (!selectedJobId || !session?.access_token) return;

    const fetchJobDetail = async () => {
      setIsLoadingJobDetail(true);
      try {
        // Force JSON response regardless of pattern format by adding ?format=json
        const response = await fetch(`/api/jobs/${selectedJobId}?format=json`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setSelectedJob(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch job detail:", err);
      } finally {
        setIsLoadingJobDetail(false);
      }
    };

    fetchJobDetail();
  }, [selectedJobId, session]);

  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (status: Job["status"]) => {
    switch (status) {
      case "succeeded":
        return "text-green-600 bg-green-500/10";
      case "failed":
        return "text-red-600 bg-red-500/10";
      case "running":
        return "text-blue-600 bg-blue-500/10";
      case "queued":
        return "text-yellow-600 bg-yellow-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="w-3 h-3" />;
      case "failed":
        return <XCircle className="w-3 h-3" />;
      case "running":
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case "queued":
        return <Clock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Job Logs</h1>
              <p className="text-muted-foreground mt-1">
                {totalJobs} total jobs
              </p>
            </div>
            <button
              onClick={fetchJobs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>

          {/* Filters */}
          <div className="border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Filters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Time Range Filter */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                >
                  <option value="1m">Last 1 minute</option>
                  <option value="15m">Last 15 minutes</option>
                  <option value="1h">Last 1 hour</option>
                  <option value="6h">Last 6 hours</option>
                  <option value="12h">Last 12 hours</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="all">All time</option>
                </select>
              </div>

              {/* Pattern Filter */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Pattern
                </label>
                <select
                  value={selectedPatternId}
                  onChange={(e) => {
                    setSelectedPatternId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                >
                  <option value="">All patterns</option>
                  {patterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.name} ({pattern.format})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                  <option value="queued">Queued</option>
                </select>
              </div>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No jobs found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Pattern
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Latency
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className="hover:bg-accent/50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium">{job.patterns.name}</p>
                            <p className="text-xs text-muted-foreground uppercase">
                              {job.patterns.format}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 w-fit ${getStatusColor(
                              job.status
                            )}`}
                          >
                            {getStatusIcon(job.status)}
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {job.latency_ms ? `${job.latency_ms}ms` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {job.error ? (
                            <div className="flex items-start gap-1 text-red-600">
                              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span className="text-xs line-clamp-2">
                                {job.error}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Job Detail Drawer */}
        <Sheet open={!!selectedJobId} onOpenChange={(open) => !open && setSelectedJobId(null)}>
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {isLoadingJobDetail ? "Loading..." : "Job Details"}
              </SheetTitle>
              <SheetDescription>
                {isLoadingJobDetail
                  ? "Fetching job information..."
                  : "Complete information about this job execution"}
              </SheetDescription>
            </SheetHeader>

            {isLoadingJobDetail ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : selectedJob ? (
              <>


                <div className="mt-6 space-y-6">
                  {/* Overview Section */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Overview
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Job ID</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{selectedJob.id}</code>
                          <button
                            onClick={() => handleCopyToClipboard(selectedJob.id, "job_id")}
                            className="p-1 hover:bg-accent rounded transition"
                          >
                            {copiedField === "job_id" ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getStatusColor(
                            selectedJob.status
                          )}`}
                        >
                          {getStatusIcon(selectedJob.status)}
                          {selectedJob.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pattern</span>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs font-medium">{selectedJob.patterns.name}</p>
                            <p className="text-xs text-muted-foreground uppercase">
                              {selectedJob.patterns.format}
                            </p>
                          </div>
                          <a
                            href={`/patterns/${selectedJob.pattern_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-accent rounded transition"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {selectedJob.latency_ms && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Latency</span>
                          <span className="text-sm font-mono">{selectedJob.latency_ms}ms</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Request Details Section */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Request Details</h3>
                    <div className="space-y-3">
                      {/* Image URL */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-muted-foreground">Image URL</span>
                          <button
                            onClick={() => handleCopyToClipboard(selectedJob.image_url, "image_url")}
                            className="p-1 hover:bg-accent rounded transition"
                          >
                            {copiedField === "image_url" ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                          {selectedJob.image_url}
                        </code>
                      </div>

                      {/* Idempotency Key */}
                      {selectedJob.idempotency_key && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-muted-foreground">
                              Idempotency Key
                            </span>
                            <button
                              onClick={() =>
                                handleCopyToClipboard(selectedJob.idempotency_key!, "idempotency_key")
                              }
                              className="p-1 hover:bg-accent rounded transition"
                            >
                              {copiedField === "idempotency_key" ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                            {selectedJob.idempotency_key}
                          </code>
                        </div>
                      )}

                      {/* Extras */}
                      {selectedJob.extras && Object.keys(selectedJob.extras).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-muted-foreground">
                              Request Extras
                            </span>
                            <button
                              onClick={() =>
                                handleCopyToClipboard(
                                  JSON.stringify(selectedJob.extras, null, 2),
                                  "extras"
                                )
                              }
                              className="p-1 hover:bg-accent rounded transition"
                            >
                              {copiedField === "extras" ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <pre className="text-xs bg-muted px-2 py-2 rounded overflow-x-auto">
                            {JSON.stringify(selectedJob.extras, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Section */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Response</h3>
                    {selectedJob.status === "succeeded" && selectedJob.manifest ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-muted-foreground">Manifest</span>
                          <button
                            onClick={() =>
                              handleCopyToClipboard(
                                selectedJob.patterns.format === "text" &&
                                typeof selectedJob.manifest === "object" &&
                                selectedJob.manifest !== null &&
                                "text" in selectedJob.manifest
                                  ? (selectedJob.manifest as { text: string }).text
                                  : JSON.stringify(selectedJob.manifest, null, 2),
                                "manifest"
                              )
                            }
                            className="p-1 hover:bg-accent rounded transition"
                          >
                            {copiedField === "manifest" ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-muted px-2 py-2 rounded overflow-x-auto max-h-96">
                          {selectedJob.patterns.format === "text" &&
                          typeof selectedJob.manifest === "object" &&
                          selectedJob.manifest !== null &&
                          "text" in selectedJob.manifest
                            ? (selectedJob.manifest as { text: string }).text
                            : JSON.stringify(selectedJob.manifest, null, 2)}
                        </pre>
                      </div>
                    ) : selectedJob.status === "failed" && selectedJob.error ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-muted-foreground">Error</span>
                          <button
                            onClick={() => handleCopyToClipboard(selectedJob.error!, "error")}
                            className="p-1 hover:bg-accent rounded transition"
                          >
                            {copiedField === "error" ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-xs bg-red-500/10 border border-red-500/20 text-red-600 px-2 py-2 rounded">
                          {selectedJob.error}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {selectedJob.status === "running"
                          ? "Job is still running..."
                          : "Job is queued, waiting to be processed"}
                      </p>
                    )}
                  </div>

                  {/* Timing Section */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Timing
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Created At</span>
                        <span className="text-xs font-mono">
                          {new Date(selectedJob.created_at).toLocaleString()}
                        </span>
                      </div>

                      {selectedJob.started_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Started At</span>
                          <span className="text-xs font-mono">
                            {new Date(selectedJob.started_at).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {selectedJob.completed_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Completed At</span>
                          <span className="text-xs font-mono">
                            {new Date(selectedJob.completed_at).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {selectedJob.latency_ms && (
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-sm font-medium text-muted-foreground">
                            Total Duration
                          </span>
                          <span className="text-sm font-mono font-semibold">
                            {selectedJob.latency_ms}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No job selected
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
