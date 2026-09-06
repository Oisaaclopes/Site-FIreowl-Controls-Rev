/* ===================================================================
 * Paginação canônica para listas administrativas (Clientes, Pedidos, …).
 * Função PURA e testável: a UI (PaginatedListControls) e o hook usePagination
 * consomem exatamente esta lógica, para todas as telas paginarem igual.
 * Pipeline esperado nas telas: dados → filtros → busca → ordenação → PAGINAÇÃO.
 * =================================================================== */

export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 15;

export interface PaginationResult<T> {
  /** Itens da página atual (fatia de `items`). */
  pageItems: T[];
  /** Total de páginas (mínimo 1, mesmo com lista vazia). */
  totalPages: number;
  /** Página efetiva usada (clampeada a [1, totalPages]). */
  safePage: number;
  /** Índice humano do primeiro item exibido (1-based; 0 quando vazio). */
  from: number;
  /** Índice humano do último item exibido (0 quando vazio). */
  to: number;
  /** Total de itens após filtros/busca (o comprimento de `items`). */
  total: number;
}

/**
 * Fatia `items` para a página pedida. `items` DEVE já vir filtrado/buscado/
 * ordenado — a paginação é sempre o último passo. `page` fora do intervalo é
 * clampeado (nunca estoura nem some com itens). pageSize <= 0 vira a lista toda.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const total = items.length;
  const size = pageSize > 0 ? Math.floor(pageSize) : Math.max(total, 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * size;
  const pageItems = items.slice(start, start + size);
  const from = total === 0 ? 0 : start + 1;
  const to = total === 0 ? 0 : start + pageItems.length;
  return { pageItems, totalPages, safePage, from, to, total };
}

/**
 * Lista compacta de páginas para a barra numerada, com reticências.
 * Ex.: current=5, total=10 → [1, '…', 4, 5, 6, '…', 10].
 * `siblings` = quantas páginas de cada lado da atual (default 1).
 */
export function pageWindow(current: number, totalPages: number, siblings = 1): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  const first = 1;
  const last = totalPages;
  const left = Math.max(current - siblings, first);
  const right = Math.min(current + siblings, last);
  const out: (number | 'ellipsis')[] = [];
  out.push(first);
  if (left > first + 1) out.push('ellipsis');
  for (let p = left; p <= right; p++) if (p !== first && p !== last) out.push(p);
  if (right < last - 1) out.push('ellipsis');
  if (last !== first) out.push(last);
  return out;
}
