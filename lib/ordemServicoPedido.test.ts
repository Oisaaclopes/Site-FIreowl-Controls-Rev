import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { OrdemServico } from './types';
import { findActiveOsForPedido, OS_STATUS_ATIVOS } from './ordensServico';

// ---- Fixtures -------------------------------------------------------------
const os = (over: Partial<OrdemServico>): OrdemServico => ({
  id: over.id || `os_${Math.random().toString(36).slice(2)}`,
  numero: over.numero,
  clienteId: over.clienteId ?? 'cli_1',
  tipo: over.tipo ?? 'corretiva',
  status: over.status ?? 'aberta',
  prioridade: over.prioridade ?? 'media',
  pendenciaIds: over.pendenciaIds ?? [],
  sourcePedidoId: over.sourcePedidoId,
  ...over,
});

// ---- Mock do client Supabase para a RPC -----------------------------------
const rpcMock = vi.fn();
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

describe('OPERACIONAL 2A — vínculo estrutural Pedido → OS', () => {
  beforeEach(() => rpcMock.mockReset());

  // 1. Pedido sem OS → nenhuma OS ativa encontrada.
  it('Pedido sem OS ativa retorna undefined', () => {
    const ordens = [os({ sourcePedidoId: 'ped_OUTRO', status: 'aberta' })];
    expect(findActiveOsForPedido(ordens, 'ped_A')).toBeUndefined();
  });

  // 7. OS-2026-0001 ligada a ped_1788208403374 é reconhecida.
  it('reconhece a OS oficial pelo sourcePedidoId', () => {
    const oficial = os({ numero: 'OS-2026-0001', sourcePedidoId: 'ped_1788208403374', status: 'aberta' });
    expect(findActiveOsForPedido([oficial], 'ped_1788208403374')?.numero).toBe('OS-2026-0001');
  });

  // 4 + 8 (CRÍTICO). Dois pedidos com o MESMO numero_pedido, ids diferentes:
  // o sistema NÃO pode confundi-los — o casamento é por pedidos.id.
  it('não confunde dois pedidos com o mesmo numero_pedido (ids distintos)', () => {
    const osA = os({ numero: 'OS-2026-0010', sourcePedidoId: 'ped_A', status: 'aberta' });
    const osB = os({ numero: 'OS-2026-0011', sourcePedidoId: 'ped_B', status: 'aberta' });
    const ordens = [osA, osB];
    // Ambos os pedidos têm numero_pedido 'PED-2026-252' mas ids diferentes.
    expect(findActiveOsForPedido(ordens, 'ped_A')?.numero).toBe('OS-2026-0010');
    expect(findActiveOsForPedido(ordens, 'ped_B')?.numero).toBe('OS-2026-0011');
    // O numero_pedido humano NUNCA é usado como chave.
    expect(findActiveOsForPedido(ordens, 'PED-2026-252')).toBeUndefined();
  });

  // 5. Pedidos diferentes → OS diferentes.
  it('pedidos diferentes resolvem OS diferentes', () => {
    const ordens = [
      os({ id: 'x', sourcePedidoId: 'ped_A', status: 'aberta' }),
      os({ id: 'y', sourcePedidoId: 'ped_B', status: 'aberta' }),
    ];
    expect(findActiveOsForPedido(ordens, 'ped_A')?.id).toBe('x');
    expect(findActiveOsForPedido(ordens, 'ped_B')?.id).toBe('y');
  });

  // 6. OS legada com sourcePedidoId NULL continua válida e nunca casa.
  it('OS legada sem origem (sourcePedidoId undefined) não casa com nenhum pedido', () => {
    const legada = os({ numero: 'OS-2025-0099', sourcePedidoId: undefined, status: 'aberta' });
    expect(findActiveOsForPedido([legada], 'ped_A')).toBeUndefined();
    expect(findActiveOsForPedido([legada], '')).toBeUndefined();
  });

  // Uma OS encerrada (concluida/cancelada) NÃO é "ativa": o Pedido pode gerar outra (2B).
  it('OS encerrada não conta como ativa', () => {
    for (const status of ['concluida', 'cancelada'] as OrdemServico['status'][]) {
      const encerrada = os({ sourcePedidoId: 'ped_A', status });
      expect(findActiveOsForPedido([encerrada], 'ped_A')).toBeUndefined();
    }
    expect(OS_STATUS_ATIVOS).toEqual(['aberta', 'agendada', 'em_execucao']);
  });
});

describe('getOrCreateOsFromPedido — domínio idempotente', () => {
  beforeEach(() => rpcMock.mockReset());

  it('mapeia created=true e a OS retornada pela RPC', async () => {
    const { getOrCreateOsFromPedido } = await import('./ordensServico');
    rpcMock.mockResolvedValue({
      data: { created: true, os: { id: 'u1', numero: 'OS-2026-0002', source_pedido_id: 'ped_A', status: 'aberta', tipo: 'corretiva', prioridade: 'alta', pendencia_ids: [] } },
      error: null,
    });
    const res = await getOrCreateOsFromPedido('ped_A', { tipo: 'corretiva', prioridade: 'alta' });
    expect(res.created).toBe(true);
    expect(res.os.numero).toBe('OS-2026-0002');
    expect(res.os.sourcePedidoId).toBe('ped_A');
    // Chamou a RPC canônica com pedidos.id (nunca numero_pedido).
    expect(rpcMock).toHaveBeenCalledWith('get_or_create_os_from_pedido', expect.objectContaining({ p_pedido_id: 'ped_A' }));
  });

  // 2. Mesmo pedidos.id de novo → RPC devolve a mesma OS com created=false.
  it('mapeia created=false quando a OS já existia (idempotência)', async () => {
    const { getOrCreateOsFromPedido } = await import('./ordensServico');
    rpcMock.mockResolvedValue({
      data: { created: false, os: { id: 'u1', numero: 'OS-2026-0002', source_pedido_id: 'ped_A', status: 'aberta', tipo: 'corretiva', prioridade: 'alta', pendencia_ids: [] } },
      error: null,
    });
    const res = await getOrCreateOsFromPedido('ped_A');
    expect(res.created).toBe(false);
    expect(res.os.numero).toBe('OS-2026-0002');
  });

  it('propaga erro da RPC (10 — sem estado falso)', async () => {
    const { getOrCreateOsFromPedido } = await import('./ordensServico');
    rpcMock.mockResolvedValue({ data: null, error: { message: 'nao autorizado' } });
    await expect(getOrCreateOsFromPedido('ped_A')).rejects.toBeTruthy();
  });

  it('exige pedidoId (não chama a RPC sem identidade)', async () => {
    const { getOrCreateOsFromPedido } = await import('./ordensServico');
    await expect(getOrCreateOsFromPedido('')).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('migration 0073 — invariantes do banco', () => {
  const sql = readFileSync(resolve(process.cwd(), 'lib/db/migrations/0073_os_source_pedido.sql'), 'utf8');

  it('adiciona source_pedido_id TEXT referenciando pedidos(id) — nunca UUID', () => {
    expect(sql).toMatch(/add column if not exists source_pedido_id text/i);
    expect(sql).toMatch(/references public\.pedidos\(id\)/i);
    expect(sql).not.toMatch(/source_pedido_id\s+uuid/i);
  });

  it('índice único é PARCIAL sobre status ativos (não UNIQUE simples)', () => {
    expect(sql).toMatch(/create unique index[^;]+source_pedido_id[^;]+where[^;]+status in \('aberta', 'agendada', 'em_execucao'\)/is);
  });

  it('backfill é explícito: OS-2026-0001 → ped_1788208403374, sem heurística', () => {
    expect(sql).toMatch(/set source_pedido_id = 'ped_1788208403374'/);
    expect(sql).toMatch(/numero = 'OS-2026-0001'/);
    // Guardado: só liga se o pedido existir e a OS ainda estiver sem origem.
    expect(sql).toMatch(/source_pedido_id is null/i);
    expect(sql).toMatch(/exists \(select 1 from public\.pedidos/i);
    // Sem backfill genérico por numero_pedido/cliente/data.
    expect(sql).not.toMatch(/set source_pedido_id = os\./i);
  });

  it('RPC é idempotente, SECURITY INVOKER, autenticada e concorrente-segura', () => {
    expect(sql).toMatch(/create or replace function public\.get_or_create_os_from_pedido/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
    expect(sql).toMatch(/auth\.uid\(\) is null/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/'created', false/); // caminho idempotente
    expect(sql).toMatch(/'created', true/); // caminho de criação
    expect(sql).toMatch(/when unique_violation/i); // rede de segurança da corrida
    // Numeração OS-AAAA-NNNN preservada.
    expect(sql).toMatch(/'OS-' \|\| v_ano \|\| '-' \|\| lpad/i);
  });
});
