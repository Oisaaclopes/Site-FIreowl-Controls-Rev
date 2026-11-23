import type { NotaFiscalLembrete, NotaFiscalStatus, Pedido, UserRole } from './types';

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

/** Registra (ou corrige) a NF como emitida — nº/data/observação opcionais. */
export const registrarNotaFiscalEmitida = (
  p: Pedido,
  dados: {
    numero?: string;
    dataEmissao?: string;
    observacao?: string;
    chaveAcesso?: string;
    /** Só substitui quando informado (undefined preserva os anexos atuais). */
    anexos?: NotaFiscalLembrete['anexos'];
  },
  autor?: string,
): Pedido => {
  const limpo = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  const base = p.proposal?.notaFiscal?.criadaEm ? p : {
    ...p,
    proposal: { ...p.proposal, notaFiscal: { ...(p.proposal?.notaFiscal || { status: 'pendente' as const }), criadaEm: new Date().toISOString() } },
  };
  return aplicarNotaFiscal(
    base,
    {
      status: 'emitida',
      numero: limpo(dados.numero),
      dataEmissao: limpo(dados.dataEmissao) || new Date().toISOString().slice(0, 10),
      observacao: limpo(dados.observacao),
      chaveAcesso: limpo(dados.chaveAcesso),
      ...(dados.anexos !== undefined ? { anexos: dados.anexos } : {}),
    },
    autor,
  );
};

/** NF já marcada como EMITIDA (selo de certificação na lista de pedidos). */
export const isNotaFiscalEmitida = (p: Pedido): boolean =>
  p.proposal?.notaFiscal?.status === 'emitida';

/** Data de referência da emissão (dataEmissao → atualizadaEm → updatedAt). */
export const notaFiscalDataRef = (p: Pedido): string =>
  p.proposal?.notaFiscal?.dataEmissao || p.proposal?.notaFiscal?.atualizadaEm || p.updatedAt || '';

/** NFs emitidas, mais recentes primeiro (card de controle). */
export const notasFiscaisEmitidas = (pedidos: Pedido[]): Pedido[] =>
  pedidos
    .filter(isNotaFiscalEmitida)
    .sort((a, b) => notaFiscalDataRef(b).localeCompare(notaFiscalDataRef(a)));

/** Resumo do card: quantidade/valor total e do mês corrente (YYYY-MM). */
export const resumoNotasEmitidas = (pedidos: Pedido[], mesRef = new Date().toISOString().slice(0, 7)) => {
  const emitidas = notasFiscaisEmitidas(pedidos);
  const doMes = emitidas.filter((p) => notaFiscalDataRef(p).slice(0, 7) === mesRef);
  const soma = (ps: Pedido[]) => ps.reduce((acc, p) => acc + pedidoValorNota(p), 0);
  return {
    total: emitidas.length,
    valorTotal: soma(emitidas),
    mes: doMes.length,
    valorMes: soma(doMes),
    semNumero: emitidas.filter((p) => !p.proposal?.notaFiscal?.numero).length,
    /** Emitidas sem o XML (documento fiscal) anexado. */
    semXml: emitidas.filter((p) => !p.proposal?.notaFiscal?.anexos?.xml).length,
  };
};

/** Rótulo legível do estado (UI). */
export const notaFiscalStatusLabel = (s: NotaFiscalStatus): string =>
  s === 'emitida' ? 'Emitida' : s === 'nao_aplicavel' ? 'Não aplicável' : 'Pendente';
