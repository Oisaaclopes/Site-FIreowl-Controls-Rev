import { describe, expect, it } from 'vitest';
import { comparisonLegend, comparisonNumber, comparisonSheetClient, sharedComparisonReference } from './comparisonSheet';
import type { ResolvedComparison, FieldPhotoComparison } from './fieldPhotoComparisons';
import type { GalleryPhoto } from './fieldPhotosGallery';

const photo = (over: Partial<GalleryPhoto>): GalleryPhoto => ({
  clientUuid: over.clientUuid || 'u', id: over.id || 'p', source: 'remote', sessionId: 's',
  clientId: over.clientId || 'cli-1', capturadoEm: over.capturadoEm || '2026-08-31T12:00:00.000Z',
  syncStatus: 'sincronizado', ...over,
});
const comp = (over: Partial<FieldPhotoComparison>): FieldPhotoComparison => ({
  id: over.id || 'c1', beforePhotoId: 'a', afterPhotoId: 'b', clientId: over.clientId || 'cli-1', ...over,
});
const r = (over: { c?: Partial<FieldPhotoComparison>; before?: Partial<GalleryPhoto>; after?: Partial<GalleryPhoto> }): ResolvedComparison => ({
  comparison: comp(over.c || {}), before: photo({ id: 'a', ...over.before }), after: photo({ id: 'b', ...over.after }),
});

describe('folha antes × depois — helpers puros', () => {
  it('exige um único cliente em todas as comparações (§A4)', () => {
    expect(comparisonSheetClient([r({ before: { clientId: 'X', clientName: 'Alfa' } })])).toEqual({ ok: true, clientId: 'X', clientName: 'Alfa' });
    expect(comparisonSheetClient([r({ before: { clientId: 'X' } }), r({ before: { clientId: 'Y' } })]).ok).toBe(false);
    expect(comparisonSheetClient([]).ok).toBe(true);
  });

  it('referência automática só quando todas compartilham OS/report (§A15)', () => {
    expect(sharedComparisonReference([r({ c: { osId: 'os1' } }), r({ c: { osId: 'os1' } })]).osId).toBe('os1');
    expect(sharedComparisonReference([r({ c: { osId: 'os1' } }), r({ c: { osId: 'os2' } })]).osId).toBeUndefined();
    expect(sharedComparisonReference([r({ c: { osId: 'os1' } }), r({ c: {} })]).osId).toBeUndefined();
    expect(sharedComparisonReference([r({ c: { reportId: 'rr' } }), r({ c: { reportId: 'rr' } })]).reportId).toBe('rr');
  });

  it('numeração documental COMPARAÇÃO NN', () => {
    expect(comparisonNumber(0)).toBe('01');
    expect(comparisonNumber(11)).toBe('12');
  });

  it('legenda: título padrão, local divergente, técnicos distintos, resultado', () => {
    const leg = comparisonLegend(r({
      c: { titulo: '', descricao: 'Trocado o detector', resultado: 'corrigido' },
      before: { localSetor: 'Bloco A', capturadoEm: '2026-08-10T09:00:00Z', tecnicoNome: 'Ana' },
      after: { localSetor: 'Bloco B', capturadoEm: '2026-08-20T15:30:00Z', tecnicoNome: 'Bruno' },
    }), 0);
    expect(leg.titulo).toBe('Comparação 01');
    expect(leg.localDiff).toBe(true);
    expect(leg.localBefore).toBe('Bloco A');
    expect(leg.localAfter).toBe('Bloco B');
    expect(leg.beforeTecnico).toBe('Ana');
    expect(leg.afterTecnico).toBe('Bruno');
    expect(leg.resultado).toBe('Corrigido');
    expect(leg.descricao).toBe('Trocado o detector');
    // sem dados internos
    expect(JSON.stringify(leg)).not.toMatch(/storage|session|clientUuid|lat|lng/i);
  });

  it('local igual → não marca divergência; usa título próprio quando existe', () => {
    const leg = comparisonLegend(r({ c: { titulo: 'Sirene' }, before: { localSetor: 'Hall' }, after: { localSetor: 'Hall' } }), 1);
    expect(leg.localDiff).toBe(false);
    expect(leg.titulo).toBe('Sirene');
  });
});
