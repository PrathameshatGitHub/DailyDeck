# DailyDeck

Personal task, notes, and daily-log tracker. Next.js 15 + Supabase + Tailwind.

## Setup

1. **Install deps**
   ```
   npm install
   ```

2. **Supabase**
   - Create a project at https://supabase.com
   - Open SQL Editor, paste and run `supabase_setup.sql`
   - Copy `.env.local.example` to `.env.local` and fill in your project URL + anon key (Project Settings -> API)

3. **Run**
   ```
   npm run dev
   ```
   Visit http://localhost:3000 -- you'll be redirected to `/login`. Sign up, then log in.

## Structure

- `Daily Tasks` -- Kanban-style Pending/Complete board. Recurring tasks auto-reset to Pending every day on load.
- `Notes` -- Daily notes grouped by date.
- `Task & Date` -- Log table with dynamic type, note, and date.

## Notes

- Auth is intentionally minimal (no strong password rules, no email verification friction).
- Recurring task reset happens client-side on each load -- no cron needed for personal use.
