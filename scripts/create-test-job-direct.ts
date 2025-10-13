/**
 * Create a test job directly in the bgdlalagnctabfiyimpt project database
 */
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://postgres.bgdlalagnctabfiyimpt:Bs139568@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
const QUEUE_NAME = "ingest_jobs";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✓ Connected to database");

    // Check current messages
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM pgmq.q_${QUEUE_NAME}`
    );
    console.log(`Current messages in queue: ${countResult.rows[0].count}`);

    // Get an existing user from auth.users
    const authUser = await client.query(`SELECT id FROM auth.users LIMIT 1`);
    let userId;
    if (authUser.rows.length > 0) {
      userId = authUser.rows[0].id;
      console.log(`✓ Using existing auth user: ${userId}`);

      // Ensure profile exists
      await client.query(`
        INSERT INTO public.profiles (id, email, created_at)
        VALUES ($1, 'test@example.com', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [userId]);
    } else {
      console.log(`✗ No auth users found. Please sign up a user first via the app.`);
      process.exit(1);
    }

    // Check if test pattern exists, if not create one
    const existingPattern = await client.query(`
      SELECT id FROM public.patterns WHERE user_id = $1 AND name = 'Test Pattern - Landscape Analysis' LIMIT 1
    `, [userId]);

    let patternId;
    if (existingPattern.rows.length > 0) {
      patternId = existingPattern.rows[0].id;
      console.log(`✓ Using existing pattern: ${patternId}`);
    } else {
      const patternResult = await client.query(`
        INSERT INTO public.patterns (
          id, user_id, name, format, instructions, json_schema,
          model_profile, version, is_active, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'Test Pattern - Landscape Analysis',
          'json',
          'Analyze this landscape image and describe: 1) Main landscape features, 2) Weather conditions, 3) Time of day',
          '{"type":"object","properties":{"landscape_type":{"type":"string"},"weather":{"type":"string"},"time_of_day":{"type":"string"},"description":{"type":"string"}},"required":["landscape_type","weather","time_of_day","description"]}'::jsonb,
          'managed-default',
          1,
          true,
          NOW(),
          NOW()
        )
        RETURNING id
      `, [userId]);
      patternId = patternResult.rows[0].id;
      console.log(`✓ Created new pattern: ${patternId}`);
    }

    // Create a test job
    const jobResult = await client.query(`
      WITH new_job AS (
        INSERT INTO public.jobs (id, pattern_id, image_url, status, created_at, updated_at, idempotency_key)
        VALUES (
          gen_random_uuid(),
          $1,
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
          'queued',
          NOW(),
          NOW(),
          'test-job-direct-' || extract(epoch from now())::text
        )
        RETURNING id, pattern_id, image_url, status
      )
      SELECT
        pgmq.send($2, jsonb_build_object(
          'job_id', nj.id::text,
          'pattern_id', nj.pattern_id::text,
          'image_url', nj.image_url,
          'extras', '{}'::jsonb
        )) as msg_id,
        nj.id as job_id,
        nj.status
      FROM new_job nj
    `, [patternId, QUEUE_NAME]);

    const { msg_id, job_id, status } = jobResult.rows[0];
    console.log(`✓ Created job: ${job_id}`);
    console.log(`✓ Enqueued with msg_id: ${msg_id}`);
    console.log(`✓ Status: ${status}`);

    // Verify message in queue (WITHOUT calling pgmq.read() to avoid locking it)
    const verifyResult = await client.query(
      `SELECT msg_id, message->>'job_id' as job_id, vt > NOW() as is_locked
       FROM pgmq.q_${QUEUE_NAME}
       WHERE msg_id = $1`,
      [msg_id]
    );

    if (verifyResult.rows.length > 0) {
      console.log(`✓ Message verified in queue:`, verifyResult.rows[0]);
      console.log(`✓ Message is ${verifyResult.rows[0].is_locked ? 'LOCKED' : 'AVAILABLE'}`);
    } else {
      console.log(`✗ Message NOT found in queue`);
    }

    console.log(`\n✓ Ready for worker to process!`);

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
