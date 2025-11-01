/**
 * Test Plan Limit Enforcement
 *
 * This script tests that all three plan limits are properly enforced:
 * 1. Pattern creation limit (max_patterns)
 * 2. API key creation limit (max_api_keys)
 * 3. Webhook creation limit (max_webhooks)
 *
 * Run: node scripts/test-plan-limits.js
 */

require('dotenv').config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY; // Free plan API key

if (!TEST_API_KEY) {
  console.error('❌ TEST_API_KEY environment variable is required');
  process.exit(1);
}

// Track created resources for cleanup
const createdPatterns = [];
const createdApiKeys = [];
const createdWebhooks = [];

async function testPatternLimit() {
  console.log('\n📦 Testing Pattern Creation Limit (Free Plan: 5 max)');
  console.log('='.repeat(60));

  try {
    // Get current patterns
    const listRes = await fetch(`${API_BASE}/api/patterns`, {
      headers: { 'Authorization': `Bearer ${TEST_API_KEY}` },
    });
    const { data: patterns } = await listRes.json();
    const currentCount = patterns.length;

    console.log(`Current patterns: ${currentCount}/5`);

    // Try to create patterns up to the limit
    const patternsNeeded = Math.max(0, 5 - currentCount);

    if (patternsNeeded > 0) {
      console.log(`Creating ${patternsNeeded} patterns to reach limit...`);

      for (let i = 0; i < patternsNeeded; i++) {
        const res = await fetch(`${API_BASE}/api/patterns`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Test Pattern ${Date.now()}-${i}`,
            instructions: 'Test pattern for limit testing',
            format: 'json',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          createdPatterns.push(data.data.id);
          console.log(`  ✅ Created pattern ${i + 1}/${patternsNeeded}`);
        } else {
          const error = await res.json();
          console.log(`  ❌ Failed to create pattern: ${error.message}`);
        }
      }
    }

    // Now try to create the 6th pattern (should fail)
    console.log('\n🔒 Attempting to create 6th pattern (should be blocked)...');

    const res = await fetch(`${API_BASE}/api/patterns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Should Fail ${Date.now()}`,
        instructions: 'This should be blocked',
        format: 'json',
      }),
    });

    if (res.status === 403) {
      const error = await res.json();
      console.log(`  ✅ PASS: Got 403 as expected`);
      console.log(`  ✅ Error code: ${error.code}`);
      console.log(`  ✅ Message: ${error.message}`);
      return true;
    } else if (res.ok) {
      console.log(`  ❌ FAIL: Pattern creation succeeded when it should have been blocked!`);
      const data = await res.json();
      createdPatterns.push(data.data.id);
      return false;
    } else {
      console.log(`  ❌ FAIL: Got unexpected status ${res.status}`);
      const error = await res.json();
      console.log(`  Error: ${JSON.stringify(error)}`);
      return false;
    }

  } catch (error) {
    console.error('  ❌ Test failed with exception:', error.message);
    return false;
  }
}

async function testApiKeyLimit() {
  console.log('\n🔑 Testing API Key Creation Limit (Free Plan: 2 max)');
  console.log('='.repeat(60));

  try {
    // Get current API keys
    const listRes = await fetch(`${API_BASE}/api/api-keys`, {
      headers: { 'Authorization': `Bearer ${TEST_API_KEY}` },
    });
    const { data: apiKeys } = await listRes.json();
    const currentCount = apiKeys.length;

    console.log(`Current API keys: ${currentCount}/2`);

    // Try to create API keys up to the limit
    const keysNeeded = Math.max(0, 2 - currentCount);

    if (keysNeeded > 0) {
      console.log(`Creating ${keysNeeded} API keys to reach limit...`);

      for (let i = 0; i < keysNeeded; i++) {
        const res = await fetch(`${API_BASE}/api/api-keys`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Test Key ${Date.now()}-${i}`,
            environment: 'test',
            scopes: ['patterns:read'],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          createdApiKeys.push(data.data.id);
          console.log(`  ✅ Created API key ${i + 1}/${keysNeeded}`);
        } else {
          const error = await res.json();
          console.log(`  ❌ Failed to create API key: ${error.message}`);
        }
      }
    }

    // Now try to create the 3rd API key (should fail)
    console.log('\n🔒 Attempting to create 3rd API key (should be blocked)...');

    const res = await fetch(`${API_BASE}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Should Fail ${Date.now()}`,
        environment: 'test',
        scopes: ['patterns:read'],
      }),
    });

    if (res.status === 403) {
      const error = await res.json();
      console.log(`  ✅ PASS: Got 403 as expected`);
      console.log(`  ✅ Error code: ${error.code}`);
      console.log(`  ✅ Message: ${error.message}`);
      return true;
    } else if (res.ok) {
      console.log(`  ❌ FAIL: API key creation succeeded when it should have been blocked!`);
      const data = await res.json();
      createdApiKeys.push(data.data.id);
      return false;
    } else {
      console.log(`  ❌ FAIL: Got unexpected status ${res.status}`);
      const error = await res.json();
      console.log(`  Error: ${JSON.stringify(error)}`);
      return false;
    }

  } catch (error) {
    console.error('  ❌ Test failed with exception:', error.message);
    return false;
  }
}

async function testWebhookLimit() {
  console.log('\n🪝 Testing Webhook Creation Limit (Free Plan: 3 max)');
  console.log('='.repeat(60));

  try {
    // Get current webhooks
    const listRes = await fetch(`${API_BASE}/api/webhooks`, {
      headers: { 'Authorization': `Bearer ${TEST_API_KEY}` },
    });
    const { data: webhooks } = await listRes.json();
    const currentCount = webhooks.length;

    console.log(`Current webhooks: ${currentCount}/3`);

    // Try to create webhooks up to the limit
    const webhooksNeeded = Math.max(0, 3 - currentCount);

    if (webhooksNeeded > 0) {
      console.log(`Creating ${webhooksNeeded} webhooks to reach limit...`);

      for (let i = 0; i < webhooksNeeded; i++) {
        const res = await fetch(`${API_BASE}/api/webhooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://example.com/webhook-${Date.now()}-${i}`,
            events: ['job.succeeded', 'job.failed'],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          createdWebhooks.push(data.id);
          console.log(`  ✅ Created webhook ${i + 1}/${webhooksNeeded}`);
        } else {
          const error = await res.json();
          console.log(`  ❌ Failed to create webhook: ${error.message}`);
        }
      }
    }

    // Now try to create the 4th webhook (should fail)
    console.log('\n🔒 Attempting to create 4th webhook (should be blocked)...');

    const res = await fetch(`${API_BASE}/api/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://example.com/should-fail-${Date.now()}`,
        events: ['job.succeeded'],
      }),
    });

    if (res.status === 403 || res.status === 500) {
      const error = await res.json();
      // Check if error message contains limit-related text
      if (error.message && error.message.toLowerCase().includes('limit')) {
        console.log(`  ✅ PASS: Got ${res.status} with limit error as expected`);
        console.log(`  ✅ Message: ${error.message}`);
        return true;
      } else {
        console.log(`  ⚠️  Got ${res.status} but unclear if it's limit-related`);
        console.log(`  Message: ${error.message}`);
        return false;
      }
    } else if (res.ok) {
      console.log(`  ❌ FAIL: Webhook creation succeeded when it should have been blocked!`);
      const data = await res.json();
      createdWebhooks.push(data.id);
      return false;
    } else {
      console.log(`  ❌ FAIL: Got unexpected status ${res.status}`);
      const error = await res.json();
      console.log(`  Error: ${JSON.stringify(error)}`);
      return false;
    }

  } catch (error) {
    console.error('  ❌ Test failed with exception:', error.message);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleanup (optional - keeping test data for verification)');
  console.log('='.repeat(60));
  console.log(`Created ${createdPatterns.length} patterns`);
  console.log(`Created ${createdApiKeys.length} API keys`);
  console.log(`Created ${createdWebhooks.length} webhooks`);
  console.log('\nYou can manually delete these from the dashboard if needed.');
}

async function main() {
  console.log('\n🚀 Plan Limit Enforcement Test Suite');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Using API Key: ${TEST_API_KEY.substring(0, 20)}...`);

  const results = {
    patterns: false,
    apiKeys: false,
    webhooks: false,
  };

  // Run all tests
  results.patterns = await testPatternLimit();
  results.apiKeys = await testApiKeyLimit();
  results.webhooks = await testWebhookLimit();

  await cleanup();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Pattern Limit:  ${results.patterns ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Key Limit:  ${results.apiKeys ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Limit:  ${results.webhooks ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = results.patterns && results.apiKeys && results.webhooks;

  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Plan limits are properly enforced.');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED! Review the output above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
