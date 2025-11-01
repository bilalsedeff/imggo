/**
 * Test Script: API Permissions & Format Validation
 *
 * Tests:
 * 1. All permission scopes with both API keys
 * 2. Format validation for all formats (correct + wrong schemas)
 *
 * Usage:
 * tsx scripts/test-permissions-and-validation.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// API Keys for testing
const FULL_PERMISSIONS_KEY = "imggo_test_fHAOCW-NfxHtHJBaIK7jVgY8yp99D9c1H9JhTunx"; // All permissions
const LIMITED_KEY = "imggo_test_fzkLpWbOhSzmi5IedcR4ko2qaI7krBb-SY7NEMQ0"; // Only jobs:read

interface TestResult {
  test: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: unknown;
}

const results: TestResult[] = [];

// ============================================================================
// TEST HELPERS
// ============================================================================

async function makeRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return { status: response.status, data };
  } catch (error) {
    return {
      status: 0,
      data: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

function addResult(test: string, passed: boolean, expected: string, actual: string, details?: unknown) {
  results.push({ test, passed, expected, actual, details });
  const emoji = passed ? "✅" : "❌";
  console.log(`${emoji} ${test}`);
  if (!passed) {
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual: ${actual}`);
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }
}

// ============================================================================
// PERMISSION TESTS
// ============================================================================

async function testPermissions() {
  console.log("\n📋 TESTING API PERMISSIONS\n");

  // Test 1: patterns:read with full key (should work)
  console.log("Testing patterns:read scope...");
  const test1 = await makeRequest("GET", "/api/patterns", FULL_PERMISSIONS_KEY);
  addResult(
    "GET /api/patterns with full permissions",
    test1.status === 200,
    "200 OK",
    `${test1.status}`,
    test1.data
  );

  // Test 2: patterns:read with limited key (should fail - no patterns:read scope)
  const test2 = await makeRequest("GET", "/api/patterns", LIMITED_KEY);
  addResult(
    "GET /api/patterns with limited key (jobs:read only)",
    test2.status === 403,
    "403 INSUFFICIENT_SCOPE",
    `${test2.status}`,
    test2.data
  );

  // Test 3: patterns:write with full key (should work)
  const test3 = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "Test Pattern " + Date.now(),
    format: "json",
    instructions: "Test pattern for permission testing",
    json_schema: { type: "object", properties: { test: { type: "string" } }, additionalProperties: false },
  });
  addResult(
    "POST /api/patterns with full permissions",
    test3.status === 201,
    "201 Created",
    `${test3.status}`,
    test3.data
  );

  // Test 4: patterns:write with limited key (should fail)
  const test4 = await makeRequest("POST", "/api/patterns", LIMITED_KEY, {
    name: "Should Fail " + Date.now(),
    format: "json",
    instructions: "This should fail",
    json_schema: { type: "object", additionalProperties: false },
  });
  addResult(
    "POST /api/patterns with limited key (should fail)",
    test4.status === 403,
    "403 INSUFFICIENT_SCOPE",
    `${test4.status}`,
    test4.data
  );

  // Test 5: webhooks:read with full key (should work)
  const test5 = await makeRequest("GET", "/api/webhooks", FULL_PERMISSIONS_KEY);
  addResult(
    "GET /api/webhooks with full permissions",
    test5.status === 200,
    "200 OK",
    `${test5.status}`,
    test5.data
  );

  // Test 6: webhooks:read with limited key (should fail)
  const test6 = await makeRequest("GET", "/api/webhooks", LIMITED_KEY);
  addResult(
    "GET /api/webhooks with limited key (should fail)",
    test6.status === 403,
    "403 INSUFFICIENT_SCOPE",
    `${test6.status}`,
    test6.data
  );

  // Test 7: webhooks:write with full key (should work)
  const test7 = await makeRequest("POST", "/api/webhooks", FULL_PERMISSIONS_KEY, {
    url: "https://example.com/webhook-test-" + Date.now(),
    events: ["job.succeeded"],
  });
  addResult(
    "POST /api/webhooks with full permissions",
    test7.status === 201 || test7.status === 403, // 403 if limit reached
    "201 Created or 403 Plan Limit",
    `${test7.status}`,
    test7.data
  );

  // Test 8: webhooks:write with limited key (should fail)
  const test8 = await makeRequest("POST", "/api/webhooks", LIMITED_KEY, {
    url: "https://example.com/should-fail",
    events: ["job.succeeded"],
  });
  addResult(
    "POST /api/webhooks with limited key (should fail)",
    test8.status === 403,
    "403 INSUFFICIENT_SCOPE",
    `${test8.status}`,
    test8.data
  );

  // Test 9: jobs:read with limited key (should work - it has this scope)
  const test9 = await makeRequest("GET", "/api/jobs/00000000-0000-0000-0000-000000000000", LIMITED_KEY);
  addResult(
    "GET /api/jobs/:id with limited key (has jobs:read)",
    test9.status === 404 || test9.status === 403, // 404 not found is OK, or 403 if not owned
    "404 Not Found or 403 Forbidden",
    `${test9.status}`,
    test9.data
  );
}

// ============================================================================
// FORMAT VALIDATION TESTS
// ============================================================================

async function testFormatValidation() {
  console.log("\n🔧 TESTING FORMAT VALIDATION\n");

  // JSON - Valid
  console.log("Testing JSON validation...");
  const jsonValid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "JSON Valid " + Date.now(),
    format: "json",
    instructions: "Test JSON schema",
    json_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" }
      },
      required: ["name"],
      additionalProperties: false
    },
  });
  addResult(
    "JSON - Valid schema",
    jsonValid.status === 201,
    "201 Created",
    `${jsonValid.status}`,
    jsonValid.data
  );

  // JSON - Invalid (whitespace in keys)
  const jsonInvalid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "JSON Invalid " + Date.now(),
    format: "json",
    instructions: "Test invalid JSON",
    json_schema: {
      type: "object",
      properties: {
        "name with spaces": { type: "string" } // ❌ Whitespace not allowed
      },
      additionalProperties: false
    },
  });
  addResult(
    "JSON - Invalid schema (whitespace in keys)",
    jsonInvalid.status === 400,
    "400 INVALID_SCHEMA",
    `${jsonInvalid.status}`,
    jsonInvalid.data
  );

  // YAML - Valid
  console.log("Testing YAML validation...");
  const yamlValid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "YAML Valid " + Date.now(),
    format: "yaml",
    instructions: "Test YAML schema",
    yaml_schema: "name: John\nage: 30\ncity: NYC",
  });
  addResult(
    "YAML - Valid schema",
    yamlValid.status === 201,
    "201 Created",
    `${yamlValid.status}`,
    yamlValid.data
  );

  // YAML - Invalid syntax
  const yamlInvalid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "YAML Invalid " + Date.now(),
    format: "yaml",
    instructions: "Test invalid YAML",
    yaml_schema: "name: John\n  bad indentation:\nage: 30", // ❌ Bad indentation
  });
  addResult(
    "YAML - Invalid syntax",
    yamlInvalid.status === 400,
    "400 INVALID_SCHEMA",
    `${yamlInvalid.status}`,
    yamlInvalid.data
  );

  // XML - Valid
  console.log("Testing XML validation...");
  const xmlValid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "XML Valid " + Date.now(),
    format: "xml",
    instructions: "Test XML schema",
    xml_schema: '<?xml version="1.0"?>\n<person>\n  <name>John</name>\n  <age>30</age>\n</person>',
  });
  addResult(
    "XML - Valid schema",
    xmlValid.status === 201,
    "201 Created",
    `${xmlValid.status}`,
    xmlValid.data
  );

  // XML - Invalid syntax
  const xmlInvalid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "XML Invalid " + Date.now(),
    format: "xml",
    instructions: "Test invalid XML",
    xml_schema: '<person><name>John</person>', // ❌ Mismatched tags
  });
  addResult(
    "XML - Invalid syntax (mismatched tags)",
    xmlInvalid.status === 400,
    "400 INVALID_SCHEMA",
    `${xmlInvalid.status}`,
    xmlInvalid.data
  );

  // CSV - Valid
  console.log("Testing CSV validation...");
  const csvValid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "CSV Valid " + Date.now(),
    format: "csv",
    instructions: "Test CSV schema",
    csv_schema: "name,age,city\nJohn,30,NYC\nJane,25,LA",
    csv_delimiter: "comma",
  });
  addResult(
    "CSV - Valid schema",
    csvValid.status === 201,
    "201 Created",
    `${csvValid.status}`,
    csvValid.data
  );

  // CSV - Invalid (inconsistent columns)
  const csvInvalid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "CSV Invalid " + Date.now(),
    format: "csv",
    instructions: "Test invalid CSV",
    csv_schema: "name,age,city\nJohn,30\nJane,25,LA", // ❌ Row 2 missing column
    csv_delimiter: "comma",
  });
  addResult(
    "CSV - Invalid schema (inconsistent columns)",
    csvInvalid.status === 400,
    "400 INVALID_SCHEMA",
    `${csvInvalid.status}`,
    csvInvalid.data
  );

  // Plain Text - Valid
  console.log("Testing Plain Text validation...");
  const textValid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "Text Valid " + Date.now(),
    format: "text",
    instructions: "Test plain text schema",
    plain_text_schema: "# Main Heading\n\n## Subheading\n\nContent here",
  });
  addResult(
    "Plain Text - Valid schema (markdown headings)",
    textValid.status === 201,
    "201 Created",
    `${textValid.status}`,
    textValid.data
  );

  // Plain Text - Invalid (missing # heading)
  const textInvalid = await makeRequest("POST", "/api/patterns", FULL_PERMISSIONS_KEY, {
    name: "Text Invalid " + Date.now(),
    format: "text",
    instructions: "Test invalid plain text",
    plain_text_schema: "## No main heading\n\nContent", // ❌ Must start with single #
  });
  addResult(
    "Plain Text - Invalid schema (no main heading)",
    textInvalid.status === 400,
    "400 INVALID_SCHEMA",
    `${textInvalid.status}`,
    textInvalid.data
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🚀 ImgGo API Permission & Validation Test Suite\n");
  console.log("Testing against:", API_BASE_URL);
  console.log("\nAPI Keys:");
  console.log(`  Full Permissions: ${FULL_PERMISSIONS_KEY.substring(0, 20)}...`);
  console.log(`  Limited (jobs:read): ${LIMITED_KEY.substring(0, 20)}...`);

  await testPermissions();
  await testFormatValidation();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`\n  ${r.test}`);
      console.log(`    Expected: ${r.expected}`);
      console.log(`    Actual: ${r.actual}`);
    });
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED!");
    process.exit(0);
  }
}

main().catch(console.error);
