"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  Webhook,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
}

export default function WebhooksPage() {
  const { session } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchWebhooks = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/webhooks", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const result = await response.json();
          setWebhooks(result.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch webhooks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebhooks();
  }, [session]);

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== webhookId));
      } else {
        alert("Failed to delete webhook");
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error);
      alert("Failed to delete webhook");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Webhooks</h2>
          <p className="text-muted-foreground">
            Receive real-time notifications when events occur
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Webhook
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium mb-1">How webhooks work</p>
            <p className="text-muted-foreground">
              Webhooks send HTTP POST requests to your endpoint when specific events occur. 
              You can subscribe to <code className="px-1 py-0.5 bg-muted rounded text-xs">job.succeeded</code> and{" "}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">job.failed</code> events.
            </p>
            <a
              href="/docs/webhooks"
              className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
            >
              View documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Webhook className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Webhooks Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first webhook to receive real-time event notifications
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="p-6 border border-border rounded-lg hover:bg-accent/50 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold break-all">{webhook.url}</h3>
                    {webhook.is_active ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                        <Power className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 rounded-full">
                        <PowerOff className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <code className="text-xs font-mono">{webhook.id}</code>
                    <button
                      onClick={() => copyToClipboard(webhook.id, webhook.id)}
                      className="hover:text-foreground"
                    >
                      {copiedId === webhook.id ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteWebhook(webhook.id)}
                  className="text-destructive hover:text-destructive/80 p-2 hover:bg-destructive/10 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Events */}
              <div className="mb-3">
                <span className="text-sm text-muted-foreground">Events: </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="text-xs px-2 py-1 bg-muted rounded font-mono"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  <span className="font-medium">{formatDate(webhook.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Last triggered:</span>{" "}
                  <span className="font-medium">{formatDate(webhook.last_triggered_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Webhook Dialog */}
      {showCreateDialog && (
        <CreateWebhookDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={(newWebhook) => {
            setWebhooks([...webhooks, newWebhook]);
            setShowCreateDialog(false);
          }}
          session={session}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE WEBHOOK DIALOG
// ============================================================================

function CreateWebhookDialog({
  onClose,
  onSuccess,
  session,
}: {
  onClose: () => void;
  onSuccess: (webhook: WebhookItem) => void;
  session: any;
}) {
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["job.succeeded", "job.failed"]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const AVAILABLE_EVENTS = [
    { value: "job.succeeded", label: "Job Succeeded", description: "Fired when a job completes successfully" },
    { value: "job.failed", label: "Job Failed", description: "Fired when a job fails" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url,
          events: selectedEvents,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess(result.data);
      } else {
        setError(result.message || "Failed to create webhook");
      }
    } catch (err) {
      setError("Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Create Webhook</h2>
          <p className="text-muted-foreground mt-1">
            Set up a new webhook endpoint to receive event notifications
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Endpoint URL <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks/imggo"
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be a valid HTTPS URL that accepts POST requests
            </p>
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Subscribe to Events <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-mono text-sm">{event.value}</div>
                    <div className="text-xs text-muted-foreground">{event.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-destructive mt-2">Select at least one event</p>
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
              disabled={isCreating || selectedEvents.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create Webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
