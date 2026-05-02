-- Profils applicatifs et exercices. Exécuter via Supabase CLI ou coller dans SQL Editor.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  usage_count integer not null default 0
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  contenu jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.exercises enable row level security;

create policy "Lecture du profil par le propriétaire"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Mise à jour du profil par le propriétaire"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Lecture des exercices par le propriétaire"
  on public.exercises
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Création d'exercices par le propriétaire"
  on public.exercises
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Mise à jour des exercices par le propriétaire"
  on public.exercises
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Suppression des exercices par le propriétaire"
  on public.exercises
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, update on table public.users to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, plan, usage_count)
  values (new.id, coalesce(new.email, ''), 'free', 0);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = coalesce(new.email, '')
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_update();
