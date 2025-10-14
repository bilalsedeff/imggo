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
  Search,
  Activity,
} from "lucide-react";

interface Metrics {
  total_patterns: number;
  active_patterns: number;
  jobs_today: number;
  success_rate: number;
  total_jobs: number;
  success_rate_24h: number;
  total_jobs_24h: number;
  successful_jobs_24h: number;
}

interface Pattern {
  id: string;
  name: string;
  format: string;
  is_active: boolean;
}

interface PatternStat {
  pattern_id: string;
  pattern_name: string;
  pattern_format: string;
  total_jobs_24h: number;
  successful_jobs_24h: number;
  success_rate: number;
  last_job_at: string;
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activePatterns, setActivePatterns] = useState<Pattern[]>([]);
  const [patternStats, setPatternStats] = useState<PatternStat[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [successRateTimeRange, setSuccessRateTimeRange] = useState<"24h" | "all">("all");

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

    const fetchPatternStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch("/api/dashboard/pattern-stats", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setPatternStats(result.data?.stats || []);
        }
      } catch (err) {
        console.error("Failed to fetch pattern stats:", err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchMetrics();
    fetchActivePatterns();
    fetchPatternStats();
  }, [session]);

  // Success rate color: green at 100%, transitions to red as it decreases
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return "text-green-600";
    if (rate >= 80) return "text-yellow-600";
    if (rate >= 50) return "text-orange-600";
    return "text-red-600";
  };

  // Format time ago: Xm for minutes, Xh for hours (rounded)
  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }

    // Convert to hours with rounding
    // If minutes >= 30, round up, else round down
    const hours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    const roundedHours = remainingMinutes >= 30 ? hours + 1 : hours;

    return `${roundedHours}h`;
  };

  // Filter active patterns by search query
  const filteredPatterns = activePatterns.filter((pattern) =>
    pattern.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Success Rate ({successRateTimeRange === "24h" ? "Last 24h" : "All Time"})
                  </h3>
                </div>
                {/* Time Range Toggle */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSuccessRateTimeRange("24h")}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                      successRateTimeRange === "24h"
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground/40 hover:text-muted-foreground/60"
                    }`}
                  >
                    24h
                  </button>
                  <button
                    onClick={() => setSuccessRateTimeRange("all")}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                      successRateTimeRange === "all"
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground/40 hover:text-muted-foreground/60"
                    }`}
                  >
                    Ever
                  </button>
                </div>
              </div>
              <p className="text-3xl font-bold">
                {isLoadingMetrics
                  ? "..."
                  : successRateTimeRange === "24h"
                  ? `${metrics?.success_rate_24h || 0}%`
                  : `${metrics?.success_rate || 0}%`}
              </p>
              {!isLoadingMetrics && metrics && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {successRateTimeRange === "24h"
                    ? `${metrics.successful_jobs_24h}/${metrics.total_jobs_24h} jobs`
                    : `${Math.round((metrics.total_jobs * metrics.success_rate) / 100)}/${metrics.total_jobs} jobs`}
                </p>
              )}
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

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search patterns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>

              {filteredPatterns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {activePatterns.length === 0
                    ? "No active patterns. Create and publish a pattern to get started."
                    : "No patterns match your search."}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredPatterns.map((pattern) => (
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

            {/* Pattern Job Stats (Last 24h) */}
            <div className="border border-border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Activity (24h)</h2>
                <Link
                  href="/logs"
                  className="text-sm text-primary hover:underline"
                >
                  View logs
                </Link>
              </div>
              {isLoadingStats ? (
                <p className="text-muted-foreground text-sm">Loading activity...</p>
              ) : patternStats.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No jobs in the last 24 hours. Upload images to your patterns to see activity.
                </p>
              ) : (
                <div className="space-y-3">
                  {patternStats.map((stat) => (
                    <Link
                      key={stat.pattern_id}
                      href={`/logs?pattern_id=${stat.pattern_id}`}
                      className="block p-4 border border-border rounded-lg hover:bg-accent transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{stat.pattern_name}</span>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded uppercase">
                              {stat.pattern_format}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {stat.successful_jobs_24h}/{stat.total_jobs_24h} successful
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-2xl font-bold ${getSuccessRateColor(
                              stat.success_rate
                            )}`}
                          >
                            {stat.success_rate}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            success rate
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        last job run: {formatTimeAgo(stat.last_job_at)} ago
                      </p>
                    </Link>
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
