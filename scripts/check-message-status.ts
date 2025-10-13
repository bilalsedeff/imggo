import { Client } from "pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env file");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const result = await client.query(`
    SELECT
      msg_id,
      vt,
      vt > NOW() as is_locked,
      CASE
        WHEN vt > NOW() THEN 'LOCKED until ' || vt::text
        ELSE 'AVAILABLE'
      END as status
    FROM pgmq.q_ingest_jobs
    WHERE msg_id = 2
  `);

  console.log('Message 2 status:', result.rows[0] || 'NOT FOUND');

  await client.end();
}

main().catch(console.error);
