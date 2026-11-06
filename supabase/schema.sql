-- Hearth schema for Supabase.
-- Run this in the SQL editor after creating a project.
-- The app also works without Supabase, using IndexedDB on the device.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  avatar text,
  timezone text not null default 'UTC',
  week_starts_on int not null default 1,
  availability_start text not null default '18:00',
  availability_end text not null default '23:00',
  work_start text not null default '09:00',
  work_end text not null default '17:00',
  wake text not null default '07:30',
  sleep text not null default '23:30',
  theme text not null default 'system',
  reduced_motion boolean not null default false,
  animation text not null default 'normal',
  reminder_style text not null default 'gentle',
  weekly_workload text not null default 'balanced',
  quiet_start text not null default '23:00',
  quiet_end text not null default '18:00',
  notifications_enabled boolean not null default false,
  show_xp boolean not null default true,
  onboarded boolean not null default false,
  onboarding jsonb,
  streak_freezes int not null default 1,
  freezes_left int not null default 1,
  freeze_week text,
  early_organizer boolean not null default false,
  planner_accepted text[] not null default '{}',
  fired_reminders text[] not null default '{}',
  activity jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  icon text not null,
  area text not null,
  effect text not null,
  built_in boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  plan_key text,
  title text not null,
  description text not null default '',
  category_id text not null,
  icon text not null,
  image text,
  priority text not null,
  duration_minutes int not null,
  xp_reward int not null,
  anchor_date date not null,
  preferred_time text,
  flexible boolean not null default true,
  schedule_window text not null,
  reminder_minutes int,
  notes text not null default '',
  area text not null,
  pet_id text,
  project_id text,
  active boolean not null default true,
  streak int not null default 0,
  longest_streak int not null default 0,
  at_risk boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.task_recurrence (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  type text not null,
  interval int,
  weekdays int[],
  weekday int,
  day_of_month int,
  primary key (user_id, task_id)
);

create table if not exists public.subtasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  task_id text not null,
  title text not null,
  position int not null default 0,
  primary key (user_id, id)
);

create table if not exists public.occurrences (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  task_id text not null,
  cycle_key date not null,
  scheduled_date date not null,
  scheduled_time text not null,
  time_auto boolean not null default true,
  overflow boolean not null default false,
  status text not null,
  completed_at timestamptz,
  completed_late boolean not null default false,
  done_by text,
  skipped_at timestamptz,
  rescheduled_from date,
  snoozed_until timestamptz,
  subtask_done text[] not null default '{}',
  xp_awarded int not null default 0,
  title_snapshot text not null,
  category_id text not null,
  icon text not null,
  duration_minutes int not null,
  xp_reward int not null,
  area text not null,
  priority text not null,
  flexible boolean not null default true,
  schedule_window text not null,
  preferred_time text,
  reminder_minutes int,
  pet_id text,
  project_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.pets (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  plan_key text,
  name text not null,
  type text not null,
  photo text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.pet_care_schedules (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  pet_id text not null,
  task_id text not null,
  kind text not null,
  primary key (user_id, id)
);

create table if not exists public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  plan_key text,
  name text not null,
  description text not null default '',
  kind text not null,
  deadline date,
  color text not null default '#1e6b48',
  income_notes text not null default '',
  expense_notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.xp_transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  amount int not null,
  reason text not null,
  occurrence_id text,
  task_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.levels (
  level int primary key,
  title text not null,
  xp_required int not null
);

create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists public.notifications (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  occurrence_id text,
  title text not null,
  body text not null,
  fire_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

insert into public.levels (level, title, xp_required) values
  (1, 'Beginner', 0),
  (2, 'Getting Started', 60),
  (3, 'Building Momentum', 160),
  (4, 'Consistent', 320),
  (5, 'Organized', 520),
  (6, 'Steady', 780),
  (7, 'Focused', 1100),
  (8, 'Reliable', 1500),
  (9, 'Harmonious', 2000),
  (10, 'Life OS', 2600)
on conflict (level) do nothing;

insert into public.achievements (id, name, description) values
  ('first-task', 'First Task Completed', 'Complete your first task.'),
  ('streak-7', 'First 7-Day Streak', 'Keep a 7-day rhythm or a 7-cycle task streak.'),
  ('tasks-10', '10 Tasks Completed', 'Complete 10 tasks.'),
  ('tasks-50', '50 Tasks Completed', 'Complete 50 tasks.'),
  ('laundry-master', 'Laundry Master', 'Finish 8 laundry tasks.'),
  ('cleaning-champion', 'Cleaning Champion', 'Finish 12 cleaning tasks across the home.'),
  ('perfect-week', 'Perfect Week', 'Complete every planned task in a week.'),
  ('early-organizer', 'Early Organizer', 'Plan your evening before 6 PM.'),
  ('consistency-master', 'Consistency Master', 'Hold a 21-day rhythm or four strong weeks.')
on conflict (id) do nothing;

create or replace view public.habits
with (security_invoker = true) as
  select * from public.tasks where area = 'habit';

create or replace view public.habit_completions
with (security_invoker = true) as
  select occurrences.*
  from public.occurrences
  join public.tasks on tasks.user_id = occurrences.user_id and tasks.id = occurrences.task_id
  where tasks.area = 'habit' and occurrences.status = 'completed';

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_recurrence enable row level security;
alter table public.subtasks enable row level security;
alter table public.occurrences enable row level security;
alter table public.pets enable row level security;
alter table public.pet_care_schedules enable row level security;
alter table public.projects enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notifications enable row level security;
alter table public.levels enable row level security;
alter table public.achievements enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurrence" on public.task_recurrence for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subtasks" on public.subtasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own occurrences" on public.occurrences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pets" on public.pets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pet care" on public.pet_care_schedules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own projects" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own xp" on public.xp_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on public.user_achievements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read levels" on public.levels for select using (true);
create policy "read achievement catalog" on public.achievements for select using (true);

alter table public.profiles add column if not exists activity jsonb not null default '[]';
alter table public.occurrences add column if not exists done_by text;
