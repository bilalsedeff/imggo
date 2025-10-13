import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://postgres.bgdlalagnctabfiyimpt:Bs139568@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const result = await client.query(`
    SELECT
      id,
      status,
      manifest,
      error,
      latency_ms,
      created_at
    FROM public.jobs
    WHERE id = 'fca88670-d41f-404b-bc1a-a97312e072fc'
  `);

  if (result.rows.length > 0) {
    const job = result.rows[0];
    console.log('Job Details:');
    console.log(`  Status: ${job.status}`);
    console.log(`  Latency: ${job.latency_ms}ms`);
    console.log(`  Error: ${job.error || 'none'}`);
    console.log('\nManifest:');
    console.log(JSON.stringify(job.manifest, null, 2));
  }

  await client.end();
}

main().catch(console.error);
