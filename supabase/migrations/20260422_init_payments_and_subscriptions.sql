-- JCCOFFEE: pedidos, pagamentos e assinaturas (Mercado Pago)

create extension if not exists "pgcrypto";

do $$ begin
  create type payment_method as enum ('pix', 'credit_card', 'boleto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum (
    'pending',
    'authorized',
    'approved',
    'failed',
    'refunded',
    'chargeback',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending_payment',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status order_status not null default 'pending_payment',
  currency text not null default 'BRL',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku text,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_price_cents integer not null check (total_price_cents >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_code text not null,
  plan_name text not null,
  amount_cents integer not null check (amount_cents > 0),
  provider text not null default 'mercado_pago',
  provider_subscription_id text unique,
  init_point text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'mercado_pago',
  provider_payment_id text unique,
  provider_charge_id text,
  method payment_method not null default 'credit_card',
  status payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  paid_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_payment_link check (order_id is not null or subscription_id is not null)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_subscription_id on public.payments(subscription_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_webhook_events_processed on public.webhook_events(processed);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select
using (auth.uid()::text = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert
with check (auth.uid()::text = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
    and o.user_id = auth.uid()::text
  )
);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select
using (auth.uid()::text = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select
using (auth.uid()::text = user_id);

drop policy if exists "webhook_events_block_client" on public.webhook_events;
create policy "webhook_events_block_client" on public.webhook_events for all
to authenticated
using (false)
with check (false);
