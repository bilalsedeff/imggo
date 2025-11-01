"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";
import {
  User,
  Key,
  CreditCard,
  Webhook,
  Settings,
  Shield,
} from "lucide-react";

interface SettingsLayoutProps {
  children: ReactNode;
}

const SETTINGS_NAV = [
  {
    label: "Account",
    href: "/settings/account",
    icon: User,
    description: "Profile and authentication",
  },
  {
    label: "API Keys",
    href: "/settings/api-keys",
    icon: Key,
    description: "Manage API credentials",
  },
  {
    label: "Usage & Billing",
    href: "/settings/billing",
    icon: CreditCard,
    description: "Plan and usage tracking",
  },
  {
    label: "Webhooks",
    href: "/settings/webhooks",
    icon: Webhook,
    description: "Event notifications",
  },
  {
    label: "Preferences",
    href: "/settings/preferences",
    icon: Settings,
    description: "Application settings",
  },
  {
    label: "Security",
    href: "/settings/security",
    icon: Shield,
    description: "Sessions and activity",
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account, API keys, billing, and preferences
            </p>
          </div>

          {/* Two-column layout: sidebar + content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar Navigation */}
            <aside className="lg:col-span-1">
              <nav className="space-y-1">
                {SETTINGS_NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg transition ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? "text-primary" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-3">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
