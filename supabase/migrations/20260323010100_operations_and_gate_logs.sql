create table if not exists public.operation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  executor text not null,
  lead_person text not null,
  supervisor text not null,
  unit text not null,
  work_content text not null,
  start_time time not null,
  end_time time,
  result_content text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gate_open_logs (
  id uuid primary key default gen_random_uuid(),
  contact_first_name text not null,
  contact_last_name text not null,
  unit text not null,
  ip_source text not null,
  ip_dest text not null,
  port text not null,
  usage_time text not null,
  basis text not null,
  work_content text not null,
  opened_by text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_operation_tasks_updated_at on public.operation_tasks;
create trigger trg_operation_tasks_updated_at
before update on public.operation_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_gate_open_logs_updated_at on public.gate_open_logs;
create trigger trg_gate_open_logs_updated_at
before update on public.gate_open_logs
for each row execute function public.set_updated_at();

alter table public.operation_tasks enable row level security;
alter table public.gate_open_logs enable row level security;

create policy "operation_tasks_authenticated_all"
on public.operation_tasks
for all
to authenticated
using (true)
with check (true);

create policy "gate_open_logs_authenticated_all"
on public.gate_open_logs
for all
to authenticated
using (true)
with check (true);
