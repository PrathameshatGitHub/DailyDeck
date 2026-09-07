-- Run this in Supabase SQL Editor before starting the app

-- tasks table
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'complete')),
  is_recurring boolean not null default false,
  last_reset_date date default current_date,
  streak_count integer not null default 0,
  created_at timestamptz default now()
);

-- notes table
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  note_date date not null default current_date,
  content text not null,
  is_pinned boolean not null default false,
  created_at timestamptz default now()
);

-- If you have an existing notes table, run this:
-- alter table notes add column if not exists is_pinned boolean not null default false;


-- task_logs table (Task & Date tab)
create table task_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null,
  note text,
  log_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'complete')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table tasks enable row level security;
alter table notes enable row level security;
alter table task_logs enable row level security;

create policy "Users manage own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own notes" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own task_logs" on task_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- emails table
create table emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  category text,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table emails enable row level security;

create policy "Users manage own emails" on emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- scheduled_tasks table
create table scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  scheduled_date date not null,
  notes text,
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz default now()
);

alter table scheduled_tasks enable row level security;

create policy "Users manage own scheduled tasks" on scheduled_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- email_campaigns table
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  subject text not null,
  body text not null,
  attachment_url text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed')),
  created_at timestamptz default now()
);

alter table email_campaigns enable row level security;
create policy "Users manage own email campaigns" on email_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- email_queue table
create table email_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table email_queue enable row level security;
create policy "Users manage own email queue" on email_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- user_smtp_config table — stores per-user SMTP settings and campaign defaults
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table user_smtp_config (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users not null unique,
  smtp_email        text,
  smtp_password     text,
  smtp_sender_name  text,
  sending_speed     text not null default 'medium' check (sending_speed in ('slow', 'medium', 'fast')),
  campaign_subject  text,
  campaign_body     text,
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
);

alter table user_smtp_config enable row level security;
create policy "Users manage own smtp config" on user_smtp_config
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- whatsapp_contacts table — stores contacts & outreach message cards
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table whatsapp_contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  name         text,
  phone        text not null,
  company      text,
  message      text not null,
  batch_title  text,
  status       text not null default 'pending' check (status in ('pending', 'contacted')),
  created_at   timestamptz default now()
);

alter table whatsapp_contacts enable row level security;
create policy "Users manage own whatsapp contacts" on whatsapp_contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- job_applications table — stores AI generated personalized cold email cards
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table job_applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  recruiter_name text,
  company        text,
  role           text,
  location       text,
  experience     text,
  skills         text[],
  to_email       text not null,
  phone          text,
  subject        text not null,
  body           text not null,
  status         text not null default 'pending' check (status in ('pending', 'completed')),
  created_at     timestamptz default now()
);

alter table job_applications enable row level security;
create policy "Users manage own job applications" on job_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- image_applications table — stores AI generated cold email cards from images
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table image_applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  recruiter_name text,
  company        text,
  role           text,
  location       text,
  experience     text,
  skills         text[],
  to_email       text not null,
  phone          text,
  subject        text not null,
  body           text not null,
  status         text not null default 'pending' check (status in ('pending', 'completed')),
  source_image   text, -- URL or base64 of the source image
  created_at     timestamptz default now()
);

alter table image_applications enable row level security;
create policy "Users manage own image applications" on image_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_email_preferences table — stores per-user AI cold email generation profile
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists ai_email_preferences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null unique,
  full_name       text not null default '',
  your_email      text not null default '',
  phone           text default '',
  portfolio_url   text default '',
  linkedin_url    text default '',
  your_role       text default '',
  experience      text default '',
  key_skills      text default '',
  example_subject text default '',
  example_body    text default '',
  updated_at      timestamptz default now(),
  created_at      timestamptz default now()
);

alter table ai_email_preferences enable row level security;
create policy "Users manage own ai email preferences" on ai_email_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- job_shares table & import RPC — passcode-protected job card sharing
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists job_shares (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users not null,
  card_id     uuid references job_applications on delete cascade not null,
  share_key   text unique not null,
  passcode    text not null,
  created_at  timestamptz default now()
);

alter table job_shares enable row level security;

create policy "Users manage own job shares" on job_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- RPC Function to safely import a shared card bypassing RLS boundaries
create or replace function import_shared_card(
  p_share_key text,
  p_passcode text,
  p_importer_id uuid
)
returns jsonb
language plpgsql
security definer -- runs with admin privileges to read owner's card and copy it
as $$
declare
  v_card_id uuid;
  v_new_card_id uuid;
  v_recruiter_name text;
  v_company text;
  v_role text;
  v_location text;
  v_experience text;
  v_skills text[];
  v_to_email text;
  v_phone text;
  v_subject text;
  v_body text;
begin
  -- 1. Check share key and passcode
  select card_id into v_card_id
  from job_shares
  where share_key = p_share_key and passcode = p_passcode;

  if not found then
    raise exception 'Invalid Share Key or Passcode';
  end if;

  -- 2. Fetch original card details
  select recruiter_name, company, role, location, experience, skills, to_email, phone, subject, body
  into v_recruiter_name, v_company, v_role, v_location, v_experience, v_skills, v_to_email, v_phone, v_subject, v_body
  from job_applications
  where id = v_card_id;

  if not found then
    raise exception 'Original job card no longer exists';
  end if;

  -- 3. Insert copy for importer
  insert into job_applications (
    user_id, recruiter_name, company, role, location, experience, skills, to_email, phone, subject, body, status
  ) values (
    p_importer_id, v_recruiter_name, v_company, v_role, v_location, v_experience, v_skills, v_to_email, v_phone, v_subject, v_body, 'pending'
  )
  returning id into v_new_card_id;

  return jsonb_build_object(
    'success', true,
    'new_card_id', v_new_card_id
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- job_bundle_shares & job_bundle_items — bulk sharing job application cards
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists job_bundle_shares (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users not null,
  owner_name  text not null,
  share_key   text unique not null,
  passcode    text not null,
  created_at  timestamptz default now()
);

create table if not exists job_bundle_items (
  id               uuid primary key default gen_random_uuid(),
  share_id         uuid references job_bundle_shares(id) on delete cascade not null,
  recruiter_name   text,
  company          text,
  role             text,
  location         text,
  experience       text,
  skills           text[],
  to_email         text not null,
  phone            text,
  subject          text not null,
  body             text not null
);

alter table job_bundle_shares enable row level security;
alter table job_bundle_items enable row level security;

create policy "Users manage own job bundle shares" on job_bundle_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Users manage own job bundle items" on job_bundle_items
  for all using (
    exists (
      select 1 from job_bundle_shares where id = job_bundle_items.share_id and owner_id = auth.uid()
    )
  );

-- RPC Function to safely import bulk job application cards bypassing RLS boundaries
create or replace function import_shared_job_bundle(
  p_share_key text,
  p_passcode text,
  p_importer_id uuid
)
returns jsonb
language plpgsql
security definer -- runs with administrative privileges to duplicate job cards safely
as $$
declare
  v_share_id uuid;
  v_owner_name text;
  v_item record;
  v_imported_count integer := 0;
begin
  -- 1. Check share key and passcode
  select id, owner_name into v_share_id, v_owner_name
  from job_bundle_shares
  where share_key = p_share_key and passcode = p_passcode;

  if not found then
    raise exception 'Invalid Share Key or Passcode';
  end if;

  -- 2. Loop and duplicate each job card under importer's user_id
  for v_item in 
    select recruiter_name, company, role, location, experience, skills, to_email, phone, subject, body
    from job_bundle_items
    where share_id = v_share_id
  loop
    insert into job_applications (
      user_id, recruiter_name, company, role, location, experience, skills, to_email, phone, subject, body, status
    ) values (
      p_importer_id, v_item.recruiter_name, v_item.company, v_item.role, v_item.location, v_item.experience, v_item.skills, v_item.to_email, v_item.phone, v_item.subject, v_item.body, 'pending'
    );
    v_imported_count := v_imported_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'owner_name', v_owner_name,
    'imported_count', v_imported_count
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- email_shares & email_share_items — bulk sharing email templates
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists email_shares (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users not null,
  owner_name  text not null,
  share_key   text unique not null,
  passcode    text not null,
  created_at  timestamptz default now()
);

create table if not exists email_share_items (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid references email_shares(id) on delete cascade not null,
  title       text not null,
  category    text,
  content     text not null
);

alter table email_shares enable row level security;
alter table email_share_items enable row level security;

create policy "Users manage own email shares" on email_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Users manage own email share items" on email_share_items
  for all using (
    exists (
      select 1 from email_shares where id = email_share_items.share_id and owner_id = auth.uid()
    )
  );

-- RPC Function to safely import bulk email templates bypassing RLS boundaries
create or replace function import_shared_emails(
  p_share_key text,
  p_passcode text,
  p_importer_id uuid
)
returns jsonb
language plpgsql
security definer -- runs with administrative privileges to duplicate emails safely
as $$
declare
  v_share_id uuid;
  v_owner_name text;
  v_item record;
  v_imported_count integer := 0;
begin
  -- 1. Check share key and passcode
  select id, owner_name into v_share_id, v_owner_name
  from email_shares
  where share_key = p_share_key and passcode = p_passcode;

  if not found then
    raise exception 'Invalid Share Key or Passcode';
  end if;

  -- 2. Loop and duplicate each template card under importer's user_id
  for v_item in 
    select title, category, content
    from email_share_items
    where share_id = v_share_id
  loop
    insert into emails (
      user_id, title, category, content, status
    ) values (
      p_importer_id, v_item.title, v_item.category, v_item.content, 'pending'
    );
    v_imported_count := v_imported_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'owner_name', v_owner_name,
    'imported_count', v_imported_count
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- global_shares table — shared across ALL users (Global Space feature)
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists global_shares (
  id          text primary key,
  type        text not null check (type in ('email', 'phone')),
  title       text not null,
  sender_name text not null,
  user_id     uuid references auth.users,
  items       text[] not null,
  created_at  timestamptz default now()
);

alter table global_shares enable row level security;

-- ALL authenticated users can READ all global shares (truly global — cross-account, cross-device)
create policy "All users can read global shares" on global_shares
  for select using (auth.role() = 'authenticated');

-- Any authenticated user can INSERT their own shares
create policy "Users can insert global shares" on global_shares
  for insert with check (auth.role() = 'authenticated');

-- Users can only DELETE their own shares
create policy "Users can delete own global shares" on global_shares
  for delete using (auth.uid() = user_id);

