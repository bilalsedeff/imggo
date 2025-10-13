import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://postgres.bgdlalagnctabfiyimpt:Bs139568@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Check message 4
  const msgResult = await client.query(`
    SELECT msg_id, vt > NOW() as is_locked
    FROM pgmq.q_ingest_jobs
    WHERE msg_id = 4
  `);
  console.log('Message 4:', msgResult.rows[0] || 'NOT FOUND (already processed or archived)');

  // Check the latest job
  const jobResult = await client.query(`
    SELECT
      id,
      status,
      error,
      latency_ms,
      created_at,
      updated_at
    FROM public.jobs
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (jobResult.rows.length > 0) {
    const job = jobResult.rows[0];
    console.log('\nLatest job:');
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Error: ${job.error || 'none'}`);
    console.log(`  Latency: ${job.latency_ms}ms`);
  }

  await client.end();
}

main().catch(console.error);
