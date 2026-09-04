import { getSupabaseClient } from './supabaseClient';
import { OrdemServico, OrdemServicoStatus } from './types';

const TABLE = 'ordens_servico';

function rowToOS(r: any): OrdemServico {
  return {
    id: String(r.id),
    numero: r.numero ?? undefined,
    clienteId: r.cliente_id ?? undefined,
    contratoId: r.contrato_id ?? undefined,
    tipo: (r.tipo || 'corretiva') as OrdemServico['tipo'],
    titulo: r.titulo ?? undefined,
    descricao: r.descricao ?? undefined,
    status: (r.status || 'aberta') as OrdemServicoStatus,
    prioridade: (r.prioridade || 'media') as OrdemServico['prioridade'],
    pendenciaIds: Array.isArray(r.pendencia_ids) ? r.pendencia_ids.map(String) : [],
    reportId: r.report_id ?? undefined,
    dataAbertura: r.data_abertura ?? undefined,
    dataPrevista: r.data_prevista ?? undefined,
    dataConclusao: r.data_conclusao ?? undefined,
    criadoPor: r.criado_por ?? undefined,
    tecnicoResponsavelId: r.tecnico_responsavel_id ?? undefined,
    sourcePedidoId: r.source_pedido_id ?? undefined,
    canceladaEm: r.cancelada_em ?? undefined,
    canceladaPor: r.cancelada_por ?? undefined,
    motivoCancelamento: r.motivo_cancelamento ?? undefined,
  };
}

/** Status considerados ATIVOS (uma OS ativa por Pedido). Espelha o índice
 *  único parcial de 0073 e o CHECK de 0033. */
export const OS_STATUS_ATIVOS: OrdemServicoStatus[] = ['aberta', 'agendada', 'em_execucao'];

/** Lifecycle (0074): só uma OS recém-'aberta' e virgem é elegível a HARD DELETE.
 *  Espelha a regra do banco (delete_os_if_unused). A ausência de evidência é
 *  validada transacionalmente no banco; aqui é só o gate de status para a UI. */
export function isHardDeleteEligible(os: Pick<OrdemServico, 'status'>): boolean {
  return os.status === 'aberta';
}

/** Cancelamento permitido para OS ATIVA (aberta/agendada/em_execucao). */
export function isCancelable(os: Pick<OrdemServico, 'status'>): boolean {
  return OS_STATUS_ATIVOS.includes(os.status);
}

/**
 * Histórico de OS de um Pedido pela identidade estrutural (sourcePedidoId →
 * pedidos.id), da mais recente para a mais antiga. Inclui canceladas/concluídas.
 * NUNCA relaciona por numero_pedido.
 */
export function osHistoryForPedido(ordens: OrdemServico[], pedidoId: string): OrdemServico[] {
  if (!pedidoId) return [];
  return ordens
    .filter((o) => o.sourcePedidoId === pedidoId)
    .sort((a, b) => {
      const da = a.dataAbertura || '';
      const db = b.dataAbertura || '';
      if (da !== db) return db.localeCompare(da);
      return (b.numero || b.id).localeCompare(a.numero || a.id);
    });
}

/**
 * Encontra a OS ATIVA de um Pedido pela IDENTIDADE ESTRUTURAL (sourcePedidoId →
 * pedidos.id). Puro e determinístico — usado pela UI e pelos testes. NUNCA casa
 * por numero_pedido (que não é único): dois pedidos com o mesmo numero_pedido
 * têm ids distintos e não podem ser confundidos.
 */
export function findActiveOsForPedido(
  ordens: OrdemServico[],
  pedidoId: string
): OrdemServico | undefined {
  if (!pedidoId) return undefined;
  return ordens.find(
    (o) => o.sourcePedidoId === pedidoId && OS_STATUS_ATIVOS.includes(o.status)
  );
}

/**
 * Ação canônica do Pedido em relação à sua OS (para o card de Pedidos).
 * Corrige o bug de "Gerar OS" reaparecer após a OS concluir: a decisão passa a
 * olhar TODAS as OS do pedido (não só a ativa).
 *   - 'none'       → nenhuma OS: oferecer "Gerar OS".
 *   - 'view'       → há OS ativa OU concluída: oferecer "Ver OS" (nunca gerar).
 *   - 'regenerate' → só existem OS canceladas: "Gerar nova OS" (explícito, §16).
 * Retorno técnico é NOVO ATENDIMENTO na mesma OS aberta — nunca nova OS (§18).
 */
export type PedidoOsAction =
  | { kind: 'none' }
  | { kind: 'view'; os: OrdemServico; concluded: boolean }
  | { kind: 'regenerate'; lastCancelled: OrdemServico };

export function pedidoOsAction(ordens: OrdemServico[], pedidoId: string): PedidoOsAction {
  const hist = osHistoryForPedido(ordens, pedidoId); // recente primeiro
  if (hist.length === 0) return { kind: 'none' };
  const active = hist.find((o) => OS_STATUS_ATIVOS.includes(o.status));
  if (active) return { kind: 'view', os: active, concluded: false };
  const concluded = hist.find((o) => o.status === 'concluida');
  if (concluded) return { kind: 'view', os: concluded, concluded: true };
  return { kind: 'regenerate', lastCancelled: hist[0] }; // só canceladas
}

function osToRow(o: OrdemServico): Record<string, unknown> {
  const row: Record<string, unknown> = {
    numero: o.numero ?? null,
    cliente_id: o.clienteId ?? null,
    contrato_id: o.contratoId ?? null,
    tipo: o.tipo ?? 'corretiva',
    titulo: o.titulo ?? null,
    descricao: o.descricao ?? null,
    status: o.status ?? 'aberta',
    prioridade: o.prioridade ?? 'media',
    pendencia_ids: o.pendenciaIds ?? [],
    report_id: o.reportId ?? null,
    data_prevista: o.dataPrevista ?? null,
    data_conclusao: o.dataConclusao ?? null,
    tecnico_responsavel_id: o.tecnicoResponsavelId ?? null,
    source_pedido_id: o.sourcePedidoId ?? null,
  };
  if (o.dataAbertura) row.data_abertura = o.dataAbertura;
  if (o.id) row.id = o.id;
  return row;
}

export async function fetchOrdensServico(filter?: {
  clienteId?: string;
  status?: OrdemServicoStatus | OrdemServicoStatus[];
}): Promise<OrdemServico[]> {
  const supabase = getSupabaseClient() as any;
  let query = supabase.from(TABLE).select('*').order('data_abertura', { ascending: false });
  if (filter?.clienteId) query = query.eq('cliente_id', filter.clienteId);
  if (filter?.status) {
    query = Array.isArray(filter.status)
      ? query.in('status', filter.status)
      : query.eq('status', filter.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToOS);
}

/** Gera o próximo número OS-AAAA-NNNN a partir das OS existentes do ano. */
export async function nextOsNumero(): Promise<string> {
  const ano = new Date().getFullYear();
  const supabase = getSupabaseClient() as any;
  const { data } = await supabase
    .from(TABLE)
    .select('numero')
    .like('numero', `OS-${ano}-%`);
  const maior = (data || []).reduce((max: number, r: any) => {
    const n = Number(String(r.numero || '').split('-')[2] || 0);
    return n > max ? n : max;
  }, 0);
  return `OS-${ano}-${String(maior + 1).padStart(4, '0')}`;
}

export async function createOrdemServico(o: OrdemServico): Promise<OrdemServico> {
  const supabase = getSupabaseClient() as any;
  const { id, ...rest } = osToRow(o);
  void id;
  const { data, error } = await supabase.from(TABLE).insert(rest).select().single();
  if (error) throw error;
  return rowToOS(data);
}

export async function updateOrdemServico(o: OrdemServico): Promise<OrdemServico> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.from(TABLE).update(osToRow(o)).eq('id', o.id).select().single();
  if (error) throw error;
  return rowToOS(data);
}

export async function updateOrdemServicoStatus(
  id: string,
  status: OrdemServicoStatus,
  extra?: { reportId?: string; dataConclusao?: string }
): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const patch: Record<string, unknown> = { status };
  if (extra?.reportId !== undefined) patch.report_id = extra.reportId;
  if (extra?.dataConclusao !== undefined) patch.data_conclusao = extra.dataConclusao;
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

export interface GetOrCreateOsResult {
  os: OrdemServico;
  /** true = OS recém-criada; false = já existia uma OS ativa deste Pedido. */
  created: boolean;
}

/**
 * Operação canônica e IDEMPOTENTE Pedido → OS. Recebe pedidos.id (identidade
 * estrutural) e delega ao banco (RPC get_or_create_os_from_pedido, 0073), que:
 * valida o pedido/permissão sob RLS, serializa concorrentes do mesmo pedido,
 * garante NO MÁXIMO UMA OS ativa e gera a numeração OS-AAAA-NNNN de forma
 * concorrente-segura. Segura para clique duplo / duas abas / requisições
 * simultâneas — a proteção real está no banco, não aqui.
 */
export async function getOrCreateOsFromPedido(
  pedidoId: string,
  opts?: {
    tipo?: OrdemServico['tipo'];
    prioridade?: OrdemServico['prioridade'];
    titulo?: string;
    descricao?: string;
    pendenciaIds?: string[];
  }
): Promise<GetOrCreateOsResult> {
  if (!pedidoId) throw new Error('Pedido de origem obrigatório para gerar a OS.');
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('get_or_create_os_from_pedido', {
    p_pedido_id: pedidoId,
    p_tipo: opts?.tipo ?? 'corretiva',
    p_prioridade: opts?.prioridade ?? 'media',
    p_titulo: opts?.titulo ?? null,
    p_descricao: opts?.descricao ?? null,
    p_pendencia_ids: opts?.pendenciaIds ?? [],
  });
  if (error) throw error;
  if (!data?.os) throw new Error('A geração da OS não retornou a ordem de serviço.');
  return { os: rowToOS(data.os), created: data.created === true };
}

/**
 * Cancela formalmente uma OS ativa (RPC cancel_os, 0074). Transacional no banco:
 * valida auth/papel/status e exige motivo. Preserva histórico e evidências.
 * Retorna a OS já com status 'cancelada' e os campos de cancelamento do servidor.
 */
export async function cancelOs(osId: string, motivo: string): Promise<OrdemServico> {
  if (!osId) throw new Error('OS obrigatória para cancelamento.');
  const trimmed = (motivo || '').trim();
  if (!trimmed) throw new Error('Motivo do cancelamento é obrigatório.');
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('cancel_os', { p_os_id: osId, p_motivo: trimmed });
  if (error) throw error;
  if (!data?.os) throw new Error('O cancelamento não retornou a OS atualizada.');
  return rowToOS(data.os);
}

/**
 * HARD DELETE de exceção para OS criada por engano e completamente virgem
 * (RPC delete_os_if_unused, 0074). O banco valida transacionalmente a AUSÊNCIA
 * de qualquer evidência operacional (relatório por ambos os caminhos, fotos,
 * comparações, execução de rotina, horas, financeiro) e o status. Se houver
 * qualquer vínculo, a RPC bloqueia e lança erro — nada é apagado em cascata.
 */
export async function deleteOsIfUnused(osId: string): Promise<{ numero?: string }> {
  if (!osId) throw new Error('OS obrigatória para exclusão.');
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.rpc('delete_os_if_unused', { p_os_id: osId });
  if (error) throw error;
  return { numero: data?.numero ?? undefined };
}

export async function deleteOrdemServico(id: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
