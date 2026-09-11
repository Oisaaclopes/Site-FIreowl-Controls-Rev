import { describe, expect, it, vi } from 'vitest';
import { belongsToUser, navigationUrl, parseNavigation, resolveNavigationEntity } from './navigationContext';
import { scrollCanRestore } from './useNavigationScroll';

describe('navigation metadata across reload', () => {
  it('round-trips client, technical base, survey, equipment draft and photo session IDs', () => {
    const context = { cliente: 'c1', aba: 'base_tecnica', area: 'SDAI', levantamento: 's1', etapa: 'capture', rascunho: 'd1', sessaoFoto: 'f1' } as const;
    expect(parseNavigation(navigationUrl('https://fireowl.test/funcionarios/crm/', context).search)).toEqual(context);
  });
  it('round-trips the same attendance and operational step', () => {
    expect(parseNavigation('?atendimento=a1&atendimentoEtapa=assinatura')).toEqual({ atendimento: 'a1', atendimentoEtapa: 'assinatura' });
  });
  it('round-trips pedido and expanded sections', () => {
    expect(parseNavigation('?pedido=p1&pedidosAba=propostas&secoes=basicas,garantia')).toEqual({ pedido: 'p1', pedidosAba: 'propostas', secoes: 'basicas,garantia' });
  });
  it('round-trips OS and client device detail', () => {
    expect(parseNavigation('?os=o1&cliente=c1&equipamento=d1')).toEqual({ os: 'o1', cliente: 'c1', equipamento: 'd1' });
  });
  it('ignores corrupt values, unknown keys and oversized input', () => {
    expect(parseNavigation('?pedido=%00&cliente=' + 'x'.repeat(257) + '&password=secret&aba=base_tecnica')).toEqual({ aba: 'base_tecnica' });
  });
  it('does not serialize operational snapshots', () => {
    expect(navigationUrl('https://fireowl.test/', { pedido: 'p1', diagnosis: 'private' } as never).search).toBe('?pedido=p1');
  });
  it('closing survey retains nearest valid parent', () => {
    const url = navigationUrl('https://fireowl.test/?cliente=c1&aba=base_tecnica&levantamento=s1&etapa=capture', { levantamento: null, etapa: null });
    expect(parseNavigation(url.search)).toEqual({ cliente: 'c1', aba: 'base_tecnica' });
  });
  it('preserves unrelated route parameters and fragment', () => {
    expect(navigationUrl('https://fireowl.test/path?other=1#anchor', { pedido: 'p1' }).href).toBe('https://fireowl.test/path?other=1&pedido=p1#anchor');
  });
  it('can restore earlier parent history without merging descendant IDs', () => {
    const history = ['?cliente=c1', '?cliente=c1&aba=base_tecnica', '?cliente=c1&aba=base_tecnica&levantamento=s1'];
    expect(parseNavigation(history[1])).not.toHaveProperty('levantamento');
    expect(parseNavigation(history[0])).not.toHaveProperty('aba');
  });
});

describe('owner isolation and safe fallbacks', () => {
  it('accepts only the same user', () => {
    expect(belongsToUser('{"userId":"A"}', 'A')).toBe(true);
    expect(belongsToUser('{"userId":"A"}', 'B')).toBe(false);
  });
  it('logout removes restoration eligibility', () => expect(belongsToUser(null, 'A')).toBe(false));
  it.each(['{', 'null', '[]', '42'])('corrupt session %s is harmless', (raw) => expect(belongsToUser(raw, 'A')).toBe(false));
  it('missing entity falls back', async () => expect(await resolveNavigationEntity(async () => null)).toBeNull());
  it('permission or network failure falls back', async () => expect(await resolveNavigationEntity(async () => { throw new Error('403'); })).toBeNull());
  it('finished entity falls back', async () => expect(await resolveNavigationEntity(async () => ({ status: 'FINALIZADO' }), (v) => v.status === 'EM_EXECUCAO')).toBeNull());
  it('restoring an entity invokes only the supplied read', async () => {
    const read = vi.fn(async () => ({ id: 'existing' }));
    expect(await resolveNavigationEntity(read)).toEqual({ id: 'existing' });
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('deferred scroll', () => {
  it('waits for content height', () => {
    expect(scrollCanRestore(300, 300, 600)).toBe(false);
    expect(scrollCanRestore(1000, 300, 600)).toBe(true);
  });
  it('rejects invalid positions', () => {
    expect(scrollCanRestore(1000, 300, -1)).toBe(false);
    expect(scrollCanRestore(1000, 300, NaN)).toBe(false);
  });
});
