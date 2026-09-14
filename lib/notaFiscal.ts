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

/** Rótulo legível do estado (UI). */
export const notaFiscalStatusLabel = (s: NotaFiscalStatus): string =>
  s === 'emitida' ? 'Emitida' : s === 'nao_aplicavel' ? 'Não aplicável' : 'Pendente';
