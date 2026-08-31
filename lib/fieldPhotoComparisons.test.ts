import { describe, expect, it } from 'vitest';
import {
  buildComparison, hasDuplicate, pairKey, PairPhoto, sharedContext, sortComparisons, validateComparisonPair,
} from './fieldPhotoComparisons';

const p = (over: Partial<PairPhoto>): PairPhoto => ({
  id: over.id || 'a', clientId: over.clientId || 'cli-1', source: over.source || 'remote',
  osId: over.osId, reportId: over.reportId, pendenciaId: over.pendenciaId,
});

describe('comparações antes × depois — regras puras', () => {
  it('exige exatamente 2 fotos distintas', () => {
    expect(validateComparisonPair([p({ id: 'a' })]).reason).toBe('quantidade');
    expect(validateComparisonPair([p({ id: 'a' }), p({ id: 'b' }), p({ id: 'c' })]).reason).toBe('quantidade');
    expect(validateComparisonPair([p({ id: 'a' }), p({ id: 'a' })]).reason).toBe('iguais');
  });

  it('bloqueia clientes diferentes (hard rule §27)', () => {
    expect(validateComparisonPair([p({ id: 'a', clientId: 'X' }), p({ id: 'b', clientId: 'Y' })]).reason).toBe('cliente');
  });

  it('exige as duas fotos sincronizadas (§21)', () => {
    expect(validateComparisonPair([p({ id: 'a', source: 'local' }), p({ id: 'b' })]).reason).toBe('sync');
    expect(validateComparisonPair([p({ id: 'a' }), p({ id: 'b' })]).ok).toBe(true);
  });

  it('contexto operacional herdado só quando ambas compartilham (§28)', () => {
    expect(sharedContext(p({ osId: 'os1' }), p({ osId: 'os1' })).osId).toBe('os1');
    expect(sharedContext(p({ osId: 'os1' }), p({ osId: 'os2' })).osId).toBeUndefined();
    expect(sharedContext(p({ osId: 'os1' }), p({})).osId).toBeUndefined();
    expect(sharedContext(p({ reportId: 'r1' }), p({ reportId: 'r1' })).reportId).toBe('r1');
  });

  it('dedup trata A+B e B+A como a mesma dupla (§20)', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    const existing = [{ beforePhotoId: 'a', afterPhotoId: 'b' }];
    expect(hasDuplicate(existing, 'a', 'b')).toBe(true);
    expect(hasDuplicate(existing, 'b', 'a')).toBe(true); // invertido = mesma dupla
    expect(hasDuplicate(existing, 'a', 'c')).toBe(false);
  });

  it('buildComparison respeita a escolha de qual é o "antes" e deriva contexto', () => {
    const a = p({ id: 'a', clientId: 'cli-1', osId: 'os9' });
    const b = p({ id: 'b', clientId: 'cli-1', osId: 'os9' });
    const c = buildComparison(a, b, true, { titulo: '  Detector  ', descricao: '', resultado: 'corrigido' });
    expect(c.beforePhotoId).toBe('a');
    expect(c.afterPhotoId).toBe('b');
    expect(c.clientId).toBe('cli-1');
    expect(c.osId).toBe('os9');
    expect(c.titulo).toBe('Detector');
    expect(c.descricao).toBeUndefined();
    expect(c.resultado).toBe('corrigido');
    // Invertendo qual é o "antes":
    expect(buildComparison(a, b, false, {}).beforePhotoId).toBe('b');
  });

  it('ordena por created_at desc', () => {
    const list = [
      { id: '1', createdAt: '2026-08-10T10:00:00Z' },
      { id: '2', createdAt: '2026-08-30T10:00:00Z' },
      { id: '3', createdAt: '2026-08-20T10:00:00Z' },
    ];
    expect(sortComparisons(list).map((x) => x.id)).toEqual(['2', '3', '1']);
  });
});
