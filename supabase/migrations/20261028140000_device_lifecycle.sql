-- Device lifecycle: managed categories, purchase/warranty/location fields,
-- per-type specs, an activity timeline, file attachments, and device status
-- kept in sync with assignments by the database.

-- ---------------------------------------------------------------------------
-- 1. Status follows assignments
-- ---------------------------------------------------------------------------

-- Repair rows where status and assignments disagree (seed data marked some
-- devices assigned without an assignment record).
update public.devices d
set status = 'available'
where d.status = 'assigned'
  and not exists (
    select 1 from public.device_assignments a
    where a.device_id = d.id and a.returned_at is null
  );

update public.devices d
set status = 'assigned'
where d.status <> 'assigned'
  and exists (
    select 1 from public.device_assignments a
    where a.device_id = d.id and a.returned_at is null
  );

-- An open assignment means "assigned"; closing it returns the device to
-- "available" unless it was already moved to repair/retired.
create or replace function private.sync_device_status_from_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.device_id, old.device_id);
  has_open boolean;
begin
  select exists (
    select 1 from public.device_assignments
    where device_id = target and returned_at is null
  ) into has_open;

  if has_open then
    update public.devices set status = 'assigned'
    where id = target and status <> 'assigned';
  else
    update public.devices set status = 'available'
    where id = target and status = 'assigned';
  end if;

  return null;
end;
$$;

revoke all on function private.sync_device_status_from_assignments() from public;

create trigger device_assignments_sync_status
  after insert or update of returned_at or delete on public.device_assignments
  for each row execute function private.sync_device_status_from_assignments();

-- Reject status edits that contradict the assignment record.
create or replace function private.guard_device_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_open boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select exists (
    select 1 from public.device_assignments
    where device_id = new.id and returned_at is null
  ) into has_open;

  if new.status = 'assigned' and not has_open then
    raise exception 'Device % has no open assignment, so it cannot be marked assigned.', new.id;
  end if;
  if new.status <> 'assigned' and has_open then
    raise exception 'Return device % before changing its status.', new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_device_status() from public;

create trigger devices_guard_status
  before insert or update of status on public.devices
  for each row execute function private.guard_device_status();

-- ---------------------------------------------------------------------------
-- 2. Managed categories
-- ---------------------------------------------------------------------------

create table public.device_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag_prefix text not null,
  -- Decides which extra spec fields the form shows (see lib/devices/types.ts).
  template text not null default 'other',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint device_categories_name_key unique (name),
  constraint device_categories_tag_prefix_key unique (tag_prefix),
  constraint device_categories_name_not_blank check (char_length(trim(name)) > 0),
  constraint device_categories_tag_prefix_format check (tag_prefix ~ '^[A-Z]{2,4}$'),
  constraint device_categories_template_check check (
    template in (
      'computer', 'phone', 'tablet', 'monitor', 'accessory',
      'access_card', 'sim', 'vehicle', 'other'
    )
  )
);

insert into public.device_categories (name, tag_prefix, template, sort_order)
values
  ('Laptop', 'LT', 'computer', 10),
  ('Desktop', 'DT', 'computer', 20),
  ('Phone', 'PH', 'phone', 30),
  ('Tablet', 'TB', 'tablet', 40),
  ('Monitor', 'MN', 'monitor', 50),
  ('Keyboard & mouse', 'KB', 'accessory', 60),
  ('Headset', 'HS', 'accessory', 70),
  ('Dock', 'DK', 'accessory', 80),
  ('Access card', 'AC', 'access_card', 90),
  ('SIM card', 'SM', 'sim', 100),
  ('Vehicle', 'VH', 'vehicle', 110),
  ('Other', 'OT', 'other', 120);

alter table public.device_categories enable row level security;

grant select, insert, update, delete on table public.device_categories
  to authenticated, service_role;

-- Everyone signed in can read names (profiles show "Laptop · MacBook Pro").
create policy device_categories_select
  on public.device_categories for select to authenticated
  using (true);

create policy device_categories_write_admin
  on public.device_categories for all to authenticated
  using (private.is_org_admin())
  with check (private.is_org_admin());

alter table public.devices
  add column category_id uuid references public.device_categories (id) on delete restrict;

update public.devices d
set category_id = c.id
from public.device_categories c
where d.category_id is null
  and c.tag_prefix = case d.kind
    when 'laptop' then 'LT'
    when 'monitor' then 'MN'
    when 'phone' then 'PH'
    when 'access_card' then 'AC'
    else 'OT'
  end;

alter table public.devices
  alter column category_id set not null;

create index devices_category_id_idx on public.devices (category_id);

-- New tags use the category prefix. Existing tags never change. The legacy
-- `kind` column is kept in step with the category template for older reads.
create or replace function private.devices_assign_asset_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category record;
  n bigint;
begin
  select tag_prefix, template into category
  from public.device_categories
  where id = new.category_id;

  if not found then
    raise exception 'Unknown device category %.', new.category_id;
  end if;

  new.kind := case category.template
    when 'computer' then 'laptop'
    when 'phone' then 'phone'
    when 'monitor' then 'monitor'
    when 'access_card' then 'access_card'
    else 'other'
  end::public.asset_kind;

  if tg_op = 'INSERT' then
    n := nextval('public.device_asset_tag_seq');
    new.asset_tag := 'JA-' || category.tag_prefix || '-'
      || lpad(n::text, greatest(4, length(n::text)), '0');
  else
    new.asset_tag := old.asset_tag;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Purchase, warranty, location, condition and specs
-- ---------------------------------------------------------------------------

alter table public.devices
  add column purchase_cost numeric(14, 2),
  add column purchase_currency text,
  add column supplier text,
  add column order_number text,
  add column legal_entity_id uuid references public.legal_entities (id) on delete set null,
  add column warranty_expires_at date,
  add column location text,
  add column condition text,
  add column specs jsonb not null default '{}'::jsonb,
  add constraint devices_purchase_cost_non_negative check (purchase_cost is null or purchase_cost >= 0),
  add constraint devices_condition_check check (
    condition is null or condition in ('new', 'good', 'fair', 'poor', 'damaged')
  ),
  add constraint devices_specs_object check (jsonb_typeof(specs) = 'object');

create index devices_warranty_expires_at_idx on public.devices (warranty_expires_at);

alter table public.device_assignments
  add column condition_out text,
  add column condition_in text,
  add constraint device_assignments_condition_out_check check (
    condition_out is null or condition_out in ('new', 'good', 'fair', 'poor', 'damaged')
  ),
  add constraint device_assignments_condition_in_check check (
    condition_in is null or condition_in in ('new', 'good', 'fair', 'poor', 'damaged')
  );

-- ---------------------------------------------------------------------------
-- 4. Activity timeline
-- ---------------------------------------------------------------------------

create table public.device_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  kind text not null,
  summary text not null,
  details text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint device_events_kind_check check (
    kind in ('created', 'updated', 'assigned', 'returned', 'status', 'note', 'file', 'offboarding')
  )
);

create index device_events_device_id_idx on public.device_events (device_id, created_at desc);

alter table public.device_events enable row level security;

grant select, insert, update, delete on table public.device_events
  to authenticated, service_role;

create policy device_events_admin
  on public.device_events for all to authenticated
  using (private.is_org_admin())
  with check (private.is_org_admin());

-- ---------------------------------------------------------------------------
-- 5. Files (invoices, photos, wipe certificates)
-- ---------------------------------------------------------------------------

create table public.device_files (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  label text not null default 'other',
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_key text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint device_files_label_check check (label in ('invoice', 'photo', 'warranty', 'other'))
);

create index device_files_device_id_idx on public.device_files (device_id);

alter table public.device_files enable row level security;

grant select, insert, update, delete on table public.device_files
  to authenticated, service_role;

create policy device_files_admin
  on public.device_files for all to authenticated
  using (private.is_org_admin())
  with check (private.is_org_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'devices',
  'devices',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy devices_storage_select
  on storage.objects for select to authenticated
  using (bucket_id = 'devices' and private.is_org_admin());

create policy devices_storage_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'devices' and private.is_org_admin());

create policy devices_storage_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'devices' and private.is_org_admin());
