"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Calendar,
  AlertTriangle,
  Check,
  Loader2,
  Trash2,
  Lock,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  avatar_url?: string;
}

export default function AccountPage() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data.data);
          setFullName(data.data.full_name || "");
        } else {
          setErrorMessage("Failed to load profile");
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        setErrorMessage("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: fullName }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.data);
        setSuccessMessage("Profile updated successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const error = await response.json();
        setErrorMessage(error.error?.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      setErrorMessage("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!session?.access_token) return;
    if (deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        // Sign out and redirect to home
        await signOut();
        router.push("/?deleted=true");
      } else {
        const error = await response.json();
        setErrorMessage(error.error?.message || "Failed to delete account");
      }
    } catch (error) {
      console.error("Failed to delete account:", error);
      setErrorMessage("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 border border-border rounded-lg">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="p-4 border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20 rounded-lg flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-900 dark:text-green-100">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-900 dark:text-red-100">{errorMessage}</p>
        </div>
      )}

      {/* Profile Information */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          {/* Account Created */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Member Since
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={formatDate(profile.created_at)}
                disabled
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Password</h2>
            <p className="text-sm text-muted-foreground">
              Change your password or reset it if you've forgotten
            </p>
          </div>
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <button
          disabled
          className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm">Change Password</span>
          <span className="ml-2 text-xs text-muted-foreground">(Coming soon)</span>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900 rounded-lg p-6 bg-red-50/30 dark:bg-red-950/10">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
              Danger Zone
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300">
              Once you delete your account, there is no going back. All your patterns, jobs, and data will be permanently deleted.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-bold text-red-900 dark:text-red-100">
                    Delete Account
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm">
                Are you absolutely sure? This will permanently delete:
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Your account and profile</li>
                <li>All your patterns and templates</li>
                <li>All job history and results</li>
                <li>All API keys and webhooks</li>
                <li>All billing information</li>
              </ul>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText("");
                }}
                disabled={isDeleting}
                className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
