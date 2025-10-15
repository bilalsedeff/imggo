// Check pattern template
import fetch from "node-fetch";

const PATTERN_ID = "ed1b2a79-d89a-4281-88a8-2ebb9bcbb88e";
const API_KEY = "imggo_live_0YIXr7Vl6xVcMsyUWaNaSnDvHcvpE0I4DboS4AOs";
const BASE_URL = "http://localhost:3000";

async function checkTemplate() {
  const response = await fetch(`${BASE_URL}/api/patterns/${PATTERN_ID}`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
    },
  });

  const text = await response.text();
  console.log("Raw response:", text.substring(0, 500));
  
  const data = JSON.parse(text) as any;
  
  if (!data.success) {
    console.error("API error:", data);
    return;
  }
  
  const pattern = data.data;

  console.log("\nPattern ID:", pattern.id);
  console.log("Pattern Name:", pattern.name);
  console.log("Format:", pattern.format);
  console.log("\nTemplate:");
  console.log("=".repeat(60));
  console.log(pattern.template);
  console.log("=".repeat(60));
  console.log("\nTemplate Length:", pattern.template?.length || 0);
}

checkTemplate().catch(console.error);
