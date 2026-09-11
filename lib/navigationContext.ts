/** Navigation metadata only. Never store forms, entity snapshots or photo blobs. */
export const NAV_KEYS = ['cliente', 'aba', 'area', 'levantamento', 'etapa', 'equipamento', 'rascunho', 'sessaoFoto', 'pedido', 'pedidosAba', 'os', 'atendimento', 'atendimentoEtapa', 'secoes'] as const;
export type NavigationKey = typeof NAV_KEYS[number];
export type NavigationState = Partial<Record<NavigationKey, string>>;
export const NAV_SESSION_KEY = 'fireowl.navigation.v1';

export function parseNavigation(search: string): NavigationState {
  const params = new URLSearchParams(search);
  const result: NavigationState = {};
  for (const key of NAV_KEYS) {
    const value = params.get(key);
    if (value && value.length <= 256 && /^[\w,.-]+$/.test(value)) result[key] = value;
  }
  return result;
}

export function navigationUrl(href: string, patch: Partial<Record<NavigationKey, string | null>>): URL {
  const url = new URL(href);
  for (const key of NAV_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  return url;
}

export function belongsToUser(raw: string | null, userId: string): boolean {
  try { return JSON.parse(raw || 'null')?.userId === userId; } catch { return false; }
}

export async function resolveNavigationEntity<T>(load: () => Promise<T | null>, valid: (value: T) => boolean = () => true): Promise<T | null> {
  try { const value = await load(); return value && valid(value) ? value : null; } catch { return null; }
}
