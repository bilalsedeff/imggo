"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { User, LogOut, ChevronDown } from "lucide-react";

export function Navbar() {
  const { user, session, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isDropdownOpen]);

  const handleSignOut = async () => {
    setIsDropdownOpen(false);
    await signOut();
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between px-8">
        <Link href="/dashboard" className="text-2xl font-bold hover:opacity-80 transition">
          ImgGo
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            Dashboard
          </Link>
          <Link
            href="/patterns"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            Patterns
          </Link>
          <Link
            href="/logs"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            Logs
          </Link>

          {/* Profile Dropdown */}
          {session && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium max-w-[150px] truncate">
                  {user?.email}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user?.user_metadata?.full_name || "User"}
                    </p>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-accent transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}

          {!session && (
            <Link
              href="/auth/signin"
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
