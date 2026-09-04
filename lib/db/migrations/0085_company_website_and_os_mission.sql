-- ETAPA 3B.1 — dados institucionais (website) + Missão da OS SEM PREÇOS.
--
-- Duas mudanças pequenas e não-destrutivas:
--   1. company_profile.website: fonte canônica única do site institucional
--      (Configurações → Empresa). Antes NÃO existia; documentos comerciais
--      passam a lê-la em vez de hardcodar o domínio.
--   2. get_os_mission(os_id): a RLS de `pedidos` libera SELECT apenas para
--      ADMINISTRATIVO/GESTOR/FINANCEIRO — o TÉCNICO não lê pedidos. Para mostrar
--      "o que foi contratado" ao técnico (§18–§22) sem expor preço/custo/margem,
--      esta função SECURITY DEFINER devolve SOMENTE serviços/materiais/
--      responsabilidades, campo a campo, NUNCA valores. O payload do técnico
--      não carrega dado comercial (não é esconder por CSS).
--
-- Requer: 0009? (company_profile), 0008 (pedidos), 0033/0073 (ordens_servico),
-- 0005 (auth_role). Idempotente. NÃO edita/reaplica 0083/0084.

-- 1) Fonte canônica do site institucional -----------------------------------
alter table public.company_profile
  add column if not exists website text;

comment on column public.company_profile.website is
  'Site institucional (ex.: www.fireowlcontrols.com.br). Fonte única usada pelos '
  'documentos comerciais; nunca hardcodar o domínio nos templates.';

-- 2) Missão da OS sem preços (price-free) -----------------------------------
create or replace function public.get_os_mission(p_os_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_os       public.ordens_servico%rowtype;
  v_prop     jsonb;
  v_services jsonb;
  v_materials jsonb;
  v_resp     jsonb;
  v_ofertas  jsonb;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;

  select * into v_os from public.ordens_servico where id = p_os_id;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  -- Autorização explícita: gestão OU o técnico responsável pela própria OS.
  if not (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or v_os.tecnico_responsavel_id = auth.uid()
  ) then
    raise exception 'sem acesso a esta OS';
  end if;

  -- Sem pedido de origem: fallback é a própria descrição da OS (§36).
  if v_os.source_pedido_id is null then
    return jsonb_build_object(
      'found', true, 'source', 'os',
      'osNumero', v_os.numero, 'osTitulo', v_os.titulo, 'osDescricao', v_os.descricao,
      'services', '[]'::jsonb, 'materials', '[]'::jsonb,
      'responsibilities', '[]'::jsonb, 'servicosOfertados', '[]'::jsonb
    );
  end if;

  select proposal into v_prop from public.pedidos where id = v_os.source_pedido_id;
  if v_prop is null then
    v_prop := '{}'::jsonb;
  end if;

  -- Mapeia SÓ os campos seguros de cada item. precoUnitario/desconto e quaisquer
  -- outros campos comerciais NÃO são copiados — nem chegam ao cliente.
  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', e->>'descricao',
           'descricaoDetalhada', e->>'descricaoDetalhada',
           'marcaModelo', e->>'marcaModelo',
           'quantidade', (e->>'quantidade'),
           'unidade', e->>'unidade'
         )), '[]'::jsonb)
    into v_services
    from jsonb_array_elements(coalesce(v_prop->'equipmentItems','[]'::jsonb)) e
   where (e->>'tipo') = 'servico';

  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', e->>'descricao',
           'descricaoDetalhada', e->>'descricaoDetalhada',
           'marcaModelo', e->>'marcaModelo',
           'quantidade', (e->>'quantidade'),
           'unidade', e->>'unidade'
         )), '[]'::jsonb)
    into v_materials
    from jsonb_array_elements(coalesce(v_prop->'equipmentItems','[]'::jsonb)) e
   where coalesce(e->>'tipo','material') <> 'servico';

  v_resp := coalesce(v_prop->'responsabilidadesContratada', '[]'::jsonb);
  if jsonb_typeof(v_resp) <> 'array' then v_resp := '[]'::jsonb; end if;

  v_ofertas := coalesce(v_prop->'servicosOfertados', '[]'::jsonb);
  if jsonb_typeof(v_ofertas) <> 'array' then v_ofertas := '[]'::jsonb; end if;

  return jsonb_build_object(
    'found', true, 'source', 'pedido',
    'osNumero', v_os.numero, 'osTitulo', v_os.titulo, 'osDescricao', v_os.descricao,
    'services', v_services,
    'materials', v_materials,
    'responsibilities', v_resp,
    'servicosOfertados', v_ofertas
  );
end;
$$;

revoke all on function public.get_os_mission(uuid) from public;
grant execute on function public.get_os_mission(uuid) to authenticated;
