/**
 * Estado de sincronização — apresentação por EXCEÇÃO.
 *
 * A regra de produto (refino de navegação §4/§5): quando tudo está normal
 * (online, sem pendências, sem sincronização em curso), NÃO se mostra nada.
 * O usuário só é avisado quando há algo relevante — offline, itens na fila,
 * sincronização em andamento ou erro.
 *
 * Esta é a fonte de verdade da apresentação do sync. A infraestrutura de
 * offline/outbox/realtime permanece intacta — aqui só decidimos o que exibir.
 */

export type SyncBadgeKind = 'OFFLINE' | 'PENDING' | 'SYNCING' | 'ERROR';

export interface SyncBadge {
  kind: SyncBadgeKind;
  label: string;
  /** Ícone material-symbols. */
  icon: string;
  /** Classe de tom (tokens theme-aware). */
  tone: string;
  /** Texto do title/tooltip. */
  title: string;
}

export interface SyncSnapshot {
  online: boolean;
  pending: number;
  syncing?: boolean;
  error?: boolean;
}

/**
 * Deriva o badge a exibir — ou `null` quando o estado é normal (nada a mostrar).
 *
 * Precedência: OFFLINE > ERROR > SYNCING > PENDING > (normal → null).
 */
export function deriveSyncBadge({ online, pending, syncing, error }: SyncSnapshot): SyncBadge | null {
  const pend = Math.max(0, Math.floor(pending || 0));

  if (!online) {
    return {
      kind: 'OFFLINE',
      label: 'Offline',
      icon: 'cloud_off',
      tone: 'border-border bg-surface-3 text-fg-secondary',
      title: 'Sem conexão — dados salvos no aparelho e enviados quando a conexão voltar.',
    };
  }
  if (error) {
    return {
      kind: 'ERROR',
      label: 'Erro de sincronização',
      icon: 'sync_problem',
      tone: 'border-danger/30 bg-danger-soft text-danger',
      title: 'Falha ao sincronizar. Tentaremos novamente automaticamente.',
    };
  }
  if (syncing) {
    return {
      kind: 'SYNCING',
      label: 'Sincronizando…',
      icon: 'sync',
      tone: 'border-primary/30 bg-primary-soft text-primary',
      title: 'Enviando registros para o servidor…',
    };
  }
  if (pend > 0) {
    return {
      kind: 'PENDING',
      label: `${pend} pendente${pend > 1 ? 's' : ''}`,
      icon: 'cloud_upload',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      title: `${pend} registro(s) aguardando envio ao servidor.`,
    };
  }
  // Estado normal: online, sem pendências, sem sync em curso → nada a exibir.
  return null;
}
