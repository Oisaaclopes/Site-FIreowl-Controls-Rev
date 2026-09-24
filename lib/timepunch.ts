import { getSupabaseClient } from './supabaseClient';
import { TimePunch } from './types';
import { rowToAdjustment } from './adjustments';
import { resolveEffectivePunches } from './effectivePunches';

const TABLE = 'time_punches';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fmtTimestamp = (d: Date) =>
  `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function rowToPunch(r: any): TimePunch {
  const at = r.punched_at ? new Date(r.punched_at).getTime() : undefined;
  return {
    id: String(r.id),
    userId: r.user_id ?? undefined,
    employeeName: r.employee_name || '',
    timestamp: at ? fmtTimestamp(new Date(at)) : '',
    type: r.type,
    locationStr: r.location_address || (
      r.lat != null && r.lng != null && (Number(r.lat) || Number(r.lng))
        ? `${Number(r.lat).toFixed(6)}, ${Number(r.lng).toFixed(6)}`
        : 'Sem localização'),
    locationAddress: r.location_address || undefined,
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? 0),
    status: r.status || 'APROVADO',
    at,
    accuracy: r.accuracy ?? undefined,
  };
}

// Carga por PERÍODO (não por "N linhas globais"): um corte de linhas somado entre
// todos os funcionários truncava a folha do gestor. Cada período é paginado até
// o fim; o teto de páginas só protege contra laço infinito.
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const MONTH_RE = /^\d{4}-\d{2}$/;

async function fetchAllPages(build: (from: number, to: number) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const localDateKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Início da janela padrão: véspera do 1º dia do mês ANTERIOR (00:00 local) —
 *  cobre mês corrente + anterior inteiros, e a folga de 1 dia evita partir uma
 *  jornada noturna iniciada na virada. */
export function defaultPunchWindowStart(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth() - 1, 0).getTime();
}

/** Faixa [início, fim) de uma competência YYYY-MM com 1 dia de folga em cada
 *  lado (jornada que entra no último dia do mês e sai no dia 1º seguinte). */
export function monthFetchRange(month: string): { fromMs: number; toMs: number } {
  const [y, m] = month.split('-').map(Number);
  return { fromMs: new Date(y, m - 1, 0).getTime(), toMs: new Date(y, m, 2).getTime() };
}

/** Batidas EFETIVAS (ajustes aprovados aplicados) de um período — RLS decide de
 *  quem: o próprio funcionário, ou todos para ADMINISTRATIVO/GESTOR. */
export async function fetchPunchesRange(fromMs: number, toMs?: number): Promise<TimePunch[]> {
  const supabase = getSupabaseClient() as any;
  const fromIso = new Date(fromMs).toISOString();
  const toIso = toMs != null ? new Date(toMs).toISOString() : undefined;
  const [punchRows, adjustmentRows] = await Promise.all([
    fetchAllPages((a, b) => {
      let q = supabase.from(TABLE).select('*').gte('punched_at', fromIso);
      if (toIso) q = q.lt('punched_at', toIso);
      return q.order('punched_at', { ascending: false }).order('id', { ascending: true }).range(a, b);
    }),
    // ref_date é a data (local) da batida ajustada/incluída — mesmo recorte.
    fetchAllPages((a, b) => {
      let q = supabase.from('punch_adjustments').select('*').gte('ref_date', localDateKey(fromMs));
      if (toMs != null) q = q.lte('ref_date', localDateKey(toMs));
      return q.order('created_at', { ascending: false }).order('id', { ascending: true }).range(a, b);
    }),
  ]);
  return resolveEffectivePunches(punchRows.map(rowToPunch), adjustmentRows.map(rowToAdjustment));
}

/** Une resultados de períodos sobrepostos (mesma batida = mesmo id), mais
 *  recentes primeiro. */
export function mergePunchSets(sets: TimePunch[][]): TimePunch[] {
  const byId = new Map<string, TimePunch>();
  for (const set of sets) for (const p of set) byId.set(p.id, p);
  return Array.from(byId.values()).sort((a, b) => (b.at || 0) - (a.at || 0));
}

/**
 * Lista os pontos que o usuário tem permissão de ver: janela padrão (mês
 * corrente + anterior, completa) + competências extras já solicitadas (folha/
 * espelho de meses antigos). Mais recentes primeiro.
 */
export async function fetchPunches(extraMonths: Iterable<string> = []): Promise<TimePunch[]> {
  const windowStart = defaultPunchWindowStart();
  const extra = Array.from(new Set(extraMonths)).filter((m) => MONTH_RE.test(m) && monthFetchRange(m).fromMs < windowStart);
  const sets = await Promise.all([
    fetchPunchesRange(windowStart),
    ...extra.map((m) => { const r = monthFetchRange(m); return fetchPunchesRange(r.fromMs, r.toMs); }),
  ]);
  return mergePunchSets(sets);
}

/** true quando a competência já está coberta pela janela padrão (ou é inválida). */
export const isMonthInDefaultWindow = (month: string, nowMs: number = Date.now()): boolean =>
  !MONTH_RE.test(month) || monthFetchRange(month).fromMs >= defaultPunchWindowStart(nowMs);

// Registra uma batida (user_id é preenchido pelo default auth.uid() no banco).
export async function insertPunch(p: TimePunch): Promise<TimePunch> {
  const supabase = getSupabaseClient() as any;
  const row = {
    employee_name: p.employeeName,
    type: p.type,
    punched_at: new Date(p.at ?? Date.now()).toISOString(),
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy ?? null,
    status: p.status || 'APROVADO',
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw error;
  const saved = rowToPunch(data);
  if (saved.lat || saved.lng) void requestPunchAddress(saved.id).catch(() => {});
  return saved;
}

/** Best-effort: a batida já foi salva; falha de geocoding nunca invalida o ponto. */
export async function requestPunchAddress(punchId: string): Promise<void> {
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.functions.invoke('reverse-geocode', { body: { punchId } });
  if (error) throw error;
}
