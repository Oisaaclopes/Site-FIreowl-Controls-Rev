-- =====================================================================
-- COMERCIAL — Unidades de medida canônicas (siglas).
--
-- Fonte de verdade em código: lib/commercialUnits.ts (COMMERCIAL_UNITS).
-- Esta migração:
--   1) normaliza aliases previsíveis de inventory_items.unit → sigla canônica;
--   2) adiciona services.unit (unidade canônica do serviço; NULL = 'vb' no app).
--
-- Garantias:
--   - IDEMPOTENTE: reexecutar não altera valores já canônicos;
--   - NÃO-DESTRUTIVA: valores desconhecidos são PRESERVADOS (não descartados,
--     não adivinhados). Ver o SELECT de auditoria ao final para revisá-los;
--   - snapshot comercial: propostas em pedidos.proposal (JSONB) NÃO são tocadas
--     — cada item já guarda a própria unidade. Documento histórico não muda.
--
-- Requer: 0002 (inventory_items), 0030 (services). Migração 0065 falhou
-- historicamente e NÃO deve ser reaplicada; esta é 0078.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Normalização de inventory_items.unit (só aliases seguros/conhecidos).
--    Compara por lower(btrim(unit)); também cobre o padrão "SIGLA - Descrição"
--    reduzindo ao trecho antes do traço.
-- ---------------------------------------------------------------------
do $$
declare
  -- pares alias(canônico): cada linha mapeia um conjunto de aliases → sigla.
  r record;
begin
  -- Reduz "UN - Unidade", "m - Metro" etc. ao token antes do primeiro traço.
  update public.inventory_items
     set unit = btrim(split_part(unit, '-', 1))
   where unit is not null
     and position('-' in unit) > 0
     and btrim(split_part(unit, '-', 1)) <> '';

  -- Mapa alias → canônico (case-insensitive, sem espaços nas pontas).
  for r in
    select * from (values
      (array['un','und','unid','uni','unidade','unidades'], 'un'),
      (array['pc','pca','peca','pecas','pç','peça','peças'], 'pç'),
      (array['cx','caixa','caixas'], 'cx'),
      (array['pct','pacote','pacotes'], 'pct'),
      (array['rolo','rolos','rl'], 'rolo'),
      (array['par','pares'], 'par'),
      (array['kit','kits','conj','conjunto'], 'kit'),
      (array['m','metro','metros','mt','mts'], 'm'),
      (array['cm','centimetro','centimetros','centímetro','centímetros'], 'cm'),
      (array['mm','milimetro','milimetros','milímetro','milímetros'], 'mm'),
      (array['km','quilometro','quilometros','quilômetro','quilômetros'], 'km'),
      (array['m2','m²','metro2','metroquadrado','mq'], 'm²'),
      (array['m3','m³','metrocubico','metrocúbico'], 'm³'),
      (array['l','litro','litros','lt','lts'], 'L'),
      (array['ml','mililitro','mililitros'], 'mL'),
      (array['kg','quilo','quilos','quilograma','quilogramas','kgs','kilo'], 'kg'),
      (array['g','grama','gramas','gr'], 'g'),
      (array['h','hora','horas','hr','hrs'], 'h'),
      (array['dia','dias','diaria','diarias','diária','diárias'], 'dia'),
      (array['visita','visitas','vst'], 'visita'),
      (array['vb','verba','verbas'], 'vb')
    ) as t(aliases, canonico)
  loop
    update public.inventory_items i
       set unit = r.canonico
     where i.unit is not null
       and lower(btrim(i.unit)) = any (r.aliases)
       and i.unit <> r.canonico; -- evita update no-op (mantém idempotência limpa)
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) services.unit — unidade canônica do serviço.
--    Sem backfill: NULL é tratado como 'vb' (verba) na aplicação
--    (normalizeUnitCode(svc.unit || 'vb')). Não assumimos valores distintos.
-- ---------------------------------------------------------------------
alter table public.services add column if not exists unit text;

comment on column public.services.unit is
  'Unidade de medida canônica (sigla) do serviço. NULL = ''vb'' (fallback histórico). Ver lib/commercialUnits.ts.';

-- ---------------------------------------------------------------------
-- AUDITORIA (não altera dados) — lista unidades de estoque que ficaram FORA do
-- catálogo canônico, para revisão manual. Rode e confira antes de considerar
-- concluída a padronização; normalize os remanescentes caso a caso.
-- ---------------------------------------------------------------------
--   select unit, count(*)
--     from public.inventory_items
--    where unit is not null
--      and unit not in ('un','pç','cx','pct','rolo','par','kit','m','cm','mm','km',
--                       'm²','m³','L','mL','kg','g','h','dia','visita','vb')
--    group by unit order by count(*) desc;
