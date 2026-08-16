-- Run this in the Supabase SQL Editor to support the Finance Tracker feature

CREATE TABLE IF NOT EXISTS finance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT null,
  entry_date date NOT null,
  bank_money numeric(12, 2) NOT null DEFAULT 0,
  udhar numeric(12, 2) NOT null DEFAULT 0,
  bank_change_reason text,
  udhar_change_reason text,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure only one entry per user per date
  CONSTRAINT unique_user_entry_date UNIQUE(user_id, entry_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE finance_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to manage only their own logs
CREATE POLICY "Users manage own finance logs" ON finance_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
