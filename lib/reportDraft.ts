/* ===================================================================
 * Chave do rascunho (autosave localStorage) do ReportForm. Identidade PURA.
 * 1 OS pode ter N Atendimentos → o rascunho de um documento executado DENTRO de
 * um atendimento usa serviceAttendanceId como identidade principal (dois
 * atendimentos da mesma OS = rascunhos independentes). Sem atendimento, mantém
 * o fallback legado por OS/avulso (wizard/relatório avulso inalterado).
 * =================================================================== */
export function reportDraftKey(input: {
  codigo: string;
  clienteId?: string;
  serviceAttendanceId?: string;
  osId?: string;
}): string {
  const cliente = input.clienteId || 'sem_cliente';
  // serviceAttendanceId vence (por atendimento); senão OS; senão avulso (legado).
  const escopo = input.serviceAttendanceId || input.osId || 'avulso';
  return `fireowl_atendimento_rascunho:${input.codigo}:${cliente}:${escopo}`;
}

/* ===================================================================
 * Seleção da DEFINIÇÃO ativa do formulário (o caminho REAL que a tela usa).
 * Um relatório FINALIZADO congela seu snapshot (imutável) — mas isso vive no
 * registro do relatório e nem reabre o ReportForm. Já um ATENDIMENTO ABERTO
 * (rascunho em localStorage) NÃO pode ficar preso a um schema legado: adota a
 * versão MAIS NOVA quando a vigente é maior que a do rascunho (respostas são
 * restauradas à parte). PURA/testável.
 * =================================================================== */
export interface FormDefinitionLike { secoes?: unknown[]; versao?: number }
export function pickActiveTemplate<T extends FormDefinitionLike>(input: {
  draftSnapshot?: T | null;
  draftVersion?: number;
  current: T;
}): { template: T; version: number; source: 'draft' | 'current' } {
  const curVer = input.current.versao ?? 1;
  const snap = input.draftSnapshot;
  if (snap && Array.isArray(snap.secoes)) {
    const dVer = input.draftVersion ?? snap.versao ?? 1;
    if (dVer >= curVer) return { template: snap, version: dVer, source: 'draft' };
  }
  return { template: input.current, version: curVer, source: 'current' };
}
