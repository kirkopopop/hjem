-- Private tasks: visible only to the person who created them. Shared is the default.
-- The wall tablet (device members) can only create shared tasks.
alter table public.tasks add column if not exists is_private boolean not null default false;

-- Who can see / change / delete: household members, but private tasks only by their creator.
drop policy if exists "tasks: members read" on public.tasks;
create policy "tasks: members read" on public.tasks for select to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));

drop policy if exists "tasks: members update" on public.tasks;
create policy "tasks: members update" on public.tasks for update to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())))
  with check (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));

drop policy if exists "tasks: members delete" on public.tasks;
create policy "tasks: members delete" on public.tasks for delete to authenticated
  using (public.is_household_member(household_id) and (not is_private or created_by = (select auth.uid())));

-- Before write: tablet tasks are always shared; private tasks belong to their creator.
create or replace function public.tasks_before_write()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare uid uuid := (select auth.uid()); picked_ok boolean := false;
begin
  new.updated_at := now();
  if new.is_private then
    if exists (select 1 from public.household_members d
               where d.user_id = new.created_by and d.household_id = new.household_id and d.role = 'device') then
      new.is_private := false;
    else
      new.assignee_id := new.created_by;
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    if new.completed_by is not null and exists (
         select 1 from public.household_members d
         where d.user_id = uid and d.household_id = new.household_id and d.role = 'device')
       and exists (
         select 1 from public.household_members p
         where p.user_id = new.completed_by and p.household_id = new.household_id and p.role <> 'device') then
      picked_ok := true;
    end if;
    if not picked_ok then new.completed_by := coalesce(uid, new.assignee_id); end if;
  elsif tg_op = 'UPDATE' and new.status <> 'done' and old.status = 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$function$;

-- After update: the next copy of a repeating task keeps its privacy; someone's private
-- tasks don't block the household "clean slate" badge.
create or replace function public.tasks_after_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare tz text; local_now timestamp; d date; streak int := 0; i int;
begin
  if new.status = 'done' and old.status <> 'done' and new.completed_by is not null then
    perform public.check_task_count_badges(new.household_id, new.completed_by);
    select timezone into tz from public.households where id = new.household_id;
    local_now := now() at time zone coalesce(tz, 'Europe/Copenhagen');
    if extract(hour from local_now) < 8 then perform public.award_badge(new.household_id, new.completed_by, 'early_bird'); end if;
    if extract(hour from local_now) >= 22 then perform public.award_badge(new.household_id, new.completed_by, 'night_owl'); end if;
    d := local_now::date;
    for i in 0..6 loop
      exit when not exists (
        select 1 from public.tasks
        where household_id = new.household_id and completed_by = new.completed_by and status = 'done'
          and (completed_at at time zone coalesce(tz, 'Europe/Copenhagen'))::date = d - i);
      streak := streak + 1;
    end loop;
    if streak >= 3 then perform public.award_badge(new.household_id, new.completed_by, 'streak_3'); end if;
    if streak >= 7 then perform public.award_badge(new.household_id, new.completed_by, 'streak_7'); end if;
    if not exists (select 1 from public.tasks where household_id = new.household_id and status <> 'done' and not is_private)
       and (select count(*) from public.tasks where household_id = new.household_id and status = 'done') >= 5 then
      perform public.award_badge(new.household_id, null, 'clean_slate');
    end if;
    if new.repeat is not null then
      insert into public.tasks (household_id, title, notes, status, assignee_id, due_date, repeat, priority, created_by, position, is_private)
      values (new.household_id, new.title, new.notes, 'todo', new.assignee_id,
        (coalesce(new.due_date, current_date) + public.task_repeat_interval(new.repeat))::date,
        new.repeat, new.priority, new.created_by, new.position, new.is_private);
    end if;
  end if;
  if old.assignee_id is null and new.assignee_id is not null
     and new.assignee_id = (select auth.uid()) and new.status <> 'done' then
    perform public.award_badge(new.household_id, new.assignee_id, 'claimer');
  end if;
  return new;
end;
$function$;
