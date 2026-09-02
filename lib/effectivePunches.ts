import { PunchAdjustment } from './adjustments';
import { TimePunch } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const formatTimestamp = (at: number) => {
  const d = new Date(at);
  return `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()} ${d.getFullYear()} | ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const requestedAt = (a: PunchAdjustment): number | undefined => {
  if (!a.refDate || !a.requestedTime) return undefined;
  const value = new Date(`${a.refDate}T${a.requestedTime.length === 5 ? `${a.requestedTime}:00` : a.requestedTime}`).getTime();
  return Number.isNaN(value) ? undefined : value;
};
const legacyKey = (a: PunchAdjustment) => `${a.userId || a.employeeName}||${a.refDate}||${a.type}`;
const punchLegacyKey = (p: TimePunch) => `${p.userId || p.employeeName}||${p.at ? dateKey(p.at) : ''}||${p.type}`;

export const effectivePunchLabel = (punch: TimePunch): string =>
  punch.effectiveSource === 'adjusted' ? 'Registro ajustado' : punch.status === 'PENDENTE' ? 'Pendente' : 'Registro original';

/**
 * Fonte única de batidas efetivas. Ajustes pendentes/rejeitados são ignorados;
 * aprovados substituem a representação da batida, nunca a evidência original.
 * Ajustes legados só são aplicados quando a correspondência é inequívoca.
 */
export function resolveEffectivePunches(punches: TimePunch[], adjustments: PunchAdjustment[]): TimePunch[] {
  const approved = adjustments.filter((a) => a.status === 'APROVADO' && requestedAt(a) != null);
  const byPunchId = new Map<string, PunchAdjustment[]>();
  const legacy = new Map<string, PunchAdjustment[]>();
  for (const adjustment of approved) {
    const map = adjustment.originalPunchId ? byPunchId : legacy;
    const key = adjustment.originalPunchId || legacyKey(adjustment);
    map.set(key, [...(map.get(key) || []), adjustment]);
  }

  const used = new Set<string>();
  const result: TimePunch[] = punches.map((p): TimePunch => {
    const direct = byPunchId.get(p.id) || [];
    const fallback = legacy.get(punchLegacyKey(p)) || [];
    const candidates = direct.length ? direct : fallback;
    // Nunca escolher silenciosamente entre aprovações concorrentes.
    if (candidates.length !== 1) return { ...p, originalAt: p.at, effectiveSource: 'original' as const };
    const adjustment = candidates[0];
    if (!direct.length) {
      const compatible = punches.filter((candidate) => punchLegacyKey(candidate) === legacyKey(adjustment));
      if (compatible.length !== 1) return { ...p, originalAt: p.at, effectiveSource: 'original' as const };
    }
    const at = requestedAt(adjustment)!;
    used.add(adjustment.id);
    return {
      ...p,
      at,
      timestamp: formatTimestamp(at),
      status: 'AJUSTADO' as const,
      originalAt: p.at,
      effectiveSource: 'adjusted' as const,
      adjustmentId: adjustment.id,
      adjustmentReason: adjustment.reason,
      adjustmentRequestedAt: adjustment.createdAt,
      adjustmentApprovedAt: adjustment.reviewedAt,
      adjustmentApprovedBy: adjustment.reviewerName,
    };
  });

  // O fluxo legado também permitia solicitar batida ausente. Ela é efetiva sem
  // fabricar um registro em time_punches e permanece auditada no ajuste.
  for (const adjustment of approved) {
    if (used.has(adjustment.id) || adjustment.originalPunchId) continue;
    const sameKey = legacy.get(legacyKey(adjustment)) || [];
    const compatible = punches.filter((p) => punchLegacyKey(p) === legacyKey(adjustment));
    if (sameKey.length !== 1 || compatible.length !== 0) continue;
    const at = requestedAt(adjustment)!;
    result.push({
      id: `adjustment:${adjustment.id}`,
      userId: adjustment.userId,
      employeeName: adjustment.employeeName,
      timestamp: formatTimestamp(at),
      type: adjustment.type,
      locationStr: 'Sem localização (batida incluída por ajuste)',
      lat: 0,
      lng: 0,
      status: 'AJUSTADO',
      at,
      effectiveSource: 'adjusted',
      adjustmentId: adjustment.id,
      adjustmentReason: adjustment.reason,
      adjustmentRequestedAt: adjustment.createdAt,
      adjustmentApprovedAt: adjustment.reviewedAt,
      adjustmentApprovedBy: adjustment.reviewerName,
    });
  }
  return result.sort((a, b) => (b.at || 0) - (a.at || 0));
}
