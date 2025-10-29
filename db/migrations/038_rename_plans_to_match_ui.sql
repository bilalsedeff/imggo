-- Rename plans to match UI naming convention
-- This aligns database plan names with the UI for consistency
-- plus → pro, premium → business

-- Step 1: Drop the existing check constraint
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_name_check;

-- Step 2: Rename 'plus' plan to 'pro'
UPDATE plans SET
  name = 'pro',
  display_name = 'Pro'
WHERE name = 'plus';

-- Step 3: Rename 'premium' plan to 'business'
UPDATE plans SET
  name = 'business',
  display_name = 'Business'
WHERE name = 'premium';

-- Step 4: Add new check constraint with updated names
ALTER TABLE plans ADD CONSTRAINT plans_name_check
  CHECK (name IN ('free', 'starter', 'pro', 'business', 'enterprise'));

-- Verify final plan names
-- Expected: free, starter, pro, business, enterprise
SELECT name, display_name, max_template_characters
FROM plans
ORDER BY max_template_characters;
