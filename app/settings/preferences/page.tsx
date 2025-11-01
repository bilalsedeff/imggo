"use client";

import { useState } from "react";
import {
  Palette,
  Bell,
  Globe,
  Clock,
  Info,
} from "lucide-react";

export default function PreferencesPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [notifications, setNotifications] = useState({
    jobCompleted: true,
    jobFailed: true,
    weeklyReport: false,
    productUpdates: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Preferences</h2>
        <p className="text-muted-foreground">
          Customize your ImgGo experience
        </p>
      </div>

      {/* Theme Selection */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Appearance</h3>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium mb-2">Theme</label>
          <div className="flex gap-3">
            {[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value as typeof theme)}
                className={`flex-1 px-4 py-3 border rounded-lg transition ${
                  theme === option.value
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:bg-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <Info className="w-3 h-3 inline mr-1" />
            Theme preferences will be saved in a future update
          </p>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Notifications</h3>
        </div>
        <div className="space-y-4">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex-1">
              <div className="font-medium">Job Completed</div>
              <div className="text-sm text-muted-foreground">
                Get notified when your jobs complete successfully
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifications.jobCompleted}
              onChange={(e) =>
                setNotifications({ ...notifications, jobCompleted: e.target.checked })
              }
              className="w-5 h-5 mt-1"
              disabled
            />
          </label>

          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex-1">
              <div className="font-medium">Job Failed</div>
              <div className="text-sm text-muted-foreground">
                Get notified when your jobs fail
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifications.jobFailed}
              onChange={(e) =>
                setNotifications({ ...notifications, jobFailed: e.target.checked })
              }
              className="w-5 h-5 mt-1"
              disabled
            />
          </label>

          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex-1">
              <div className="font-medium">Weekly Usage Report</div>
              <div className="text-sm text-muted-foreground">
                Receive a weekly summary of your usage and patterns
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifications.weeklyReport}
              onChange={(e) =>
                setNotifications({ ...notifications, weeklyReport: e.target.checked })
              }
              className="w-5 h-5 mt-1"
              disabled
            />
          </label>

          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex-1">
              <div className="font-medium">Product Updates</div>
              <div className="text-sm text-muted-foreground">
                Stay informed about new features and improvements
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifications.productUpdates}
              onChange={(e) =>
                setNotifications({ ...notifications, productUpdates: e.target.checked })
              }
              className="w-5 h-5 mt-1"
              disabled
            />
          </label>

          <p className="text-xs text-muted-foreground pt-2">
            <Info className="w-3 h-3 inline mr-1" />
            Notification preferences will be saved in a future update
          </p>
        </div>
      </div>

      {/* Language & Region */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Language & Region</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            >
              <option>English (US)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Additional languages coming soon
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            >
              <option>Auto-detect from system</option>
            </select>
          </div>
        </div>
      </div>

      {/* Default Settings */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Defaults</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Pattern Format
            </label>
            <select
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            >
              <option>JSON</option>
              <option>YAML</option>
              <option>XML</option>
              <option>CSV</option>
              <option>Plain Text</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Format to use when creating new patterns
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Job History Retention
            </label>
            <select
              disabled
              className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
            >
              <option>30 days</option>
              <option>60 days</option>
              <option>90 days</option>
              <option>1 year</option>
              <option>Forever</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              How long to keep job results and logs
            </p>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            <Info className="w-3 h-3 inline mr-1" />
            Default settings will be configurable in a future update
          </p>
        </div>
      </div>
    </div>
  );
}
