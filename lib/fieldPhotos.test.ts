import { describe, expect, it } from 'vitest';
import { evidenceLines, isUnclassifiedFieldPhoto, newFieldPhoto, newFieldPhotoSession } from './fieldPhotos';

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
});
