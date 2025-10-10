"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";
import { FileText, Trash2, Edit } from "lucide-react";

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

export default function PatternsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    // Load drafts from localStorage
    const storedDrafts = localStorage.getItem("pattern_drafts");
    if (storedDrafts) {
      setDrafts(JSON.parse(storedDrafts));
    }
  }, []);

  const handleDeleteDraft = (id: string) => {
    const updatedDrafts = drafts.filter((d) => d.id !== id);
    setDrafts(updatedDrafts);
    localStorage.setItem("pattern_drafts", JSON.stringify(updatedDrafts));
  };

  const handleLoadDraft = (draft: Draft) => {
    // Store selected draft in sessionStorage to load in Pattern Studio
    sessionStorage.setItem("loadDraft", JSON.stringify(draft));
    window.location.href = "/patterns/new";
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

          {/* Drafts Section */}
          {drafts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Drafts</h2>
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
                          onClick={() => handleLoadDraft(draft)}
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
            </div>
          )}

          {/* Published Patterns Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Published Patterns</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}
