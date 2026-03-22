-- Allow flexible PRTG auth per server: API token or username/passhash
alter table public.prtg_servers
  alter column api_token drop not null;

alter table public.prtg_servers
  add column if not exists username text,
  add column if not exists passhash text;
