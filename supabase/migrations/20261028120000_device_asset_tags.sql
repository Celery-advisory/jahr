-- Devices: permanent JA asset tags (e.g. JA-LT-0001), and optional serial
-- numbers so older devices with incomplete records can still be logged.

-- Serial numbers become optional. The unique constraint stays: Postgres
-- allows many NULLs, so only real serials must be unique.
alter table public.devices
  alter column serial_number drop not null;

-- One counter across all kinds, so every tag number is unique on its own.
create sequence if not exists public.device_asset_tag_seq;

create or replace function private.device_tag_prefix(kind public.asset_kind)
returns text
language sql
immutable
set search_path = ''
as $$
  select case kind
    when 'laptop' then 'LT'
    when 'monitor' then 'MN'
    when 'phone' then 'PH'
    when 'access_card' then 'AC'
    else 'OT'
  end;
$$;

-- Zero-pads to 4 digits but never truncates past 9999.
create or replace function private.device_asset_tag(kind public.asset_kind, n bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'JA-' || private.device_tag_prefix(kind) || '-'
    || lpad(n::text, greatest(4, length(n::text)), '0');
$$;

alter table public.devices
  add column if not exists asset_tag text;

-- Backfill existing devices in the order they were added.
with ordered as (
  select id, kind, row_number() over (order by created_at, id) as n
  from public.devices
  where asset_tag is null
)
update public.devices d
set asset_tag = private.device_asset_tag(o.kind, o.n)
from ordered o
where d.id = o.id;

select setval(
  'public.device_asset_tag_seq',
  greatest((select count(*) from public.devices), 1),
  (select count(*) from public.devices) > 0
);

alter table public.devices
  alter column asset_tag set not null,
  add constraint devices_asset_tag_unique unique (asset_tag);

-- Tags are assigned by the database and never change, even if the kind is
-- edited later. SECURITY DEFINER so callers need no sequence privileges.
create or replace function private.devices_assign_asset_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.asset_tag := private.device_asset_tag(
      new.kind,
      nextval('public.device_asset_tag_seq')
    );
  else
    new.asset_tag := old.asset_tag;
  end if;
  return new;
end;
$$;

revoke all on function private.devices_assign_asset_tag() from public;

create trigger devices_assign_asset_tag
  before insert or update on public.devices
  for each row execute function private.devices_assign_asset_tag();
