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
  created_at timestamptz default now()
);

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
