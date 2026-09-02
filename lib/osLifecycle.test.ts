import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OrdemServico } from './types';
import {
  isHardDeleteEligible, isCancelable, osHistoryForPedido, findActiveOsForPedido,
} from './ordensServico';

const os = (over: Partial<OrdemServico>): OrdemServico => ({
  id: over.id || `os_${Math.random().toString(36).slice(2)}`,
  numero: over.numero,
  clienteId: over.clienteId ?? 'cli_1',
  tipo: over.tipo ?? 'corretiva',
  status: over.status ?? 'aberta',
  prioridade: over.prioridade ?? 'media',
  pendenciaIds: over.pendenciaIds ?? [],
  sourcePedidoId: over.sourcePedidoId,
  dataAbertura: over.dataAbertura,
  ...over,
});

const rpcMock = vi.fn();
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: rpcMock }) }));

describe('2B — regras de lifecycle (puras)', () => {
  const STATUSES: OrdemServico['status'][] = ['aberta', 'agendada', 'em_execucao', 'concluida', 'cancelada'];

  // 1 + 8..10. Hard delete só para 'aberta' (virgem); demais bloqueados.
  it('isHardDeleteEligible: só aberta', () => {
    for (const s of STATUSES) {
      expect(isHardDeleteEligible({ status: s })).toBe(s === 'aberta');
    }
  });

  // 11..13 + 18..19. Cancelamento só para ATIVAS; concluida/cancelada não.
  it('isCancelable: só aberta/agendada/em_execucao', () => {
    for (const s of STATUSES) {
      expect(isCancelable({ status: s })).toBe(['aberta', 'agendada', 'em_execucao'].includes(s));
    }
  });

  // 22 + 20. Histórico inclui canceladas e concluídas, mais recente primeiro.
  it('osHistoryForPedido: inclui encerradas, ordena desc, por sourcePedidoId', () => {
    const ordens = [
      os({ numero: 'OS-2026-0005', sourcePedidoId: 'ped_A', status: 'concluida', dataAbertura: '2026-01-05' }),
      os({ numero: 'OS-2026-0008', sourcePedidoId: 'ped_A', status: 'cancelada', dataAbertura: '2026-03-08' }),
      os({ numero: 'OS-2026-0010', sourcePedidoId: 'ped_A', status: 'aberta', dataAbertura: '2026-05-10' }),
      os({ numero: 'OS-2026-0009', sourcePedidoId: 'ped_B', status: 'aberta', dataAbertura: '2026-04-09' }),
    ];
    const hist = osHistoryForPedido(ordens, 'ped_A').map((o) => o.numero);
    expect(hist).toEqual(['OS-2026-0010', 'OS-2026-0008', 'OS-2026-0005']);
  });

  // 20 + 21 + 23. Após cancelar a ativa, o Pedido libera nova OS; a nova usa o
  // mesmo source_pedido_id e nunca há duas ativas simultâneas.
  it('cancelada libera nova OS; só uma ativa; mesmo source_pedido_id', () => {
    const soCancelada = [os({ numero: 'OS-001', sourcePedidoId: 'ped_A', status: 'cancelada' })];
    expect(findActiveOsForPedido(soCancelada, 'ped_A')).toBeUndefined(); // pode gerar nova

    const comNova = [
      os({ numero: 'OS-001', sourcePedidoId: 'ped_A', status: 'cancelada' }),
      os({ numero: 'OS-002', sourcePedidoId: 'ped_A', status: 'aberta' }),
    ];
    const ativa = findActiveOsForPedido(comNova, 'ped_A');
    expect(ativa?.numero).toBe('OS-002');
    expect(ativa?.sourcePedidoId).toBe('ped_A');
    // Exatamente uma ativa.
    expect(comNova.filter((o) => o.sourcePedidoId === 'ped_A' && ['aberta', 'agendada', 'em_execucao'].includes(o.status))).toHaveLength(1);
  });

  // 24. Dois pedidos com o MESMO numero_pedido (ids distintos) seguem independentes.
  it('dois pedidos com mesmo numero_pedido não se confundem no histórico', () => {
    const ordens = [
      os({ numero: 'OS-A1', sourcePedidoId: 'ped_A', status: 'cancelada' }),
      os({ numero: 'OS-B1', sourcePedidoId: 'ped_B', status: 'aberta' }),
    ];
    expect(osHistoryForPedido(ordens, 'ped_A').map((o) => o.numero)).toEqual(['OS-A1']);
    expect(osHistoryForPedido(ordens, 'ped_B').map((o) => o.numero)).toEqual(['OS-B1']);
  });
});

describe('2B — domínio cancelOs / deleteOsIfUnused', () => {
  beforeEach(() => rpcMock.mockReset());

  // 14 + 15..17. Cancelamento chama a RPC com motivo; mapeia a OS cancelada.
  it('cancelOs: chama cancel_os e mapeia campos de cancelamento', async () => {
    const { cancelOs } = await import('./ordensServico');
    rpcMock.mockResolvedValue({
      data: { os: { id: 'u1', numero: 'OS-2026-0002', status: 'cancelada', tipo: 'corretiva', prioridade: 'media', pendencia_ids: [], cancelada_em: '2026-09-02T10:00:00Z', cancelada_por: 'user-1', motivo_cancelamento: 'Cliente desistiu' } },
      error: null,
    });
    const res = await cancelOs('u1', '  Cliente desistiu  ');
    expect(rpcMock).toHaveBeenCalledWith('cancel_os', { p_os_id: 'u1', p_motivo: 'Cliente desistiu' });
    expect(res.status).toBe('cancelada');
    expect(res.motivoCancelamento).toBe('Cliente desistiu');
    expect(res.canceladaPor).toBe('user-1');
    expect(res.canceladaEm).toBe('2026-09-02T10:00:00Z');
  });

  // 14. Motivo vazio é bloqueado antes de tocar o banco.
  it('cancelOs: motivo vazio é rejeitado sem chamar a RPC', async () => {
    const { cancelOs } = await import('./ordensServico');
    await expect(cancelOs('u1', '   ')).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // 29. Falha da RPC propaga erro (a UI não deve aplicar estado otimista).
  it('cancelOs: propaga erro da RPC', async () => {
    const { cancelOs } = await import('./ordensServico');
    rpcMock.mockResolvedValue({ data: null, error: { message: 'nao e possivel cancelar uma OS concluida' } });
    await expect(cancelOs('u1', 'motivo')).rejects.toBeTruthy();
  });

  it('deleteOsIfUnused: chama delete_os_if_unused e devolve numero', async () => {
    const { deleteOsIfUnused } = await import('./ordensServico');
    rpcMock.mockResolvedValue({ data: { deleted: true, os_id: 'u1', numero: 'OS-2026-0003' }, error: null });
    const res = await deleteOsIfUnused('u1');
    expect(rpcMock).toHaveBeenCalledWith('delete_os_if_unused', { p_os_id: 'u1' });
    expect(res.numero).toBe('OS-2026-0003');
  });

  // 2..7. Bloqueios de evidência: a RPC lança erro e o domínio propaga.
  it('deleteOsIfUnused: propaga bloqueio por evidência', async () => {
    const { deleteOsIfUnused } = await import('./ordensServico');
    rpcMock.mockResolvedValue({ data: null, error: { message: 'OS possui relatorio vinculado; nao pode ser excluida' } });
    await expect(deleteOsIfUnused('u1')).rejects.toBeTruthy();
  });
});

describe('2B — invariantes da migration 0074', () => {
  const sql = readFileSync(resolve(process.cwd(), 'lib/db/migrations/0074_os_lifecycle.sql'), 'utf8');

  it('adiciona campos de cancelamento (cancelada_por → profiles)', () => {
    expect(sql).toMatch(/add column if not exists cancelada_em timestamptz/i);
    expect(sql).toMatch(/add column if not exists cancelada_por uuid references public\.profiles\(id\)/i);
    expect(sql).toMatch(/add column if not exists motivo_cancelamento text/i);
  });

  it('cancel_os: INVOKER, papel restrito, motivo obrigatório, timestamp do servidor', () => {
    expect(sql).toMatch(/create or replace function public\.cancel_os/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/auth_role\(\) not in \('ADMINISTRATIVO', 'GESTOR'\)/);
    expect(sql).toMatch(/motivo do cancelamento obrigatorio/i);
    expect(sql).toMatch(/cancelada_em = now\(\)/i);       // servidor, não frontend
    expect(sql).toMatch(/cancelada_por = auth\.uid\(\)/i);
    expect(sql).toMatch(/ja esta cancelada/i);             // 19: não reativa/recancela
    expect(sql).toMatch(/nao e possivel cancelar uma OS concluida/i); // 18
  });

  it('delete_os_if_unused: DEFINER + search_path + só aberta + todas as evidências', () => {
    expect(sql).toMatch(/create or replace function public\.delete_os_if_unused/i);
    expect(sql).toMatch(/security definer/i);              // enxerga evidência sob RLS restritiva
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
    expect(sql).toMatch(/auth_role\(\) not in \('ADMINISTRATIVO', 'GESTOR'\)/);
    expect(sql).toMatch(/v_os\.status <> 'aberta'/);       // só virgem
    // Evidências verificadas (FASE 4 + 14): relatório (FK e textual), fotos,
    // comparações, execução de rotina, horas, financeiro.
    expect(sql).toMatch(/v_os\.report_id is not null/i);
    expect(sql).toMatch(/from public\.reports r\s+where r\.os_id = p_os_id::text/i);
    expect(sql).toMatch(/from public\.field_photos/i);
    expect(sql).toMatch(/from public\.field_photo_comparisons/i);
    expect(sql).toMatch(/from public\.contract_routine_executions/i);
    expect(sql).toMatch(/from public\.contract_hour_ledger/i);
    expect(sql).toMatch(/from public\.transactions/i);
    // NÃO usa CASCADE destrutivo (nenhum `on delete cascade`); grants mínimos.
    expect(sql).not.toMatch(/on delete cascade/i);
    expect(sql).toMatch(/revoke all on function public\.delete_os_if_unused/i);
    expect(sql).toMatch(/grant execute on function public\.delete_os_if_unused\(uuid\) to authenticated/i);
  });
});
