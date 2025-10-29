/**
 * Script to create test users with different plans
 * Run: npx tsx scripts/create-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_USERS = [
  {
    email: 'free@imggo.com',
    password: '123456',
    planName: 'free'
  },
  {
    email: 'starter@imggo.com',
    password: '123456',
    planName: 'starter'
  },
  {
    email: 'pro@imggo.com',
    password: '123456',
    planName: 'pro'
  },
  {
    email: 'business@imggo.com',
    password: '123456',
    planName: 'business'
  },
  {
    email: 'enterprise@imggo.com',
    password: '123456',
    planName: 'enterprise'
  }
];

async function createTestUsers() {
  console.log('🚀 Creating test users...\n');

  // First, get all plan IDs
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, name, display_name')
    .order('sort_order');

  if (plansError) {
    console.error('❌ Failed to fetch plans:', plansError);
    process.exit(1);
  }

  const planMap = new Map(plans?.map(p => [p.name, p]) || []);

  for (const testUser of TEST_USERS) {
    console.log(`Creating ${testUser.email}...`);

    const plan = planMap.get(testUser.planName);
    if (!plan) {
      console.error(`❌ Plan ${testUser.planName} not found`);
      continue;
    }

    // Create user using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true // Auto-confirm email
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${testUser.email} already exists, updating plan...`);

        // Get existing user
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const user = existingUser?.users.find(u => u.email === testUser.email);

        if (user) {
          // Update their plan
          const { error: updateError } = await supabase
            .from('user_plans')
            .update({ plan_id: plan.id })
            .eq('user_id', user.id);

          if (updateError) {
            console.error(`❌ Failed to update plan for ${testUser.email}:`, updateError);
          } else {
            console.log(`✅ Updated ${testUser.email} to ${plan.display_name} plan`);
          }
        }
        continue;
      }

      console.error(`❌ Failed to create ${testUser.email}:`, authError);
      continue;
    }

    const userId = authData.user.id;

    // User plan should be auto-created by trigger, but let's update it to correct plan
    const { error: planError } = await supabase
      .from('user_plans')
      .update({ plan_id: plan.id })
      .eq('user_id', userId);

    if (planError) {
      console.error(`❌ Failed to update plan for ${testUser.email}:`, planError);
      continue;
    }

    console.log(`✅ Created ${testUser.email} with ${plan.display_name} plan\n`);
  }

  console.log('\n🎉 Test user creation complete!\n');
  console.log('Credentials:');
  TEST_USERS.forEach(u => {
    console.log(`  ${u.email} / 123456 (${u.planName} plan)`);
  });
}

createTestUsers().catch(console.error);
