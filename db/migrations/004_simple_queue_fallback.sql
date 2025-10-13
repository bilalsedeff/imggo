-- ============================================================================
-- Simple Queue Fallback (if PGMQ is not available)
-- ============================================================================
-- Only use this if PGMQ extension cannot be enabled

-- Queue messages table
create table if not exists queue_messages (
  id uuid primary key default uuid_generate_v4(),
  queue_name text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  visible_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

-- Indexes for performance
create index idx_queue_messages_queue_status on queue_messages(queue_name, status);
create index idx_queue_messages_visible_at on queue_messages(visible_at);
create index idx_queue_messages_created_at on queue_messages(created_at);

-- Function to enqueue message
create or replace function simple_queue_enqueue(
  p_queue_name text,
  p_payload jsonb
) returns uuid as $$
declare
  v_id uuid;
begin
  insert into queue_messages (queue_name, payload)
  values (p_queue_name, p_payload)
  returning id into v_id;

  return v_id;
end;
$$ language plpgsql;

-- Function to dequeue message (with visibility timeout)
create or replace function simple_queue_dequeue(
  p_queue_name text,
  p_visibility_seconds integer default 300,
  p_batch_size integer default 1
) returns setof queue_messages as $$
begin
  return query
  update queue_messages
  set
    status = 'processing',
    visible_at = now() + (p_visibility_seconds || ' seconds')::interval,
    updated_at = now()
  where id in (
    select id from queue_messages
    where queue_name = p_queue_name
      and status = 'pending'
      and visible_at <= now()
    order by created_at
    limit p_batch_size
    for update skip locked
  )
  returning *;
end;
$$ language plpgsql;

-- Function to mark message as completed
create or replace function simple_queue_complete(
  p_message_id uuid
) returns void as $$
begin
  update queue_messages
  set
    status = 'completed',
    processed_at = now(),
    updated_at = now()
  where id = p_message_id;
end;
$$ language plpgsql;

-- Function to mark message as failed
create or replace function simple_queue_fail(
  p_message_id uuid,
  p_error_message text default null
) returns void as $$
begin
  update queue_messages
  set
    status = 'failed',
    error_message = p_error_message,
    attempts = attempts + 1,
    processed_at = now(),
    updated_at = now()
  where id = p_message_id;
end;
$$ language plpgsql;

-- Cleanup old completed/failed messages (run periodically)
create or replace function simple_queue_cleanup(
  p_queue_name text,
  p_older_than_hours integer default 24
) returns integer as $$
declare
  v_deleted integer;
begin
  delete from queue_messages
  where queue_name = p_queue_name
    and status in ('completed', 'failed')
    and processed_at < now() - (p_older_than_hours || ' hours')::interval;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$ language plpgsql;

-- ============================================================================
-- Usage Example:
-- ============================================================================
/*
-- Enqueue a job
SELECT simple_queue_enqueue(
  'ingest_jobs',
  '{"job_id": "123", "pattern_id": "456", "image_url": "https://..."}'::jsonb
);

-- Dequeue jobs (worker pulls batch)
SELECT * FROM simple_queue_dequeue('ingest_jobs', 300, 5);

-- Mark as completed
SELECT simple_queue_complete('message-uuid-here');

-- Mark as failed
SELECT simple_queue_fail('message-uuid-here', 'OpenAI API error');

-- Cleanup old messages
SELECT simple_queue_cleanup('ingest_jobs', 24);
*/
