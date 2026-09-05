-- ETAPA 3D.5 — Normalização da taxonomia de grupo SDAI na Base Técnica (§44/§45).
--
-- A 3D.5 renomeou a classificação Fireowl 'Central' → 'Central SDAI' e
-- 'Repetidora' → 'Repetidora de SDAI' para desfazer a ambiguidade com a
-- "Central de Alarme" em contextos multidisciplinares. Esta migration alinha os
-- devices JÁ gravados com a nova taxonomia canônica.
--
-- SEGURANÇA:
--   • Só toca `devices` (Base Técnica). NÃO altera technical_catalog/inventory
--     (nomes comerciais preservados — o frontend usa legacyGroupLabel p/ exibir).
--   • Filtra POR ÁREA (sistema='SDAI') e por valor EXATO — NUNCA renomeia
--     "Central" de ALARME/BMS.
--   • Idempotente: reexecutar não causa efeito (valores já normalizados não casam).
--   • Não apaga nem move ativos; preserva histórico/verificações.
--
-- Requer 0094 (devices.grupo). NÃO edita migrações aplicadas (0094–0098).
-- O frontend degrada seguro ANTES desta migration (legacyGroupLabel em leitura),
-- então aplicar é recomendado porém não bloqueante.

update public.devices
   set grupo = 'Central SDAI'
 where sistema = 'SDAI' and grupo = 'Central';

update public.devices
   set grupo = 'Repetidora de SDAI'
 where sistema = 'SDAI' and grupo = 'Repetidora';

-- Auditoria (rodar manualmente p/ conferir quantidades antes/depois):
--   select grupo, count(*) from public.devices where sistema='SDAI' group by grupo order by grupo;
