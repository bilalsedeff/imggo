"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  Shield,
  Monitor,
  Activity,
  Clock,
  MapPin,
  Info,
  Key,
} from "lucide-react";

interface ActivityLog {
  id: string;
  event_type: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
}

export default function SecurityPage() {
  const { session } = useAuth();
  const [activityLogs] = useState<ActivityLog[]>([]);
  const [isLoading] = useState(false);

  useEffect(() => {
    // Fetch activity logs when API is ready
    // For now, show placeholder
  }, [session]);

  const formatTimeAgo = (timestamp: string) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Security</h2>
        <p className="text-muted-foreground">
          Manage your account security and monitor activity
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
          </div>
          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Add an extra layer of security to your account by requiring a verification code in addition to your password.
        </p>
        <button
          disabled
          className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enable 2FA
        </button>
      </div>

      {/* Active Sessions */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Active Sessions</h3>
        </div>
        <div className="space-y-3">
          <div className="p-4 border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-medium">Current Session</div>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 rounded-full">
                    Active Now
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span>IP: Unknown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Last active: Just now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border border-border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              <Info className="w-4 h-4 inline mr-1" />
              Session management will be available in a future update
            </p>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Recent Activity</h3>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
        ) : activityLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Your recent security activity will appear here
            </p>
            <p className="text-sm text-muted-foreground">
              <Info className="w-4 h-4 inline mr-1" />
              Activity logging will be available in a future update
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activityLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium mb-1">{log.event_type}</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        <span>IP: {log.ip_address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Recommendations */}
      <div className="border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Security Best Practices
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Use a strong, unique password for your account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Enable two-factor authentication when available</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Rotate your API keys periodically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Review your active sessions regularly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Never share your API keys or password</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
