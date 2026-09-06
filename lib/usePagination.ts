'use client';
import { useEffect, useMemo, useState } from 'react';
import { paginate, DEFAULT_PAGE_SIZE, PaginationResult } from './pagination';

export interface UsePaginationResult<T> extends PaginationResult<T> {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

/**
 * Estado + fatia de paginação para listas administrativas. `items` já deve vir
 * filtrado/buscado/ordenado (a paginação é o último passo). Volta para a página
 * 1 quando `resetKey` (assinatura de busca/filtros) OU `pageSize` mudam. A
 * página efetiva é sempre clampeada — nunca > totalPages.
 */
export function usePagination<T>(
  items: T[],
  opts?: { initialPageSize?: number; resetKey?: unknown },
): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts?.initialPageSize ?? DEFAULT_PAGE_SIZE);

  // Recalcula/retorna à página 1 ao mudar busca/filtros (resetKey) ou pageSize.
  useEffect(() => { setPage(1); }, [opts?.resetKey, pageSize]);

  const result = useMemo(() => paginate(items, page, pageSize), [items, page, pageSize]);

  return { ...result, page: result.safePage, pageSize, setPage, setPageSize };
}
