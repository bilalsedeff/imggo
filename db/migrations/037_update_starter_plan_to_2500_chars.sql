-- Update Starter plan to 2,500 characters
-- This reduces the character limit from 5,000 to 2,500 for better plan differentiation

UPDATE plans SET
  max_characters_per_request = 2500,
  max_template_characters = 2500
WHERE name = 'starter';
