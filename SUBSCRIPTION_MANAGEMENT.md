# Subscription Management - Upgrade/Downgrade Logic

## Overview
This document defines the payment and timing logic for subscription upgrades and downgrades.

## Default Plan
- **New users** are automatically assigned the **Free** plan upon registration
- Free plan has no payment information required

## Button Display Rules

### For Non-Authenticated Users
- Free plan: "Start Free"
- All paid plans: "Get Started"

### For Free Plan Users (Authenticated)
- Free plan: "Current Plan" (grey, disabled)
- All paid plans: "Get Started"

### For Paid Plan Users
- Current plan: "Current Plan" (grey, disabled)
- Lower tier plans: "Downgrade"
- Higher tier plans: "Upgrade"

## Upgrade Logic

### When User Clicks "Upgrade"
1. **Immediate Effect**: Plan change takes effect immediately
2. **Prorated Charge**: Calculate and charge the difference

#### Calculation Formula
```javascript
const daysRemainingInPeriod = calculateDaysRemaining(currentPeriodEnd);
const totalDaysInPeriod = calculateTotalDays(currentPeriodStart, currentPeriodEnd);

// Current plan prorated remaining value
const currentPlanDailyRate = currentPlanPrice / totalDaysInPeriod;
const unusedCurrentPlanValue = currentPlanDailyRate * daysRemainingInPeriod;

// New plan prorated value for remaining period
const newPlanDailyRate = newPlanPrice / totalDaysInPeriod;
const newPlanValueForRemaining = newPlanDailyRate * daysRemainingInPeriod;

// Charge difference immediately
const upgradeCharge = newPlanValueForRemaining - unusedCurrentPlanValue;
```

#### Example
- User is on **Starter ($29/month)**, 15 days remaining in 30-day period
- Upgrades to **Pro ($99/month)**
- Current plan unused value: $29/30 * 15 = $14.50
- New plan for remaining 15 days: $99/30 * 15 = $49.50
- **Charge immediately**: $49.50 - $14.50 = **$35.00**

### Implementation Steps
1. Calculate prorated charge
2. Process Stripe payment for the difference
3. Update `user_plans` table:
   - Set `plan_id` to new plan
   - Keep `current_period_end` unchanged
   - Update `stripe_subscription_id` if needed
4. Update limits immediately (user can use new plan features right away)

## Downgrade Logic

### When User Clicks "Downgrade"
1. **Delayed Effect**: Plan change takes effect at **next payment date**
2. **No Immediate Charge**: User has already paid for current period
3. **Scheduled Change**: Mark downgrade to execute at period end

#### Why Delayed?
- User has already paid for the current billing period
- Fair to let them use current plan benefits until period ends
- No refunds needed, cleaner UX

#### Example
- User is on **Pro ($99/month)**, billing renews on Jan 31
- Downgrades to **Starter ($29/month)** on Jan 15
- User keeps **Pro features until Jan 31**
- On Feb 1, user is charged **$29** and switched to Starter plan

### Implementation Steps
1. Create entry in new `scheduled_plan_changes` table:
   ```sql
   CREATE TABLE scheduled_plan_changes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id),
     current_plan_id UUID NOT NULL REFERENCES plans(id),
     target_plan_id UUID NOT NULL REFERENCES plans(id),
     scheduled_for TIMESTAMPTZ NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'executed', 'cancelled'
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

2. When `current_period_end` is reached (via Stripe webhook or cron):
   - Check `scheduled_plan_changes` for pending changes
   - Update `user_plans.plan_id` to target plan
   - Update `current_period_start` and `current_period_end`
   - Charge new plan price via Stripe
   - Mark scheduled change as 'executed'

3. Show indicator in UI:
   - "Your plan will change to Starter on Jan 31, 2025"
   - Allow user to cancel scheduled downgrade

## Free Plan Special Cases

### Upgrading from Free
- **Button Text**: "Get Started" (not "Upgrade")
- **Logic**: Same as upgrade, but no prorated credit (free = $0)
- **Charge**: Full plan price for remaining days in period
- **Period**: Set new `current_period_start` to now, `current_period_end` to +1 month

### Downgrading to Free
- **Effect**: Immediate (no billing period to respect)
- **Cancellation**: Cancel Stripe subscription immediately
- **Period**: Reset to null or keep indefinite
- **Data Retention**: Keep user data but enforce Free plan limits

## API Endpoints to Implement

### POST /api/subscriptions/upgrade
```typescript
{
  targetPlanId: string;
  billingCycle: "monthly" | "yearly";
}
```

**Response:**
```typescript
{
  proratedCharge: number;
  effectiveImmediately: true;
  newPlanName: string;
  newLimits: {...};
}
```

### POST /api/subscriptions/downgrade
```typescript
{
  targetPlanId: string;
}
```

**Response:**
```typescript
{
  scheduledFor: Date;
  effectiveImmediately: false;
  newPlanName: string;
  newLimits: {...};
  canCancelUntil: Date;
}
```

### POST /api/subscriptions/cancel-scheduled-change
Allows user to cancel a pending downgrade.

## Stripe Webhook Handling

### `invoice.payment_succeeded`
- Check for scheduled plan changes at period end
- Execute pending downgrades if period just ended
- Update user's plan and limits

### `customer.subscription.updated`
- Sync subscription changes from Stripe
- Update `user_plans` with new period dates

### `customer.subscription.deleted`
- Downgrade user to Free plan immediately
- Cancel scheduled changes

## UI/UX Considerations

### Upgrade Flow
1. User clicks "Upgrade" on Pro plan
2. Show modal: "Upgrade to Pro - Pay $35.00 now for remaining 15 days"
3. Confirm → Process payment → Instant access to Pro features
4. Success message: "You're now on Pro! Enjoy your new features."

### Downgrade Flow
1. User clicks "Downgrade" on Starter plan
2. Show modal: "Downgrade to Starter - Effective Jan 31, 2025"
3. Confirm → Schedule change → Show confirmation
4. Success message: "Your plan will change to Starter on Jan 31. You can cancel this anytime."

### Cancellation of Scheduled Downgrade
1. Show banner: "Scheduled: Downgrade to Starter on Jan 31 | Cancel"
2. Click Cancel → Remove scheduled change
3. Success: "Downgrade cancelled. You'll stay on Pro."

## Database Schema Changes Needed

```sql
-- Add scheduled changes table
CREATE TABLE scheduled_plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  current_plan_id UUID NOT NULL REFERENCES plans(id),
  target_plan_id UUID NOT NULL REFERENCES plans(id),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Index for finding pending changes
CREATE INDEX idx_scheduled_changes_pending
ON scheduled_plan_changes(user_id, scheduled_for)
WHERE status = 'pending';

-- Index for finding changes to execute
CREATE INDEX idx_scheduled_changes_due
ON scheduled_plan_changes(scheduled_for, status)
WHERE status = 'pending';
```

## Testing Checklist

- [ ] Free user sees "Get Started" on all paid plans
- [ ] Paid user sees "Upgrade" only on higher tiers
- [ ] Paid user sees "Downgrade" only on lower tiers
- [ ] Current plan shows "Current Plan" (disabled)
- [ ] Upgrade charges correct prorated amount
- [ ] Upgrade grants new features immediately
- [ ] Downgrade schedules for period end
- [ ] Downgrade can be cancelled before execution
- [ ] Scheduled downgrade executes at period end
- [ ] Downgrading to Free cancels Stripe subscription
- [ ] Upgrading from Free starts new billing period
