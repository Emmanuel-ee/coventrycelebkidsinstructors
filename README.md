# Coventry CelebKids — Teacher & Child Records

This app helps children’s instructors keep a clear record of every instructor and child in the program. It supports:

- Quick add/search for instructors with roles and contact details.
- Child records with guardians, notes, and assigned instructors.
- Automatic saving to the browser (localStorage) so records persist between visits.

## How it works

1. Register instructors in the **Instructors** panel.
2. Review children in the **Registered children** panel.
3. Use search boxes to filter by name.
4. Remove instructors when needed (children tied to a removed instructor become unassigned).

## Run locally

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test -- --watchAll=false
```

## Supabase setup (recommended)

1. Create a new Supabase project.
2. In the SQL editor, run the schema below.
3. Copy your **Project URL** and **anon public key** into a `.env.local` file.

```sql
create table if not exists teachers (
	id text primary key,
	name text not null,
	email text,
	phone text,
	role text,
	created_at timestamptz default now()
);

create table if not exists children (
	id text primary key,
	name text not null,
	age text,
	guardian_name text,
	guardian_contact text,
	class_category text,
	teacher_id text references teachers (id) on delete set null,
	last_status text,
	last_action_at timestamptz,
	notes text,
	created_at timestamptz default now()
);
```

Create `.env.local` (or copy from `.env.example`):

```bash
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

Restart the dev server after adding the env variables.

If you enable Row Level Security, add policies that allow your app to read and write:

```sql
alter table teachers enable row level security;
alter table children enable row level security;

create policy "Allow all teachers" on teachers
	for all using (true) with check (true);

create policy "Allow all children" on children
	for all using (true) with check (true);
```

## Notes

- If Supabase env keys are missing, the app uses localStorage (`celebkids-records-v1`).
- With Supabase configured, all records sync across devices.

## Troubleshooting

- If nothing saves to Supabase, confirm you created `.env.local` (not just `.env.example`) and restarted the dev server.
- If you see `permission denied` errors, enable the Row Level Security policies shown above.
- The app now surfaces Supabase error messages in the banner so you can see why a request failed.
