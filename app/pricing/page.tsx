"use client";

import { useState, useEffect } from "react";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/providers/auth-provider";
import { Check, X, Zap, Building2, Rocket, Star, Mail, Crown } from "lucide-react";

type BillingCycle = "monthly" | "yearly";

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Zap,
    description: "Perfect for testing and small hobby projects",
    monthly: 0,
    yearly: 0,
    highlight: false,
    features: {
      requests: "50 requests/month",
      burstLimit: "1 req/min",
      imageSize: "2 MB",
      characters: "Up to 1,000 character pattern schema",
      apiKeys: "2 API keys",
      patterns: "5 patterns",
      webhooks: "3 webhooks",
      support: "Community",
    },
  },
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    description: "For small projects and indie developers",
    monthly: 29,
    yearly: 290,
    highlight: false,
    features: {
      requests: "500 requests/month",
      burstLimit: "10 req/min",
      imageSize: "5 MB",
      characters: "Up to 2,500 character pattern schema",
      apiKeys: "Unlimited API keys",
      patterns: "25 patterns",
      webhooks: "10 webhooks",
      support: "Email (48hr)",
    },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Star,
    description: "Most popular choice for growing teams",
    monthly: 99,
    yearly: 990,
    highlight: true,
    features: {
      requests: "3,000 requests/month",
      burstLimit: "No limits",
      imageSize: "10 MB",
      characters: "Up to 5,000 character pattern schema",
      apiKeys: "Unlimited API keys",
      patterns: "100 patterns",
      webhooks: "25 webhooks",
      support: "Priority (24hr)",
    },
  },
  {
    id: "business",
    name: "Business",
    icon: Building2,
    description: "For high-volume production workloads",
    monthly: 299,
    yearly: 2990,
    highlight: false,
    features: {
      requests: "15,000 requests/month",
      burstLimit: "No limits",
      imageSize: "20 MB",
      characters: "Up to 10,000 character pattern schema",
      apiKeys: "Unlimited API keys",
      patterns: "Unlimited",
      webhooks: "Unlimited",
      support: "Priority (12hr)",
    },
  },
];

const FEATURE_CATEGORIES = [
  {
    name: "Usage",
    features: [
      { key: "requests", label: "Monthly Requests" },
      { key: "burstLimit", label: "Burst Rate Limit" },
    ],
  },
  {
    name: "Limits",
    features: [
      { key: "imageSize", label: "Max Image Size" },
      { key: "characters", label: "Max Characters per Request" },
    ],
  },
  {
    name: "Resources",
    features: [
      { key: "apiKeys", label: "API Keys" },
      { key: "patterns", label: "Patterns" },
      { key: "webhooks", label: "Webhooks" },
    ],
  },
  {
    name: "Support",
    features: [
      { key: "support", label: "Support" },
    ],
  },
];

interface UserPlanResponse {
  plan: {
    name: string;
    displayName: string;
  };
}

export default function PricingPage() {
  const { session } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [userPlan, setUserPlan] = useState<UserPlanResponse | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

  // Fetch user's current plan
  useEffect(() => {
    if (!session?.access_token) {
      setUserPlan(null);
      return;
    }

    const fetchUserPlan = async () => {
      setIsLoadingPlan(true);
      try {
        const response = await fetch("/api/user/usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUserPlan({
            plan: {
              name: data.plan.name,
              displayName: data.plan.displayName,
            },
          });
        }
      } catch (error) {
        console.error("Failed to fetch user plan:", error);
      } finally {
        setIsLoadingPlan(false);
      }
    };

    fetchUserPlan();
  }, [session]);

  // Helper to determine if a plan is the user's current plan
  const isCurrentPlan = (planId: string): boolean => {
    if (!userPlan || !session) return false;
    return userPlan.plan.name === planId;
  };

  // Helper to determine button text based on user's current plan
  const getButtonText = (planId: string): string => {
    if (!session) return planId === "free" ? "Start Free" : "Get Started";

    // Only show loading while actually loading
    if (isLoadingPlan) return "Loading...";

    // If we have a user plan, determine button text
    if (userPlan) {
      if (isCurrentPlan(planId)) return "Current Plan";

      // Define plan hierarchy
      const planOrder: Record<string, number> = {
        free: 0,
        starter: 1,
        pro: 2,
        business: 3,
        enterprise: 4,
      };

      const currentOrder = planOrder[userPlan.plan.name] ?? 0;
      const targetOrder = planOrder[planId] ?? 0;

      // If user is on Free plan, show "Get Started" for all paid plans
      if (userPlan.plan.name === "free") {
        return planId === "free" ? "Current Plan" : "Get Started";
      }

      // For paid plans: show Upgrade/Downgrade
      if (targetOrder > currentOrder) return "Upgrade";
      if (targetOrder < currentOrder) return "Downgrade";
    }

    // Fallback: if no plan data, show generic text
    return planId === "free" ? "Start Free" : "Get Started";
  };

  const getPrice = (plan: typeof PLANS[0]) => {
    if (plan.monthly === 0) return "Free";

    const price = billingCycle === "monthly" ? plan.monthly : plan.yearly / 12;
    return `$${Math.floor(price)}`;
  };

  const getSavings = (plan: typeof PLANS[0]) => {
    if (billingCycle === "monthly" || plan.monthly === 0) return null;
    const monthlyCost = plan.monthly * 12;
    const yearlyCost = plan.yearly;
    const savings = monthlyCost - yearlyCost;
    const savingsPercent = Math.round((savings / monthlyCost) * 100);
    return `Save ${savingsPercent}%`;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-8">
          <Link href="/" className="flex items-center -ml-6">
            <Image
              src="/logo.svg"
              alt="ImgGo"
              width={280}
              height={140}
              className="h-16 w-auto"
            />
          </Link>
          <Link
            href={session ? "/dashboard" : "/auth/signin"}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition"
          >
            {session ? "Dashboard" : "Sign In"}
          </Link>
        </div>
      </header>

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span
                className={`text-sm ${
                  billingCycle === "monthly" ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 bg-muted"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-primary transition-transform ${
                    billingCycle === "yearly" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm ${
                  billingCycle === "yearly" ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                Yearly
                <span className="ml-1 text-xs text-green-600 font-medium">Save 17%</span>
              </span>
            </div>
          </div>

          {/* Plan Cards (4 standard plans) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const price = getPrice(plan);
              const savings = getSavings(plan);

              const isCurrent = isCurrentPlan(plan.id);
              const buttonText = getButtonText(plan.id);

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-lg p-6 flex flex-col ${
                    isCurrent
                      ? "border-2 border-primary bg-primary/5"
                      : plan.highlight
                      ? "border border-primary bg-primary/5"
                      : "border border-border"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{price}</span>
                      {plan.monthly !== 0 && (
                        <span className="text-sm text-muted-foreground">/month</span>
                      )}
                    </div>
                    {savings && (
                      <p className="text-xs text-green-600 font-medium mt-1">{savings}</p>
                    )}
                    {billingCycle === "yearly" && plan.yearly !== 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ${plan.yearly} billed annually
                      </p>
                    )}
                  </div>

                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full px-4 py-2 text-sm font-medium rounded-lg transition text-center bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    >
                      {buttonText}
                    </button>
                  ) : (
                    <Link
                      href={
                        session
                          ? "/settings/billing"
                          : "/auth/signin"
                      }
                      className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition text-center ${
                        plan.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-border hover:bg-accent"
                      }`}
                    >
                      {buttonText}
                    </Link>
                  )}

                  <div className="mt-6 space-y-2 flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-3">
                      Key Features:
                    </div>
                    <div className="space-y-2">
                      {Object.entries(plan.features).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">
                            {typeof value === "string" ? value : value ? "Included" : "Not included"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise Section (compact one-line) */}
          <div className="mb-16 border border-border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Enterprise</h3>
                  <p className="text-sm text-muted-foreground">
                    Custom solutions for large organizations. Dedicated support, custom SLAs, white-label, and on-premise options.
                  </p>
                </div>
              </div>
              <Link
                href="mailto:contact@imggo.com?subject=Enterprise Inquiry"
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium whitespace-nowrap text-sm"
              >
                <Mail className="w-4 h-4" />
                Contact Sales
              </Link>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">Full Feature Comparison</h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-4 font-semibold">Feature</th>
                      {PLANS.map((plan) => (
                        <th key={plan.id} className="text-center p-4 font-semibold min-w-[120px]">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_CATEGORIES.map((category) => (
                      <React.Fragment key={category.name}>
                        <tr className="border-b border-border bg-muted/10">
                          <td colSpan={5} className="p-3 text-sm font-semibold">
                            {category.name}
                          </td>
                        </tr>
                        {category.features.map((feature) => (
                          <tr
                            key={feature.key}
                            className="border-b border-border"
                          >
                            <td className="p-4 text-sm text-muted-foreground">{feature.label}</td>
                            {PLANS.map((plan) => {
                              const value = plan.features[feature.key as keyof typeof plan.features];
                              return (
                                <td key={plan.id} className="p-4 text-center">
                                  {typeof value === "boolean" ? (
                                    value ? (
                                      <Check className="w-5 h-5 text-green-600 mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                                    )
                                  ) : (
                                    <span className="text-sm">{value}</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: "Can I change plans anytime?",
                  a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing accordingly.",
                },
                {
                  q: "What happens if I exceed my monthly request limit?",
                  a: "If you exceed your monthly limit, API requests will return a 429 rate limit error. You can upgrade your plan to increase your limit, or wait until your billing period resets.",
                },
                {
                  q: "Do you offer refunds?",
                  a: "We offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact us for a full refund.",
                },
                {
                  q: "What payment methods do you accept?",
                  a: "We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Enterprise plans can be invoiced annually.",
                },
                {
                  q: "What does 'characters per request' mean?",
                  a: "This is the maximum size for both your pattern templates (instructions + schema) in Pattern Studio and the AI-generated outputs. This ensures optimal performance and quality.",
                },
              ].map((faq, idx) => (
                <div key={idx} className="border border-border rounded-lg p-6">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center border border-border rounded-lg p-12 bg-muted/30">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start with our free plan. No credit card required.
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Start Free Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
