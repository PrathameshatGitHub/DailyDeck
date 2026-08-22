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
