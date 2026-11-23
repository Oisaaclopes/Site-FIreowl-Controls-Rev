import type { NotaFiscalItem, NotaFiscalLembrete, NotaFiscalStatus, NotaFiscalTipo, Pedido, UserRole } from './types';

/**
 * Lembrete administrativo de Nota Fiscal.
 *
 * NÃO é emissão de NF-e nem integração com a SEFAZ — é uma pendência simples:
 * quando um pedido comercial elegível é CONCLUÍDO, o Administrativo/Financeiro/
 * Gestor é lembrado de "Emitir nota fiscal". O técnico NUNCA vê nem gere isso.
 *
 * A identidade da pendência é o PRÓPRIO pedido (o estado mora em
 * `proposal.notaFiscal`, JSONB) — portanto é idempotente por construção:
 * reabrir/reprocessar/concluir de novo não cria uma segunda pendência para o
 * mesmo fato gerador.
 */

/** Quem vê e resolve a pendência de NF (NUNCA o TÉCNICO). §7/§12. */
export const canManageNotaFiscal = (role: UserRole): boolean =>
  role === 'ADMINISTRATIVO' || role === 'FINANCEIRO' || role === 'GESTOR';

/** Valor de referência do pedido para a NF (espelha `valor_total`). */
export const pedidoValorNota = (p: Pedido): number => Number(p.proposal?.valorTotal || 0);

/**
 * Fato gerador de NF: pedido CONCLUÍDO, com valor e NÃO recorrente.
 *
 * §11 — não assumimos que toda conclusão precisa de NF: contrato recorrente
 * (mensal) fatura por competência, não por conclusão; garantia/retorno/OS
 * interna podem não gerar cobrança — esses casos são fechados pelo
 * Administrativo com "Não aplicável", não por regra financeira automática.
 */
export const isNotaFiscalElegivel = (p: Pedido): boolean =>
  p.status === 'concluido' && pedidoValorNota(p) > 0 && p.proposal?.recorrente !== true;

/** Estado atual (default 'pendente' quando elegível e ainda sem registro). */
export const notaFiscalStatus = (p: Pedido): NotaFiscalStatus =>
  p.proposal?.notaFiscal?.status || 'pendente';

/** Pendência de NF ABERTA: elegível e ainda não resolvida. */
export const isNotaFiscalPendente = (p: Pedido): boolean =>
  isNotaFiscalElegivel(p) && notaFiscalStatus(p) === 'pendente';

/** Pendências abertas, mais recentes primeiro (para a lista administrativa). */
export const notaFiscalPendencias = (pedidos: Pedido[]): Pedido[] =>
  pedidos
    .filter(isNotaFiscalPendente)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

/**
 * Semeia a pendência ao concluir — sinaliza sem emitir.
 *
 * Idempotente: se já existe QUALQUER registro de NF (pendente/emitida/não
 * aplicável), não sobrescreve; se o pedido não é elegível, devolve intacto.
 * Assim, concluir de novo nunca reabre uma NF já emitida nem duplica.
 */
export const semearNotaFiscalAoConcluir = (p: Pedido): Pedido => {
  if (!isNotaFiscalElegivel(p)) return p;
  if (p.proposal?.notaFiscal) return p;
  return {
    ...p,
    proposal: { ...p.proposal, notaFiscal: { status: 'pendente', criadaEm: new Date().toISOString() } },
  };
};

/**
 * Aplica uma resolução preservando o histórico do registro anterior.
 * Usado para "Emitida" (com número/data), "Não aplicável" e reabrir.
 */
export const aplicarNotaFiscal = (
  p: Pedido,
  patch: Partial<NotaFiscalLembrete> & { status: NotaFiscalStatus },
  autor?: string,
): Pedido => {
  const anterior = p.proposal?.notaFiscal || {};
  const notaFiscal: NotaFiscalLembrete = {
    ...anterior,
    ...patch,
    atualizadaEm: new Date().toISOString(),
    ...(autor ? { atualizadaPor: autor } : {}),
  };
  return { ...p, proposal: { ...p.proposal, notaFiscal } };
};

/**
 * Pode registrar a NF manualmente na linha do pedido? A NF pode sair ANTES da
 * conclusão (faturamento antecipado), então vale a partir de ACEITO.
 *
 * Registro MANUAL vale também para pedido RECORRENTE (a NF de um contrato
 * mensal pode e deve ser informada). Só o lembrete AUTOMÁTICO
 * (isNotaFiscalElegivel / semear ao concluir) continua excluindo recorrente,
 * porque contrato fatura por competência e não por conclusão (§11).
 */
export const podeInformarNotaFiscal = (p: Pedido): boolean =>
  (p.status === 'aceito' || p.status === 'concluido') &&
  pedidoValorNota(p) > 0;

// ─── Várias notas por pedido (serviço / material) ───────────────────────────

export const NOTA_TIPO_LABEL: Record<NotaFiscalTipo, string> = { servico: 'Serviço', material: 'Material' };
export const NOTA_TIPO_SIGLA: Record<NotaFiscalTipo, string> = { servico: 'NFS-e', material: 'NF-e' };

/** Tipo sugerido para a primeira nota, pela modalidade comercial do pedido. */
export const tipoNotaPadrao = (p: Pedido): NotaFiscalTipo =>
  p.proposal?.modalidade === 'somente_material' ? 'material' : 'servico';

/**
 * Notas do pedido. `notaFiscal.notas` presente = fonte de verdade.
 * Registro LEGADO (nota única nos campos de topo) vira uma nota sintética:
 * chave de 44 dígitos = NF-e (material); senão, tipo pela modalidade.
 */
export const notasDoPedido = (p: Pedido): NotaFiscalItem[] => {
  const nf = p.proposal?.notaFiscal;
  if (!nf) return [];
  if (Array.isArray(nf.notas)) return nf.notas;
  if (nf.status !== 'emitida') return [];
  const tipo: NotaFiscalTipo = /^\d{44}$/.test(nf.chaveAcesso || '') ? 'material' : tipoNotaPadrao(p);
  return [{
    id: 'legado',
    tipo,
    numero: nf.numero,
    dataEmissao: nf.dataEmissao,
    chaveAcesso: nf.chaveAcesso,
    observacao: nf.observacao,
    anexos: nf.anexos,
    registradaEm: nf.atualizadaEm,
    registradaPor: nf.atualizadaPor,
  }];
};

/** Valor da nota: o informado; nota única sem valor = valor do pedido. */
export const valorDaNota = (n: NotaFiscalItem, p: Pedido): number => {
  if (typeof n.valor === 'number' && Number.isFinite(n.valor)) return n.valor;
  return notasDoPedido(p).length === 1 ? pedidoValorNota(p) : 0;
};

const limpo = (v?: string) => (v && v.trim() ? v.trim() : undefined);

/**
 * Grava a lista completa de notas do pedido.
 * ≥1 nota → status 'emitida'; nenhuma → volta a 'pendente' (se estava emitida).
 * Os campos de topo legados são limpos (a lista passa a mandar); `dataEmissao`
 * de topo espelha a nota mais recente, para ordenação.
 */
export const salvarNotasDoPedido = (p: Pedido, notas: NotaFiscalItem[], autor?: string): Pedido => {
  const anterior: NotaFiscalLembrete = p.proposal?.notaFiscal || { status: 'pendente' };
  const agora = new Date().toISOString();
  const normalizadas: NotaFiscalItem[] = notas.map((n) => ({
    ...n,
    numero: limpo(n.numero),
    dataEmissao: limpo(n.dataEmissao) || agora.slice(0, 10),
    chaveAcesso: limpo(n.chaveAcesso),
    observacao: limpo(n.observacao),
    valor: typeof n.valor === 'number' && Number.isFinite(n.valor) ? n.valor : undefined,
    registradaEm: n.registradaEm || agora,
    registradaPor: n.registradaPor || autor,
  }));
  const maisRecente = normalizadas.map((n) => n.dataEmissao!).sort().pop();
  const status: NotaFiscalStatus = normalizadas.length
    ? 'emitida'
    : anterior.status === 'emitida' ? 'pendente' : anterior.status;
  const notaFiscal: NotaFiscalLembrete = {
    status,
    criadaEm: anterior.criadaEm || agora,
    atualizadaEm: agora,
    ...(autor ? { atualizadaPor: autor } : anterior.atualizadaPor ? { atualizadaPor: anterior.atualizadaPor } : {}),
    ...(maisRecente ? { dataEmissao: maisRecente } : {}),
    notas: normalizadas,
  };
  return { ...p, proposal: { ...p.proposal, notaFiscal } };
};

/** NF já marcada como EMITIDA (selo de certificação na lista de pedidos). */
export const isNotaFiscalEmitida = (p: Pedido): boolean =>
  p.proposal?.notaFiscal?.status === 'emitida';

/** Data de referência da emissão (dataEmissao → atualizadaEm → updatedAt). */
export const notaFiscalDataRef = (p: Pedido): string =>
  p.proposal?.notaFiscal?.dataEmissao || p.proposal?.notaFiscal?.atualizadaEm || p.updatedAt || '';

/** Pedidos com NF emitida, mais recentes primeiro. */
export const notasFiscaisEmitidas = (pedidos: Pedido[]): Pedido[] =>
  pedidos
    .filter(isNotaFiscalEmitida)
    .sort((a, b) => notaFiscalDataRef(b).localeCompare(notaFiscalDataRef(a)));

export interface LinhaNotaEmitida {
  pedido: Pedido;
  nota: NotaFiscalItem;
  valor: number;
  /** YYYY-MM-DD (ou ISO) usado para ordenar/filtrar por mês. */
  data: string;
}

/** Uma linha por NOTA (não por pedido), mais recentes primeiro (card). */
export const linhasNotasEmitidas = (pedidos: Pedido[]): LinhaNotaEmitida[] =>
  pedidos
    .filter(isNotaFiscalEmitida)
    .flatMap((pedido) =>
      notasDoPedido(pedido).map((nota) => ({
        pedido,
        nota,
        valor: valorDaNota(nota, pedido),
        data: nota.dataEmissao || nota.registradaEm || notaFiscalDataRef(pedido),
      })),
    )
    .sort((a, b) => b.data.localeCompare(a.data));

/** Resumo do card, contado por NOTA: total/mês, valores, por tipo, incompletas. */
export const resumoNotasEmitidas = (pedidos: Pedido[], mesRef = new Date().toISOString().slice(0, 7)) => {
  const linhas = linhasNotasEmitidas(pedidos);
  const doMes = linhas.filter((l) => l.data.slice(0, 7) === mesRef);
  const soma = (ls: LinhaNotaEmitida[]) => ls.reduce((acc, l) => acc + l.valor, 0);
  const conta = (ls: LinhaNotaEmitida[], t: NotaFiscalTipo) => ls.filter((l) => l.nota.tipo === t).length;
  return {
    total: linhas.length,
    valorTotal: soma(linhas),
    mes: doMes.length,
    valorMes: soma(doMes),
    servicoMes: conta(doMes, 'servico'),
    materialMes: conta(doMes, 'material'),
    servico: conta(linhas, 'servico'),
    material: conta(linhas, 'material'),
    semNumero: linhas.filter((l) => !l.nota.numero).length,
    /** Notas sem o XML (documento fiscal) anexado. */
    semXml: linhas.filter((l) => !l.nota.anexos?.xml).length,
    incompletas: linhas.filter((l) => !l.nota.numero || !l.nota.anexos?.xml).length,
  };
};

/** Texto curto do selo: "NFS-e 123 · NF-e 456" ou "3 notas". */
export const resumoSeloNotas = (p: Pedido): string => {
  const notas = notasDoPedido(p);
  if (notas.length === 0) return '';
  if (notas.length > 2) return `${notas.length} notas`;
  return notas.map((n) => `${NOTA_TIPO_SIGLA[n.tipo]}${n.numero ? ` ${n.numero}` : ''}`).join(' · ');
};

/** Rótulo legível do estado (UI). */
export const notaFiscalStatusLabel = (s: NotaFiscalStatus): string =>
  s === 'emitida' ? 'Emitida' : s === 'nao_aplicavel' ? 'Não aplicável' : 'Pendente';
