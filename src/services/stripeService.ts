/**
 * Stripe Service - Subscription billing and payment processing
 *
 * This service manages:
 * - Checkout session creation for plan upgrades
 * - Webhook processing for subscription lifecycle events
 * - Customer billing portal access
 * - Subscription management (upgrade, downgrade, cancel)
 */

import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { getPlanByName } from "./planService";

// ============================================================================
// STRIPE CLIENT
// ============================================================================

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// ============================================================================
// TYPES
// ============================================================================

export interface CreateCheckoutSessionParams {
  userId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

/**
 * Create a Stripe checkout session for plan upgrade
 *
 * @param params - Checkout session parameters
 * @returns Checkout session ID and URL
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const { userId, planName, billingCycle, successUrl, cancelUrl } = params;

  try {
    // Get plan details
    const plan = await getPlanByName(planName);
    if (!plan) {
      throw new Error(`Plan not found: ${planName}`);
    }

    // Get Stripe price ID based on billing cycle
    const priceId =
      billingCycle === "yearly"
        ? plan.stripe_price_yearly_id
        : plan.stripe_price_monthly_id;

    if (!priceId) {
      throw new Error(
        `Stripe price ID not configured for ${planName} ${billingCycle}`
      );
    }

    // Get or create Stripe customer
    const { data: userPlan } = await supabaseServer
      .from("user_plans")
      .select("stripe_customer_id, email:profiles!inner(email)")
      .eq("user_id", userId)
      .single();

    let customerId = userPlan?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const email = (userPlan?.email as { email: string })?.email;
      const customer = await stripe.customers.create({
        email,
        metadata: {
          user_id: userId,
        },
      });

      customerId = customer.id;

      // Save customer ID to user_plans
      await supabaseServer
        .from("user_plans")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);

      logger.info("Created Stripe customer", {
        user_id: userId,
        customer_id: customerId,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        plan_name: planName,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_name: planName,
        },
      },
    });

    logger.info("Created Stripe checkout session", {
      user_id: userId,
      session_id: session.id,
      plan: planName,
      billing_cycle: billingCycle,
    });

    if (!session.url) {
      throw new Error("Checkout session URL not generated");
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    logger.error("Failed to create checkout session", {
      user_id: userId,
      plan: planName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create a billing portal session for subscription management
 *
 * @param userId - User ID
 * @param returnUrl - URL to return to after portal session
 * @returns Billing portal URL
 */
export async function createBillingPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  try {
    // Get customer ID
    const { data: userPlan } = await supabaseServer
      .from("user_plans")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (!userPlan?.stripe_customer_id) {
      throw new Error("No Stripe customer found for user");
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: userPlan.stripe_customer_id,
      return_url: returnUrl,
    });

    logger.info("Created billing portal session", {
      user_id: userId,
      customer_id: userPlan.stripe_customer_id,
    });

    return session.url;
  } catch (error) {
    logger.error("Failed to create billing portal session", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Process Stripe webhook event
 *
 * @param event - Stripe event object
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  logger.info("Processing Stripe webhook", {
    event_type: event.type,
    event_id: event.id,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.debug("Unhandled webhook event type", { type: event.type });
    }
  } catch (error) {
    logger.error("Webhook processing failed", {
      event_type: event.type,
      event_id: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle checkout.session.completed event
 * Activates subscription after successful payment
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.user_id;
  const planName = session.metadata?.plan_name;

  if (!userId || !planName) {
    logger.warn("Missing metadata in checkout session", {
      session_id: session.id,
    });
    return;
  }

  logger.info("Checkout session completed", {
    user_id: userId,
    plan: planName,
    subscription_id: session.subscription,
  });

  // Subscription will be updated via subscription.created webhook
  // This is just for logging and optional immediate actions
}

/**
 * Handle subscription created/updated event
 * Updates user's plan in database
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.user_id;
  const planName = subscription.metadata.plan_name;

  if (!userId || !planName) {
    logger.warn("Missing metadata in subscription", {
      subscription_id: subscription.id,
    });
    return;
  }

  // Get plan details
  const plan = await getPlanByName(planName);
  if (!plan) {
    logger.error("Plan not found for subscription", {
      plan_name: planName,
      subscription_id: subscription.id,
    });
    return;
  }

  // Determine billing cycle from subscription items
  const priceId = subscription.items.data[0]?.price.id;
  const billingCycle =
    priceId === plan.stripe_price_yearly_id ? "yearly" : "monthly";

  // Calculate period dates
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Update user_plans
  const { error } = await supabaseServer
    .from("user_plans")
    .update({
      plan_id: plan.id,
      billing_cycle: billingCycle,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      requests_used_current_period: 0, // Reset usage on plan change
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to update user plan after subscription update", {
      user_id: userId,
      subscription_id: subscription.id,
      error: error.message,
    });
    throw error;
  }

  logger.info("Updated user plan from subscription webhook", {
    user_id: userId,
    plan: planName,
    billing_cycle: billingCycle,
    subscription_id: subscription.id,
    status: subscription.status,
  });
}

/**
 * Handle subscription deleted event
 * Downgrades user to free plan
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata.user_id;

  if (!userId) {
    logger.warn("Missing user_id in subscription metadata", {
      subscription_id: subscription.id,
    });
    return;
  }

  // Get free plan
  const freePlan = await getPlanByName("free");
  if (!freePlan) {
    logger.error("Free plan not found");
    return;
  }

  // Downgrade to free plan
  const { error } = await supabaseServer
    .from("user_plans")
    .update({
      plan_id: freePlan.id,
      billing_cycle: null,
      stripe_subscription_id: null,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(), // 30 days from now
      requests_used_current_period: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to downgrade user to free plan", {
      user_id: userId,
      subscription_id: subscription.id,
      error: error.message,
    });
    throw error;
  }

  logger.info("Downgraded user to free plan after subscription cancellation", {
    user_id: userId,
    subscription_id: subscription.id,
  });
}

/**
 * Handle invoice.payment_succeeded event
 * Logs successful payment
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  logger.info("Invoice payment succeeded", {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_paid,
    subscription_id: invoice.subscription,
  });

  // Optional: Send email notification or update payment history
}

/**
 * Handle invoice.payment_failed event
 * Logs failed payment and potentially notifies user
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  logger.error("Invoice payment failed", {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount_due: invoice.amount_due,
    subscription_id: invoice.subscription,
  });

  // Optional: Send email notification about payment failure
  // Stripe will automatically retry failed payments
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify Stripe webhook signature
 *
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header
 * @returns Verified Stripe event
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    logger.error("Webhook signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Invalid webhook signature");
  }
}
