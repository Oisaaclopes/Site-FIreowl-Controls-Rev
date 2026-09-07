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
