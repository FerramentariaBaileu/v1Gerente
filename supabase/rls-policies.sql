-- Revise os nomes das colunas com seu schema antes de executar no SQL Editor.
-- Estas políticas usam profiles.id = auth.users.id e profiles.role = 'admin'.

alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.finished_products enable row level security;
alter table public.semi_finished_items enable row level security;
alter table public.inventory_movements enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

create policy "usuario le o proprio perfil" on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy "autenticados consultam itens" on public.inventory_items
for select to authenticated using (true);
create policy "admin insere itens" on public.inventory_items
for insert to authenticated with check ((select public.is_current_user_admin()));
create policy "admin atualiza itens" on public.inventory_items
for update to authenticated using ((select public.is_current_user_admin())) with check ((select public.is_current_user_admin()));

create policy "autenticados consultam acabados" on public.finished_products
for select to authenticated using (true);
create policy "admin insere acabados" on public.finished_products
for insert to authenticated with check ((select public.is_current_user_admin()));
create policy "admin atualiza acabados" on public.finished_products
for update to authenticated using ((select public.is_current_user_admin())) with check ((select public.is_current_user_admin()));

create policy "autenticados consultam semiacabados" on public.semi_finished_items
for select to authenticated using (true);

create policy "autenticados consultam movimentos" on public.inventory_movements
for select to authenticated using (true);
create policy "admin registra movimentos" on public.inventory_movements
for insert to authenticated with check (
  (select public.is_current_user_admin()) and created_by = (select auth.uid())
);

grant usage on schema public to authenticated;
grant select on public.profiles, public.inventory_items, public.finished_products, public.semi_finished_items, public.inventory_movements to authenticated;
grant insert, update on public.inventory_items, public.finished_products to authenticated;
grant insert on public.inventory_movements to authenticated;
