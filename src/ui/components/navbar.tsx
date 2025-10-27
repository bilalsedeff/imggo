"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/providers/auth-provider";
import { User, LogOut, ChevronDown, Moon, Sun, Key } from "lucide-react";

export function Navbar() {
  const { user, session, signOut } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
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
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-8">
        <Link href="/dashboard" className="flex items-center hover:opacity-80 transition -ml-6">
          <Image 
            src={theme === "dark" ? "/white/logo.svg" : "/logo.svg"}
            alt="ImgGo" 
            width={280} 
            height={140}
            className="h-16 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition px-3 py-1.5 rounded-md ${
              pathname === "/dashboard"
                ? "text-foreground bg-accent/50 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/patterns"
            className={`text-sm font-medium transition px-3 py-1.5 rounded-md ${
              pathname?.startsWith("/patterns")
                ? "text-foreground bg-accent/50 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Patterns
          </Link>
          <Link
            href="/logs"
            className={`text-sm font-medium transition px-3 py-1.5 rounded-md ${
              pathname === "/logs"
                ? "text-foreground bg-accent/50 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
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

                  <Link
                    href="/settings/api-keys"
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition"
                  >
                    <Key className="w-4 h-4" />
                    <span>API Keys</span>
                  </Link>

                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-accent transition"
                  >
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? (
                        <Sun className="w-4 h-4" />
                      ) : (
                        <Moon className="w-4 h-4" />
                      )}
                      <span>
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                      </span>
                    </div>
                  </button>

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
