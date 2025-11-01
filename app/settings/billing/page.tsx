"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import {
  CreditCard,
  Zap,
  TrendingUp,
  Calendar,
  AlertCircle,
  Check,
  ExternalLink,
  Crown,
  Rocket,
  Star,
  Building2,
} from "lucide-react";

interface UserPlan {
  plan: {
    id: string;
    name: string;
    display_name: string;
    description: string;
    price_monthly_cents: number;
    price_yearly_cents: number | null;
    requests_per_month: number;
    burst_rate_limit_seconds: number | null;
    max_image_size_mb: number;
    max_characters_per_request: number;
    max_api_keys: number;
    max_patterns: number;
    max_webhooks: number;
    is_highlighted: boolean;
  };
  billing_cycle: "monthly" | "yearly" | null;
  current_period_start: string;
  current_period_end: string;
  requests_used_current_period: number;
  requests_remaining: number; // -1 = unlimited
  usage_percent: number; // 0-100
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const PLAN_ICONS = {
  free: Zap,
  starter: Rocket,
  pro: Star,
  business: Building2,
  enterprise: Crown,
};

export default function BillingPage() {
  const { session } = useAuth();
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchUsage = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/user/usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();

          // Transform API response to match UserPlan interface
          const transformedData: UserPlan = {
            plan: {
              id: data.plan.id,
              name: data.plan.name,
              display_name: data.plan.displayName,
              description: "",
              price_monthly_cents: 0, // Will be fetched from plans table if needed
              price_yearly_cents: null,
              requests_per_month: typeof data.usage.requests.limit === "string"
                ? -1
                : data.usage.requests.limit,
              burst_rate_limit_seconds: data.usage.burstLimit?.seconds || null,
              max_image_size_mb: parseInt(data.limits.maxImageSize),
              max_characters_per_request: parseInt(data.limits.maxCharactersPerRequest.replace(/,/g, "")),
              max_api_keys: typeof data.limits.maxApiKeys === "string"
                ? -1
                : data.limits.maxApiKeys,
              max_patterns: typeof data.limits.maxPatterns === "string"
                ? -1
                : data.limits.maxPatterns,
              max_webhooks: typeof data.limits.maxWebhooks === "string"
                ? -1
                : data.limits.maxWebhooks,
              is_highlighted: false,
            },
            billing_cycle: data.plan.billingCycle,
            current_period_start: data.period.start,
            current_period_end: data.period.end,
            requests_used_current_period: data.usage.requests.used,
            requests_remaining: typeof data.usage.requests.remaining === "string"
              ? -1
              : data.usage.requests.remaining,
            usage_percent: data.usage.requests.percentUsed,
            stripe_customer_id: data.subscription.stripeCustomerId,
            stripe_subscription_id: data.subscription.stripeSubscriptionId,
          };

          setUserPlan(transformedData);
        }
      } catch (error) {
        console.error("Failed to fetch usage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsage();
  }, [session]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "text-red-600";
    if (percent >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  const getUsageBarColor = (percent: number) => {
    if (percent >= 90) return "bg-red-600";
    if (percent >= 70) return "bg-yellow-600";
    return "bg-green-600";
  };

  const PlanIcon = userPlan?.plan.name
    ? PLAN_ICONS[userPlan.plan.name as keyof typeof PLAN_ICONS] || Crown
    : Crown;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading billing information...</p>
        </div>
      ) : !userPlan ? (
        <div className="text-center py-12 border border-border rounded-lg">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Failed to load billing information</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Plan Card */}
          <div className="border border-border rounded-lg p-6 bg-muted/30">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <PlanIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold capitalize">{userPlan.plan.display_name}</h2>
                      <p className="text-sm text-muted-foreground">Current plan</p>
                    </div>
                  </div>
                  {userPlan.plan.name !== "free" && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {userPlan.billing_cycle === "yearly" ? "Yearly" : "Monthly"} billing
                      </p>
                    </div>
                  )}
                </div>

                {/* Billing Period */}
                {userPlan.plan.name === "free" ? (
                  <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium mb-1">
                          You're on the Free plan
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to unlock more requests, remove burst limits, and access premium features.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-4 border border-border rounded-lg bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Current Billing Period</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(userPlan.current_period_start)} – {formatDate(userPlan.current_period_end)}
                    </p>
                  </div>
                )}

                {/* Usage Stats */}
                <div className="space-y-4">
                  {/* Requests Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">API Requests</span>
                      </div>
                      <span className={`text-sm font-semibold ${getUsageColor(userPlan.usage_percent)}`}>
                        {userPlan.requests_used_current_period}/{userPlan.plan.requests_per_month === -1
                          ? "∞"
                          : userPlan.plan.requests_per_month.toLocaleString()}
                      </span>
                    </div>
                    {userPlan.plan.requests_per_month !== -1 && (
                      <>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getUsageBarColor(userPlan.usage_percent)} transition-all`}
                            style={{ width: `${Math.min(userPlan.usage_percent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {userPlan.usage_percent.toFixed(0)}% used
                          {userPlan.usage_percent >= 70 && userPlan.usage_percent < 90 && (
                            <span className="ml-2 text-yellow-600 font-medium">
                              Approaching limit
                            </span>
                          )}
                          {userPlan.usage_percent >= 90 && (
                            <span className="ml-2 text-red-600 font-medium">
                              Almost full!
                            </span>
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Burst Limit Warning (Free plan only) */}
                  {userPlan.plan.burst_rate_limit_seconds && (
                    <div className="p-3 border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-medium text-yellow-900 dark:text-yellow-100">
                            Burst rate limit active
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300 mt-0.5">
                            Limited to 1 request per {userPlan.plan.burst_rate_limit_seconds} seconds. Upgrade to remove this limit.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resource Limits */}
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">API Keys</p>
                      <p className="text-lg font-semibold">
                        {userPlan.plan.max_api_keys === -1 ? "∞" : userPlan.plan.max_api_keys}
                      </p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Patterns</p>
                      <p className="text-lg font-semibold">
                        {userPlan.plan.max_patterns === -1 ? "∞" : userPlan.plan.max_patterns}
                      </p>
                    </div>
                    <div className="text-center p-3 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Webhooks</p>
                      <p className="text-lg font-semibold">
                        {userPlan.plan.max_webhooks === -1 ? "∞" : userPlan.plan.max_webhooks}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrade CTA (Free plan only) */}
              {userPlan.plan.name === "free" && (
                <div className="border border-primary rounded-lg p-6 bg-primary/5">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        Unlock More with a Paid Plan
                      </h3>
                      <ul className="space-y-2 mb-4">
                        {[
                          "10x–1000x more monthly requests",
                          "Remove 1 req/min burst limit",
                          "Larger image sizes (up to 100MB)",
                          "More API keys, patterns, and webhooks",
                          "Priority support & SLA",
                        ].map((benefit, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link
                      href="/pricing"
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium whitespace-nowrap flex items-center gap-2"
                    >
                      View Plans
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Manage Subscription (Paid plans) */}
              {userPlan.plan.name !== "free" && (
                <div className="border border-border rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Manage Subscription</h3>
                  </div>

                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Change Plan</span>
                        <span className="text-xs text-muted-foreground">Coming soon</span>
                      </div>
                    </button>

                    <button
                      disabled
                      className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Update Payment Method</span>
                        <span className="text-xs text-muted-foreground">Coming soon</span>
                      </div>
                    </button>

                    <button
                      disabled
                      className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">View Billing History</span>
                        <span className="text-xs text-muted-foreground">Coming soon</span>
                      </div>
                    </button>

                    <p className="text-xs text-muted-foreground pt-2">
                      Stripe integration coming soon. Payment management will be available here.
                    </p>
                  </div>
                </div>
              )}

              {/* Need Help */}
              <div className="border border-border rounded-lg p-6 bg-muted/20">
                <h3 className="font-semibold mb-2">Need help with billing?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Our support team is here to assist you with any billing questions or concerns.
                </p>
                <Link
                  href="mailto:billing@imggo.com"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  Contact Billing Support
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
    </div>
  );
}
