import { describe, expect, it } from 'vitest';
import { evidenceCapturedAt } from './fieldPhotoCapture';

/* 3B.3 §11 — timestamp da evidência HONESTO: câmera = agora; upload = metadado
 * do arquivo (lastModified), nunca "a hora do upload". */

function fakeFile(lastModified: number): File {
  // File aceita lastModified nas options; em Node/vitest o construtor existe.
  return new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg', lastModified });
}

describe('evidenceCapturedAt (§11)', () => {
  it('câmera → usa o horário atual (captura agora)', () => {
    const before = Date.now();
    const iso = evidenceCapturedAt(fakeFile(0), 'camera');
    const t = new Date(iso).getTime();
    expect(t).toBeGreaterThanOrEqual(before - 1000);
    expect(t).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('upload → usa o lastModified do arquivo, não a hora do upload', () => {
    const captured = new Date(2026, 0, 15, 10, 30).getTime();
    const iso = evidenceCapturedAt(fakeFile(captured), 'upload');
    expect(new Date(iso).getTime()).toBe(captured);
  });

  it('upload sem lastModified confiável → cai para agora (não inventa data antiga)', () => {
    const before = Date.now();
    const iso = evidenceCapturedAt(fakeFile(0), 'upload');
    expect(new Date(iso).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
