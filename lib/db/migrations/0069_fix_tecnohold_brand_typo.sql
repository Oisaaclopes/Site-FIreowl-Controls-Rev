-- Corrige o cadastro incorreto "TECHNOHOLD" (com H adicional) sem apagar produtos.
-- A marca oficial neste projeto é "Tecnohold".
update public.inventory_items set brand = 'Tecnohold'
where lower(trim(coalesce(brand, ''))) = 'technohold';

update public.devices set fabricante = 'Tecnohold'
where lower(trim(coalesce(fabricante, ''))) = 'technohold';

update public.suppliers s
set brands = (
  select coalesce(array_agg(distinct case when lower(trim(b)) = 'technohold' then 'Tecnohold' else b end), '{}')
  from unnest(s.brands) b
)
where exists (select 1 from unnest(s.brands) b where lower(trim(b)) = 'technohold');

delete from public.brands where lower(trim(name)) = 'technohold';
