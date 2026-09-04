import { getSupabaseClient } from './supabaseClient';
import { CommercialProposalData, OrdemServico } from './types';

/* ===================================================================
 * ETAPA 3B.1 — "Missão da OS": o que o técnico veio fazer, derivado da origem
 * (Pedido) SEM QUALQUER dado comercial (preço/custo/margem/desconto). A leitura
 * do técnico usa a RPC get_os_mission (SECURITY DEFINER) porque a RLS de
 * `pedidos` não libera o técnico; a gestão pode montar localmente a partir do
 * Pedido já em memória. Ambos os caminhos produzem o MESMO view-model. §18–§22.
 * =================================================================== */

export interface OsMissionItem {
  descricao: string;
  descricaoDetalhada?: string;
  marcaModelo?: string;
  quantidade?: number;
  unidade?: string;
}

export interface OsMission {
  found: boolean;
  /** 'pedido' = derivada do Pedido de origem; 'os' = fallback pela descrição. */
  source: 'pedido' | 'os';
  osNumero?: string;
  osTitulo?: string;
  osDescricao?: string;
  services: OsMissionItem[];
  materials: OsMissionItem[];
  responsibilities: string[];
  /** Blocos "Serviços ofertados" (título + itens) quando a proposta os tiver. */
  servicosOfertados: { titulo: string; itens: string[] }[];
}

const EMPTY_MISSION: OsMission = {
  found: false, source: 'os', services: [], materials: [], responsibilities: [], servicosOfertados: [],
};

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Mapeia UM item do Pedido para o view-model do técnico, descartando preço. */
function toMissionItem(e: any): OsMissionItem {
  return {
    descricao: String(e?.descricao || '').trim(),
    descricaoDetalhada: e?.descricaoDetalhada ? String(e.descricaoDetalhada) : undefined,
    marcaModelo: e?.marcaModelo ? String(e.marcaModelo) : undefined,
    quantidade: num(e?.quantidade),
    unidade: e?.unidade ? String(e.unidade) : undefined,
  };
}

/**
 * Deriva a Missão a partir da proposta do Pedido (caminho da GESTÃO, dados já em
 * memória). PURO e testável. NUNCA copia precoUnitario/desconto/valores — o
 * view-model resultante simplesmente não os contém.
 */
export function buildOsMissionFromProposal(
  proposal: CommercialProposalData | undefined,
  os?: Pick<OrdemServico, 'numero' | 'titulo' | 'descricao' | 'sourcePedidoId'>
): OsMission {
  const items = Array.isArray(proposal?.equipmentItems) ? proposal!.equipmentItems : [];
  const services = items.filter((e) => e?.tipo === 'servico').map(toMissionItem).filter((i) => i.descricao);
  const materials = items.filter((e) => (e?.tipo || 'material') !== 'servico').map(toMissionItem).filter((i) => i.descricao);
  const responsibilities = Array.isArray(proposal?.responsabilidadesContratada)
    ? proposal!.responsabilidadesContratada.filter((s) => (s || '').trim())
    : [];
  const servicosOfertados = Array.isArray(proposal?.servicosOfertados)
    ? proposal!.servicosOfertados
        .filter((b) => b && (b.titulo || (b.itens || []).length))
        .map((b) => ({ titulo: b.titulo || '', itens: (b.itens || []).filter((i) => (i || '').trim()) }))
    : [];

  const hasPedido = Boolean(os?.sourcePedidoId);
  return {
    found: true,
    source: hasPedido ? 'pedido' : 'os',
    osNumero: os?.numero,
    osTitulo: os?.titulo,
    osDescricao: os?.descricao,
    services,
    materials,
    responsibilities,
    servicosOfertados,
  };
}

function fromRpc(data: any): OsMission {
  if (!data || data.found !== true) return EMPTY_MISSION;
  const items = (arr: any): OsMissionItem[] =>
    (Array.isArray(arr) ? arr : []).map(toMissionItem).filter((i) => i.descricao);
  return {
    found: true,
    source: data.source === 'pedido' ? 'pedido' : 'os',
    osNumero: data.osNumero ?? undefined,
    osTitulo: data.osTitulo ?? undefined,
    osDescricao: data.osDescricao ?? undefined,
    services: items(data.services),
    materials: items(data.materials),
    responsibilities: Array.isArray(data.responsibilities)
      ? data.responsibilities.filter((s: any) => (s || '').toString().trim())
      : [],
    servicosOfertados: Array.isArray(data.servicosOfertados)
      ? data.servicosOfertados
          .filter((b: any) => b && (b.titulo || (b.itens || []).length))
          .map((b: any) => ({ titulo: b.titulo || '', itens: (b.itens || []).filter((i: any) => (i || '').trim()) }))
      : [],
  };
}

/**
 * Missão da OS pela RPC price-free (caminho do TÉCNICO e também válido p/ gestão).
 * O servidor valida acesso (técnico responsável ou gestão) e NUNCA devolve preço.
 * Em falha/negação, retorna uma missão vazia — a UI cai no fallback de descrição.
 */
export async function fetchOsMission(osId: string): Promise<OsMission> {
  if (!osId) return EMPTY_MISSION;
  try {
    const supabase = getSupabaseClient() as any;
    const { data, error } = await supabase.rpc('get_os_mission', { p_os_id: osId });
    if (error) return EMPTY_MISSION;
    return fromRpc(data);
  } catch {
    return EMPTY_MISSION;
  }
}

/** Há algo estruturado para mostrar (serviços/materiais/responsabilidades)? */
export function missionHasContent(m: OsMission): boolean {
  return m.services.length > 0 || m.materials.length > 0 || m.responsibilities.length > 0 || m.servicosOfertados.length > 0;
}
