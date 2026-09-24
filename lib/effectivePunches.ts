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

// Metadados de auditoria da batida efetiva (0113). Declarados aqui, junto do
// resolvedor que os produz, por mesclagem de interface com TimePunch.
declare module './types' {
  interface TimePunch {
    /** Ação do ajuste aplicado: AJUSTE (horário) ou INCLUSAO (batida ausente). */
    adjustmentAction?: 'AJUSTE' | 'INCLUSAO';
    /** SOLICITACAO (pedido do funcionário aprovado) ou ADMINISTRATIVO (correção direta). */
    adjustmentOrigin?: 'SOLICITACAO' | 'ADMINISTRATIVO';
  }
}

const auditMeta = (adjustment: PunchAdjustment, action: 'AJUSTE' | 'INCLUSAO') => ({
  status: 'AJUSTADO' as const,
  effectiveSource: 'adjusted' as const,
  adjustmentId: adjustment.id,
  adjustmentReason: adjustment.reason,
  adjustmentRequestedAt: adjustment.createdAt,
  adjustmentApprovedAt: adjustment.reviewedAt,
  adjustmentApprovedBy: adjustment.reviewerName,
  adjustmentAction: action,
  adjustmentOrigin: adjustment.origin ?? 'SOLICITACAO',
});

const includedPunch = (adjustment: PunchAdjustment, at: number): TimePunch => ({
  id: `adjustment:${adjustment.id}`,
  userId: adjustment.userId,
  employeeName: adjustment.employeeName,
  timestamp: formatTimestamp(at),
  type: adjustment.type,
  locationStr: 'Sem localização (batida incluída por ajuste)',
  lat: 0,
  lng: 0,
  at,
  ...auditMeta(adjustment, 'INCLUSAO'),
});

/**
 * Fonte única de batidas efetivas. Ajustes pendentes/rejeitados/substituídos
 * são ignorados; aprovados substituem a representação da batida, nunca a
 * evidência original. Ações (0113):
 *   AJUSTE        — novo horário para a batida vinculada (original preservado).
 *   INCLUSAO      — batida ausente, efetiva sem fabricar registro em time_punches.
 *   DESCONSIDERAR — a batida vinculada sai do cálculo (continua no banco).
 * Ajustes legados (sem vínculo) só são aplicados quando a correspondência é
 * inequívoca.
 */
export function resolveEffectivePunches(punches: TimePunch[], adjustments: PunchAdjustment[]): TimePunch[] {
  const approvedAll = adjustments.filter((a) => a.status === 'APROVADO');
  const discarded = new Set(
    approvedAll.filter((a) => a.action === 'DESCONSIDERAR' && a.originalPunchId).map((a) => a.originalPunchId!),
  );
  const live = punches.filter((p) => !discarded.has(p.id));
  const timed = approvedAll.filter((a) => a.action !== 'DESCONSIDERAR' && requestedAt(a) != null);
  const inclusions = timed.filter((a) => a.action === 'INCLUSAO');
  const approved = timed.filter((a) => a.action !== 'INCLUSAO');

  const byPunchId = new Map<string, PunchAdjustment[]>();
  const legacy = new Map<string, PunchAdjustment[]>();
  for (const adjustment of approved) {
    const map = adjustment.originalPunchId ? byPunchId : legacy;
    const key = adjustment.originalPunchId || legacyKey(adjustment);
    map.set(key, [...(map.get(key) || []), adjustment]);
  }

  const used = new Set<string>();
  const result: TimePunch[] = live.map((p): TimePunch => {
    const direct = byPunchId.get(p.id) || [];
    const fallback = legacy.get(punchLegacyKey(p)) || [];
    const candidates = direct.length ? direct : fallback;
    // Nunca escolher silenciosamente entre aprovações concorrentes.
    if (candidates.length !== 1) return { ...p, originalAt: p.at, effectiveSource: 'original' as const };
    const adjustment = candidates[0];
    if (!direct.length) {
      const compatible = live.filter((candidate) => punchLegacyKey(candidate) === legacyKey(adjustment));
      if (compatible.length !== 1) return { ...p, originalAt: p.at, effectiveSource: 'original' as const };
    }
    const at = requestedAt(adjustment)!;
    used.add(adjustment.id);
    return { ...p, at, timestamp: formatTimestamp(at), originalAt: p.at, ...auditMeta(adjustment, 'AJUSTE') };
  });

  // O fluxo legado também permitia solicitar batida ausente (AJUSTE sem
  // vínculo e sem batida compatível). Mantido como era.
  for (const adjustment of approved) {
    if (used.has(adjustment.id) || adjustment.originalPunchId) continue;
    const sameKey = legacy.get(legacyKey(adjustment)) || [];
    const compatible = live.filter((p) => punchLegacyKey(p) === legacyKey(adjustment));
    if (sameKey.length !== 1 || compatible.length !== 0) continue;
    result.push(includedPunch(adjustment, requestedAt(adjustment)!));
  }

  // Inclusão explícita (0113): sempre efetiva — é uma batida a mais, auditada.
  for (const adjustment of inclusions) result.push(includedPunch(adjustment, requestedAt(adjustment)!));

  return result.sort((a, b) => (b.at || 0) - (a.at || 0));
}
