import { describe, expect, it } from 'vitest';
import {
  buildLegend, evidenceNumber, orderPhotos, photoSheetFilename,
  selectionClient, sharedReference, sharedTechnician,
} from './photoSheet';
import type { GalleryPhoto } from './fieldPhotosGallery';

const g = (over: Partial<GalleryPhoto>): GalleryPhoto => ({
  clientUuid: over.clientUuid || 'u1', id: over.id || 'u1', source: 'remote',
  sessionId: 's1', clientId: over.clientId || 'cli-1', capturadoEm: over.capturadoEm || '2026-08-31T12:00:00.000Z',
  syncStatus: 'sincronizado', ...over,
});

describe('folha de fotos — helpers puros', () => {
  it('valida um único cliente por documento (§8)', () => {
    expect(selectionClient([g({ clientId: 'A', clientName: 'Alfa' }), g({ clientId: 'A' })])).toEqual({ ok: true, clientId: 'A', clientName: 'Alfa' });
    expect(selectionClient([g({ clientId: 'A' }), g({ clientId: 'B' })]).ok).toBe(false);
    expect(selectionClient([]).ok).toBe(true);
  });

  it('ordena por seleção / mais antiga / mais recente', () => {
    const list = [
      g({ clientUuid: '1', capturadoEm: '2026-08-20T10:00:00Z' }),
      g({ clientUuid: '2', capturadoEm: '2026-08-10T10:00:00Z' }),
      g({ clientUuid: '3', capturadoEm: '2026-08-30T10:00:00Z' }),
    ];
    expect(orderPhotos(list, 'selecao').map((p) => p.clientUuid)).toEqual(['1', '2', '3']);
    expect(orderPhotos(list, 'antiga').map((p) => p.clientUuid)).toEqual(['2', '1', '3']);
    expect(orderPhotos(list, 'recente').map((p) => p.clientUuid)).toEqual(['3', '1', '2']);
  });

  it('numeração documental com zero à esquerda', () => {
    expect(evidenceNumber(0)).toBe('01');
    expect(evidenceNumber(9)).toBe('10');
  });

  it('referência automática só quando todas compartilham o mesmo vínculo', () => {
    expect(sharedReference([g({ osId: 'os1' }), g({ osId: 'os1' })])).toEqual({ osId: 'os1', reportId: undefined, pendenciaId: undefined });
    expect(sharedReference([g({ osId: 'os1' }), g({ osId: 'os2' })]).osId).toBeUndefined();
    expect(sharedReference([g({ osId: 'os1' }), g({})]).osId).toBeUndefined(); // uma sem vínculo
    expect(sharedReference([g({ reportId: 'r1' }), g({ reportId: 'r1' })]).reportId).toBe('r1');
  });

  it('responsável derivado só quando uniforme', () => {
    expect(sharedTechnician([g({ tecnicoNome: 'Isaac' }), g({ tecnicoNome: 'Isaac' })])).toBe('Isaac');
    expect(sharedTechnician([g({ tecnicoNome: 'Isaac' }), g({ tecnicoNome: 'Ana' })])).toBeUndefined();
    expect(sharedTechnician([g({ tecnicoNome: 'Isaac' }), g({})])).toBeUndefined();
  });

  it('legenda só com campos seguros (sem UUID/path/GPS)', () => {
    const leg = buildLegend({ localSetor: 'Bloco B', capturadoEm: '2026-08-31T15:30:00.000Z', marcador: 'falha', notaRapida: 'Detector obstruído', tecnicoNome: 'Isaac' }, 0);
    expect(leg.titulo).toBe('EVIDÊNCIA 01');
    expect(leg.local).toBe('Bloco B');
    expect(leg.marcador).toBe('Falha');
    expect(leg.observacao).toBe('Detector obstruído');
    expect(leg.tecnico).toBe('Isaac');
    expect(JSON.stringify(leg)).not.toMatch(/u1|storage|lat|lng|session/i);
  });

  it('nome de arquivo sanitizado com cliente e data', () => {
    expect(photoSheetFilename('Super Muffato (Saul Elkind)', '2026-08-31')).toBe('Folha-de-Fotos_FIREOWL_Saul_Elkind_2026-08-31.pdf');
    expect(photoSheetFilename(undefined, '2026-08-31')).toBe('Folha-de-Fotos_FIREOWL_Cliente_2026-08-31.pdf');
  });
});
