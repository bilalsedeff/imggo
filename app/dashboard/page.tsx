"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";
import { useAuth } from "@/providers/auth-provider";
import {
  BarChart3,
  Zap,
  CheckCircle2,
  TrendingUp,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Metrics {
  total_patterns: number;
  active_patterns: number;
  jobs_today: number;
  success_rate: number;
  total_jobs: number;
}

interface Pattern {
  id: string;
  name: string;
  format: string;
  is_active: boolean;
}

interface Job {
  id: string;
  pattern_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  patterns: {
    name: string;
    format: string;
  };
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activePatterns, setActivePatterns] = useState<Pattern[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const response = await fetch("/api/dashboard/metrics", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setMetrics(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    const fetchActivePatterns = async () => {
      try {
        const response = await fetch("/api/patterns?is_active=true", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setActivePatterns(result.data?.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch active patterns:", err);
      }
    };

    const fetchRecentJobs = async () => {
      setIsLoadingJobs(true);
      try {
        const response = await fetch("/api/jobs?per_page=10", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setRecentJobs(result.data?.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch recent jobs:", err);
      } finally {
        setIsLoadingJobs(false);
      }
    };

    fetchMetrics();
    fetchActivePatterns();
    fetchRecentJobs();
  }, [session]);

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
        return <AlertCircle className="w-3 h-3" />;
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
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <Link
              href="/patterns/new"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Create Pattern
            </Link>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="p-6 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Patterns
                </h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingMetrics ? "..." : metrics?.total_patterns || 0}
              </p>
            </div>

            <div className="p-6 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Active Patterns
                </h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingMetrics ? "..." : metrics?.active_patterns || 0}
              </p>
            </div>

            <div className="p-6 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Jobs Today
                </h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingMetrics ? "..." : metrics?.jobs_today || 0}
              </p>
            </div>

            <div className="p-6 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </h3>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingMetrics ? "..." : `${metrics?.success_rate || 0}%`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Patterns */}
            <div className="border border-border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Active Patterns</h2>
                <Link
                  href="/patterns"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              {activePatterns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No active patterns. Create and publish a pattern to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {activePatterns.map((pattern) => (
                    <Link
                      key={pattern.id}
                      href={`/patterns/${pattern.id}`}
                      className="block p-3 border border-border rounded-lg hover:bg-accent transition"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{pattern.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-muted rounded uppercase ml-auto">
                          {pattern.format}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Jobs */}
            <div className="border border-border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Jobs</h2>
              </div>
              {isLoadingJobs ? (
                <p className="text-muted-foreground text-sm">Loading jobs...</p>
              ) : recentJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No jobs yet. Upload images to your patterns to see processing history.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{job.patterns.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {getStatusIcon(job.status)}
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
