/* ===================================================================
 * Orquestração da FINALIZAÇÃO de um levantamento técnico (§D — sem falso sucesso).
 *
 * A tela do levantamento só pode fechar depois da CONFIRMAÇÃO REAL de sucesso da
 * persistência (finalizeSurvey → status FINALIZADO no banco). Em erro, o
 * draft/tela permanece aberto e um feedback é exibido — nada é perdido e o
 * usuário pode tentar de novo. Antes, o erro era engolido e a tela fechava como
 * se tivesse dado certo, deixando o survey preso em EM_ANDAMENTO e invisível em
 * Relatórios.
 *
 * PURO em relação a React/DOM: todos os efeitos entram por callbacks, o que torna
 * o contrato ("só fecha no sucesso") testável sem renderizar componente.
 * =================================================================== */

export interface SurveyFinalizeHandlers {
  /** Chamada de persistência real (ex.: finalizeSurvey(id, verified)). Pode rejeitar. */
  finalize: () => Promise<unknown>;
  /** Fecha o fluxo — dispara APENAS após a finalização confirmada (onChanged + onFinalized + onClose). */
  onSuccess: () => void;
  /** Feedback de erro. NÃO fecha a tela: o draft/identidade é preservado. */
  onError: (message: string) => void;
  /** Trava o botão "Finalizar" durante a chamada (evita duplo clique). */
  setBusy?: (busy: boolean) => void;
}

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : String(e);

/**
 * Executa a finalização e só chama `onSuccess` (que fecha a tela) quando a
 * persistência é confirmada. Retorna `true` no sucesso e `false` no erro —
 * conveniente para testes e para decisões subsequentes do chamador.
 */
export async function runSurveyFinalize(h: SurveyFinalizeHandlers): Promise<boolean> {
  h.setBusy?.(true);
  try {
    await h.finalize();
  } catch (e) {
    h.setBusy?.(false);
    h.onError(messageOf(e)); // erro NÃO fecha a tela — draft preservado (§D)
    return false;
  }
  h.setBusy?.(false);
  h.onSuccess(); // fecha SÓ aqui, após sucesso confirmado
  return true;
}
