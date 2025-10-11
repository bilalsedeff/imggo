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
} from "lucide-react";

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

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchJobs = async () => {
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

    fetchJobs();
  }, [session, timeRange, selectedPatternId, selectedStatus, page]);

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
                        className="hover:bg-accent/50 transition"
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
      </div>
    </div>
  );
}
