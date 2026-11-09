-- Custom recurrence ("2w", "3m", "6m", "10d", "1y" …) alongside the legacy daily/weekly/monthly,
-- and a manual sort position for drag-to-reorder.
alter table public.tasks drop constraint if exists tasks_repeat_check;
alter table public.tasks add constraint tasks_repeat_check
  check (repeat in ('daily', 'weekly', 'monthly') or repeat ~ '^[1-9][0-9]{0,2}[dwmy]$');

alter table public.tasks add column if not exists position double precision;

-- Interval for a repeat rule.
create or replace function public.task_repeat_interval(r text)
returns interval
language sql
immutable
set search_path to ''
as $$
  select case
    when r = 'daily' then interval '1 day'
    when r = 'weekly' then interval '7 days'
    when r = 'monthly' then interval '1 month'
    when r ~ '^[0-9]+d$' then make_interval(days => left(r, -1)::int)
    when r ~ '^[0-9]+w$' then make_interval(weeks => left(r, -1)::int)
    when r ~ '^[0-9]+m$' then make_interval(months => left(r, -1)::int)
    when r ~ '^[0-9]+y$' then make_interval(years => left(r, -1)::int)
    else interval '7 days'
  end
$$;

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
    if not exists (select 1 from public.tasks where household_id = new.household_id and status <> 'done')
       and (select count(*) from public.tasks where household_id = new.household_id and status = 'done') >= 5 then
      perform public.award_badge(new.household_id, null, 'clean_slate');
    end if;
    if new.repeat is not null then
      insert into public.tasks (household_id, title, notes, status, assignee_id, due_date, repeat, priority, created_by, position)
      values (new.household_id, new.title, new.notes, 'todo', new.assignee_id,
        (coalesce(new.due_date, current_date) + public.task_repeat_interval(new.repeat))::date,
        new.repeat, new.priority, new.created_by, new.position);
    end if;
  end if;
  if old.assignee_id is null and new.assignee_id is not null
     and new.assignee_id = (select auth.uid()) and new.status <> 'done' then
    perform public.award_badge(new.household_id, new.assignee_id, 'claimer');
  end if;
  return new;
end;
$function$;
