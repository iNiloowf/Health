# Hearth

Hearth is a personal life organizer for evenings. Household chores default to the hours after 6 PM, recurring tasks keep their own rhythm, and completing something is meant to feel satisfying without turning the day into a scoreboard.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first screen is onboarding. Answers are saved in IndexedDB, so a refresh keeps them.

```bash
npm run verify
npm run build
npm start
```

`verify` checks recurrence, evening scheduling, missed versus skipped versus postponed tasks, streaks, and XP.

## Technologies

- Next.js, React, and TypeScript
- Tailwind CSS
- Motion (Framer Motion) for completion, progress, and celebration animation
- Lucide icons
- IndexedDB for local persistence
- Optional Supabase authentication and Postgres sync
- A web app manifest and service worker for installation

## Environment variables

Copy `.env.example` to `.env.local` only if you want cloud sync.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Without those values the app stays in local mode. Nothing is blocked.

## Database setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. In Authentication, enable email and password.
4. Put the project URL and anon key in `.env.local`.
5. Restart the dev server, then create an account from Profile.

The schema uses row level security so each account can only read and write its own rows. Tasks, recurrence rules, subtasks, completion history, pets, pet-care schedules, projects, XP, achievements, and notifications each have a table. Habits are tasks in the habit area, exposed through the `habits` and `habit_completions` views.

Local data and cloud data merge by newest `updatedAt` when you sign in. Export a JSON backup from Profile before you rely on sync.

## Scheduling

- Household, habit, pet, health, and personal tasks are placed inside your available hours. The default is 18:00–23:00.
- Work tasks use daytime hours unless onboarding says evenings.
- A time you set yourself is kept, even if it is outside the default window.
- A missed task is not a failed day. You can complete it, move it, or use a weekly streak recovery to skip it.
- Moving a task keeps the same cycle, so the next recurrence is not duplicated.
- Weekly tasks only exist on their scheduled day, so a Tuesday does not break a laundry streak.

## Notifications

Reminders are requested from Profile after an explanation, never on first launch. Quiet hours default to 23:00–18:00, so household tasks do not notify in the morning. Browser notifications work when permission is granted and the app is open. Installed PWAs still depend on the operating system, and background web push needs a server this project does not include.

## Limitations

- Background push notifications are not sent while the app is closed.
- Supabase sync is last-write-wins per record. Two devices edited offline can overwrite fields that changed in both places; completions are kept by id.
- There is no multi-user household sharing.
