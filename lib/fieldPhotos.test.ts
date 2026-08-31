import { describe, expect, it } from 'vitest';
import { evidenceLines, isUnclassifiedFieldPhoto, newFieldPhoto, newFieldPhotoSession } from './fieldPhotos';
import { evidenceLayout } from './fieldPhotoEvidence';

describe('field photos', () => {
  it('preserva o instante real informado na captura e cria IDs estáveis', () => {
    const capturedAt = '2026-08-31T16:42:13.000Z';
    const session = newFieldPhotoSession({ clientId: 'cliente-1', tecnicoId: '00000000-0000-4000-8000-000000000001' }, capturedAt);
    const photo = newFieldPhoto({ sessionId: session.id, clientId: 'cliente-1', storagePathOriginal: 'field-photos/x/originals/a.jpg' }, capturedAt);
    expect(photo.capturadoEm).toBe(capturedAt);
    expect(photo.clientUuid).not.toBe(photo.id);
  });
  it('considera não classificada somente quando nenhum vínculo operacional existe', () => {
    expect(isUnclassifiedFieldPhoto({})).toBe(true);
    expect(isUnclassifiedFieldPhoto({ osId: 'os-1' })).toBe(false);
  });
  it('aceita local e nota opcionais no payload de evidência', () => {
    const lines = evidenceLines({ capturadoEm: '2026-08-31T16:42:13.000Z' }, { tecnicoNome: 'Isaac Lopes' }, 'Cliente A');
    expect(lines.clientName).toBe('Cliente A');
    expect(lines.localSetor).toBeUndefined();
    expect(lines.note).toBeUndefined();
  });
  it('calcula carimbo proporcional para portrait e landscape', () => {
    expect(evidenceLayout(1080, 1920, 2).overlayHeight).toBeLessThan(1920 * .35);
    expect(evidenceLayout(1920, 1080, 3).font).toBeGreaterThan(0);
  });
});
