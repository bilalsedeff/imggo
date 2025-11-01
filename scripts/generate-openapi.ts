/**
 * OpenAPI Specification Generator
 *
 * This script generates the openapi.yaml file from our Zod schemas
 * and endpoint registrations. Run this whenever schemas or endpoints change.
 *
 * Usage: npm run openapi:generate
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { generateOpenAPIDocument } from '../src/openapi/registry';

// Import all endpoint registrations to populate the registry
import '../src/openapi/endpoints/patterns';
import '../src/openapi/endpoints/jobs';
import '../src/openapi/endpoints/api-keys';
import '../src/openapi/endpoints/webhooks';
import '../src/openapi/endpoints/storage';
import '../src/openapi/endpoints/system';

function main() {
  console.log('🔄 Generating OpenAPI specification...\n');

  try {
    // Generate the OpenAPI document
    const spec = generateOpenAPIDocument();

    // Convert to YAML
    const yamlSpec = yaml.dump(spec, {
      lineWidth: -1, // Don't wrap lines
      noRefs: true, // Inline all references
      sortKeys: false, // Preserve key order
    });

    // Write to file
    const outputPath = path.join(process.cwd(), 'openapi.yaml');
    fs.writeFileSync(outputPath, yamlSpec, 'utf-8');

    console.log('✅ OpenAPI specification generated successfully!');
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📊 Stats:`);
    console.log(`   - ${Object.keys(spec.paths || {}).length} endpoints documented`);
    console.log(`   - ${Object.keys(spec.components?.schemas || {}).length} schemas defined`);
    console.log(`   - ${(spec.tags || []).length} tags used`);
    console.log('\n💡 Tip: View your API docs at http://localhost:3000/docs');
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:');
    console.error(error);
    process.exit(1);
  }
}

main();
