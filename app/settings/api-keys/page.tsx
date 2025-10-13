"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/ui/components/navbar";
import { useAuth } from "@/providers/auth-provider";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  environment: "test" | "live";
  scopes: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  created_at: string;
}

interface PlanLimits {
  plan_name: string;
  rate_limit: {
    requests: number;
    window_seconds: number;
  };
  limits: {
    max_api_keys: number;
    max_patterns: number;
    max_webhooks: number;
  };
}

// ============================================================================
// AVAILABLE SCOPES
// ============================================================================

const AVAILABLE_SCOPES = [
  { value: "patterns:read", label: "View patterns", default: true, active: true },
  { value: "patterns:write", label: "Create and update patterns", default: false, active: false },
  { value: "patterns:ingest", label: "Submit images for processing", default: true, active: true },
  { value: "patterns:delete", label: "Delete patterns", default: false, active: false },
  { value: "jobs:read", label: "View job status and results", default: true, active: true },
  { value: "webhooks:read", label: "View webhooks", default: false, active: false },
  { value: "webhooks:write", label: "Create and update webhooks", default: false, active: false },
  { value: "webhooks:delete", label: "Delete webhooks", default: false, active: false },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ApiKeysPage() {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Fetch API keys and plan limits
  useEffect(() => {
    if (!session?.access_token) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [keysRes, planRes] = await Promise.all([
          fetch("/api/api-keys", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/user/plan", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        if (keysRes.ok) {
          const result = await keysRes.json();
          setApiKeys(result.data || []);
        }

        if (planRes.ok) {
          const result = await planRes.json();
          setPlanLimits(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const handleRevokeKey = async (keyId: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== keyId));
      } else {
        alert("Failed to revoke API key");
      }
    } catch (error) {
      console.error("Failed to revoke key:", error);
      alert("Failed to revoke API key");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const canCreateMoreKeys = planLimits && apiKeys.length < planLimits.limits.max_api_keys;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">API Keys</h1>
              <p className="text-muted-foreground">
                Manage your API keys for programmatic access to ImgGo
              </p>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              disabled={!canCreateMoreKeys}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create API Key
            </button>
          </div>

          {/* Plan Limits Info */}
          {planLimits && (
            <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 capitalize">
                    {planLimits.plan_name} Plan
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">API Keys:</span>{" "}
                      <span className="font-medium">
                        {apiKeys.length}/{planLimits.limits.max_api_keys}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rate Limit:</span>{" "}
                      <span className="font-medium">
                        {planLimits.rate_limit.requests} requests per{" "}
                        {planLimits.rate_limit.window_seconds / 60} minutes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No API Keys Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first API key to start using ImgGo programmatically
              </p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
              >
                Create API Key
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-6 border border-border rounded-lg hover:bg-accent/50 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{key.name}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            key.environment === "live"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {key.environment.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code className="px-2 py-1 bg-muted rounded font-mono">
                          {key.key_prefix}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.key_prefix, key.id)}
                          className="hover:text-foreground"
                        >
                          {copiedKeyId === key.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-destructive hover:text-destructive/80 p-2 hover:bg-destructive/10 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">Last used:</span>{" "}
                      <span className="font-medium">{formatTimeAgo(key.last_used_at)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span className="font-medium">
                        {new Date(key.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Scopes: </span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-1 bg-muted rounded font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create API Key Dialog */}
      {showCreateDialog && (
        <CreateApiKeyDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={(key) => {
            setCreatedKey(key);
            setShowKeyModal(true);
            setShowCreateDialog(false);
            // Refresh list
            if (session?.access_token) {
              fetch("/api/api-keys", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              }).then(async (res) => {
                if (res.ok) {
                  const result = await res.json();
                  setApiKeys(result.data || []);
                }
              });
            }
          }}
          session={session}
        />
      )}

      {/* Show Key Once Modal */}
      {showKeyModal && createdKey && (
        <ShowKeyModal
          apiKey={createdKey}
          onClose={() => {
            setShowKeyModal(false);
            setCreatedKey(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE API KEY DIALOG
// ============================================================================

function CreateApiKeyDialog({
  onClose,
  onSuccess,
  session,
}: {
  onClose: () => void;
  onSuccess: (key: string) => void;
  session: any;
}) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(
    AVAILABLE_SCOPES.filter((s) => s.default).map((s) => s.value)
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          environment,
          scopes: selectedScopes,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess(result.data.key);
      } else {
        setError(result.message || "Failed to create API key");
      }
    } catch (err) {
      setError("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Create API Key</h2>
          <p className="text-muted-foreground mt-1">
            Generate a new API key for programmatic access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production API, Test Integration"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          {/* Environment */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Environment <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="test"
                  checked={environment === "test"}
                  onChange={(e) => setEnvironment("test")}
                  className="w-4 h-4"
                />
                <span>Test (Development)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="live"
                  checked={environment === "live"}
                  onChange={(e) => setEnvironment("live")}
                  className="w-4 h-4"
                />
                <span>Live (Production)</span>
              </label>
            </div>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Permissions (Scopes) <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className={`flex items-start gap-3 p-3 border border-border rounded-lg transition ${
                    scope.active
                      ? "hover:bg-accent/50 cursor-pointer"
                      : "opacity-60 cursor-not-allowed bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => scope.active && toggleScope(scope.value)}
                    disabled={!scope.active}
                    className="w-4 h-4 mt-0.5 disabled:cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{scope.value}</span>
                      {!scope.active && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{scope.label}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedScopes.length === 0 && (
              <p className="text-sm text-destructive mt-2">
                Select at least one permission
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || selectedScopes.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create API Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SHOW KEY MODAL (Show Once!)
// ============================================================================

function ShowKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
            <div>
              <h2 className="text-2xl font-bold">Save Your API Key</h2>
              <p className="text-muted-foreground mt-1">
                This is the only time you'll see this key. Save it somewhere secure!
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your API Key:</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 border border-border rounded-lg bg-muted font-mono text-sm break-all">
                {showKey ? apiKey : "•".repeat(apiKey.length)}
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-2 border border-border rounded-lg hover:bg-accent transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={copyKey}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">Important:</h4>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>Store this key in a secure location (e.g., password manager)</li>
              <li>Never commit it to version control</li>
              <li>If compromised, revoke it immediately</li>
              <li>You won't be able to see this key again</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            I've Saved My Key
          </button>
        </div>
      </div>
    </div>
  );
}
