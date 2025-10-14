"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";
import { FileText, Trash2, Edit, ExternalLink, Copy, CheckCircle, Power } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

interface Draft {
  id: string;
  name: string;
  format: string;
  instructions: string;
  json_schema: string | null;
  template: string | null;
  created_at: string;
  user_id?: string;
}

interface Pattern {
  id: string;
  name: string;
  format: string;
  instructions: string;
  is_active: boolean;
  version: number;
  created_at: string;
  endpoint_url: string;
}

export default function PatternsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"published" | "drafts">("published");
  const [drafts, setDrafts] = useState<Pattern[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch published patterns from API
  useEffect(() => {
    if (!session?.access_token) return;

    const fetchPatterns = async () => {
      setIsLoadingPatterns(true);
      try {
        const response = await fetch("/api/patterns?is_active=true", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          // API returns {success: true, data: {data: [...], pagination: {...}}}
          const allPatterns = result.data?.data || [];
          // Filter: published patterns have version >= 1
          setPatterns(allPatterns.filter((p: Pattern) => p.version >= 1));
        }
      } catch (err) {
        console.error("Failed to fetch patterns:", err);
      } finally {
        setIsLoadingPatterns(false);
      }
    };

    fetchPatterns();
  }, [session]);

  // Fetch drafts from database (version = 0)
  useEffect(() => {
    if (!session?.access_token) return;

    const fetchDrafts = async () => {
      setIsLoadingDrafts(true);
      try {
        const response = await fetch("/api/patterns?is_active=false", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          const allInactive = result.data?.data || [];
          // Filter: drafts have version = 0
          setDrafts(allInactive.filter((p: Pattern) => p.version === 0));
        }
      } catch (err) {
        console.error("Failed to fetch drafts:", err);
      } finally {
        setIsLoadingDrafts(false);
      }
    };

    fetchDrafts();
  }, [session]);

  const handleDeleteDraft = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      const response = await fetch(`/api/patterns/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        // Remove from local state
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      } else {
        console.error("Failed to delete draft");
      }
    } catch (err) {
      console.error("Error deleting draft:", err);
    }
  };

  const handleToggleActive = async (patternId: string, currentStatus: boolean) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/patterns/${patternId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (response.ok) {
        // Update local state
        setPatterns((prev) =>
          prev.map((p) =>
            p.id === patternId ? { ...p, is_active: !currentStatus } : p
          )
        );
      } else {
        console.error("Failed to toggle pattern status");
      }
    } catch (err) {
      console.error("Error toggling pattern status:", err);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to delete this pattern?")) return;

    try {
      const response = await fetch(`/api/patterns/${patternId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        // Remove from local state
        setPatterns((prev) => prev.filter((p) => p.id !== patternId));
      } else {
        console.error("Failed to delete pattern");
      }
    } catch (err) {
      console.error("Error deleting pattern:", err);
    }
  };

  const handleLoadDraft = async (draftId: string) => {
    if (!session?.access_token) return;

    // Simply navigate to Pattern Studio with draft pattern_id
    // Pattern Studio will load it via the URL parameter useEffect
    window.location.href = `/patterns/new?pattern_id=${draftId}`;
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Patterns</h1>
              <p className="text-muted-foreground">
                Manage your image analysis patterns and drafts
              </p>
            </div>
            <Link
              href="/patterns/new"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              New Pattern
            </Link>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-border">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("published")}
                className={`pb-3 px-1 border-b-2 transition ${
                  activeTab === "published"
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Published Patterns
                {patterns.length > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded">
                    {patterns.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("drafts")}
                className={`pb-3 px-1 border-b-2 transition ${
                  activeTab === "drafts"
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Draft Patterns
                {drafts.length > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded">
                    {drafts.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Published Patterns Tab Content */}
          {activeTab === "published" && (
            <div className="min-h-[400px] overflow-y-scroll">
              {isLoadingPatterns ? (
                <div className="border border-border rounded-lg p-6">
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading patterns...</p>
                  </div>
                </div>
              ) : patterns.length === 0 ? (
                <div className="border border-border rounded-lg p-6">
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      No patterns published yet
                    </p>
                    <Link
                      href="/patterns/new"
                      className="text-primary hover:underline"
                    >
                      Create your first pattern →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="border border-border rounded-lg p-4 hover:bg-accent/50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-medium">{pattern.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded uppercase">
                              {pattern.format}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-muted/50 rounded text-muted-foreground">
                              v{pattern.version}
                            </span>
                            {pattern.is_active && (
                              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {pattern.instructions}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">
                              Endpoint:
                            </span>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                              {pattern.endpoint_url}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(pattern.endpoint_url);
                                setCopiedUrl(pattern.id);
                                setTimeout(() => setCopiedUrl(null), 2000);
                              }}
                              className="p-1.5 hover:bg-accent rounded transition"
                              title="Copy endpoint URL"
                            >
                              {copiedUrl === pattern.id ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(pattern.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/patterns/${pattern.id}`}
                            className="p-2 hover:bg-accent rounded-lg transition"
                            title="View details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleToggleActive(pattern.id, pattern.is_active)}
                            className={`p-2 rounded-lg transition ${
                              pattern.is_active
                                ? "hover:bg-yellow-500/10 hover:text-yellow-600 text-green-600"
                                : "hover:bg-green-500/10 hover:text-green-600 text-muted-foreground"
                            }`}
                            title={pattern.is_active ? "Deactivate pattern" : "Activate pattern"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(pattern.id)}
                            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition"
                            title="Delete pattern"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Draft Patterns Tab Content */}
          {activeTab === "drafts" && (
            <div className="min-h-[400px] overflow-y-scroll">
              {isLoadingDrafts ? (
                <div className="border border-border rounded-lg p-6">
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading drafts...</p>
                  </div>
                </div>
              ) : drafts.length === 0 ? (
                <div className="border border-border rounded-lg p-6">
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      No draft patterns
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="border border-border rounded-lg p-4 hover:bg-accent/50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-medium">{draft.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded uppercase">
                              {draft.format}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-600 rounded">
                              Draft
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {draft.instructions}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Saved {new Date(draft.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLoadDraft(draft.id)}
                            className="p-2 hover:bg-accent rounded-lg transition"
                            title="Continue editing"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDraft(draft.id)}
                            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition"
                            title="Delete draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
