import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimePunch } from './types';

/* Carga do ponto por PERÍODO (sem corte global de 200 linhas). O Supabase é
 * simulado: cada tabela devolve linhas filtradas por gte/lt/lte e paginadas
 * por range(), como o PostgREST. */

type Row = Record<string, any>;
const tables: Record<string, Row[]> = { time_punches: [], punch_adjustments: [] };
const calls: { table: string; range: [number, number] }[] = [];

function builder(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const q: any = {
    select: () => q,
    gte: (col: string, v: string) => { filters.push((r) => r[col] >= v); return q; },
    lt: (col: string, v: string) => { filters.push((r) => r[col] < v); return q; },
    lte: (col: string, v: string) => { filters.push((r) => r[col] <= v); return q; },
    order: () => q,
    limit: () => { throw new Error('limit() global não deve ser usado'); },
    range: (a: number, b: number) => {
      calls.push({ table, range: [a, b] });
      const data = tables[table].filter((r) => filters.every((f) => f(r))).slice(a, b + 1);
      return Promise.resolve({ data, error: null });
    },
  };
  return q;
}

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ from: (t: string) => builder(t) }),
}));

import {
  defaultPunchWindowStart, fetchPunchesRange, isMonthInDefaultWindow, mergePunchSets, monthFetchRange,
} from './timepunch';

const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

beforeEach(() => {
  tables.time_punches = [];
  tables.punch_adjustments = [];
  calls.length = 0;
});

describe('janela padrão e faixa de competência', () => {
  it('janela padrão = véspera do 1º dia do mês anterior (cobre mês atual + anterior)', () => {
    expect(defaultPunchWindowStart(local(2026, 9, 24, 10))).toBe(local(2026, 7, 31));
    expect(defaultPunchWindowStart(local(2026, 1, 5))).toBe(local(2025, 11, 30)); // virada de ano
  });
  it('faixa do mês tem 1 dia de folga em cada lado (jornada noturna na virada)', () => {
    const r = monthFetchRange('2026-06');
    expect(r.fromMs).toBe(local(2026, 5, 31));
    expect(r.toMs).toBe(local(2026, 7, 2));
  });
  it('mês corrente e anterior já estão na janela; meses antigos não', () => {
    const now = local(2026, 9, 24);
    expect(isMonthInDefaultWindow('2026-09', now)).toBe(true);
    expect(isMonthInDefaultWindow('2026-08', now)).toBe(true);
    expect(isMonthInDefaultWindow('2026-07', now)).toBe(false);
  });
  it('merge por id: sem duplicar batida vista em dois períodos; mais recentes primeiro', () => {
    const p = (id: string, at: number) => ({ id, at } as TimePunch);
    const merged = mergePunchSets([[p('a', 1), p('b', 3)], [p('b', 3), p('c', 2)]]);
    expect(merged.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('fetchPunchesRange', () => {
  it('pagina até o fim: 2.350 batidas de vários funcionários, nenhuma perdida', async () => {
    const base = local(2026, 9, 1, 8);
    for (let i = 0; i < 2350; i++) {
      tables.time_punches.push({
        id: `p${i}`, user_id: `u${i % 12}`, employee_name: `Func ${i % 12}`, type: 'ENTRADA',
        punched_at: new Date(base + i * 60_000).toISOString(), lat: 0, lng: 0, status: 'APROVADO',
      });
    }
    const rows = await fetchPunchesRange(local(2026, 8, 31));
    expect(rows).toHaveLength(2350);
    expect(new Set(rows.map((r) => r.employeeName)).size).toBe(12);
    expect(calls.filter((c) => c.table === 'time_punches')).toHaveLength(3);
  });

  it('recorta pelo período e aplica ajustes aprovados do mesmo recorte', async () => {
    tables.time_punches.push(
      { id: 'in', user_id: 'u1', employee_name: 'Joao', type: 'SAIDA', punched_at: new Date(local(2026, 6, 10, 17, 40)).toISOString(), lat: 0, lng: 0 },
      { id: 'out', user_id: 'u1', employee_name: 'Joao', type: 'SAIDA', punched_at: new Date(local(2026, 8, 10, 17)).toISOString(), lat: 0, lng: 0 },
    );
    tables.punch_adjustments.push({
      id: 'adj1', user_id: 'u1', employee_name: 'Joao', ref_date: '2026-06-10', type: 'SAIDA',
      requested_time: '17:00', reason: 'correção', status: 'APROVADO', original_punch_id: 'in',
    });
    const { fromMs, toMs } = monthFetchRange('2026-06');
    const rows = await fetchPunchesRange(fromMs, toMs);
    expect(rows.map((r) => r.id)).toEqual(['in']);
    expect(rows[0].effectiveSource).toBe('adjusted');
    expect(rows[0].originalAt).toBe(local(2026, 6, 10, 17, 40)); // original preservado
    expect(rows[0].at).toBe(local(2026, 6, 10, 17, 0));
  });
});
