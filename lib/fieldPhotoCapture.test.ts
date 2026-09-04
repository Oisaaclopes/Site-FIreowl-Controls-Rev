import { describe, expect, it } from 'vitest';
import { evidenceCapturedAt } from './fieldPhotoCapture';

/* §11 — timestamp da evidência HONESTO com captura UNIFICADA: usa o
 * lastModified do arquivo (metadado real, tanto para câmera quanto galeria),
 * nunca a "hora do upload"; sem metadado confiável, cai para agora. */

function fakeFile(lastModified: number): File {
  return new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg', lastModified });
}

describe('evidenceCapturedAt (§11)', () => {
  it('usa o lastModified do arquivo (foto da galeria mantém a data original)', () => {
    const captured = new Date(2026, 0, 15, 10, 30).getTime();
    expect(new Date(evidenceCapturedAt(fakeFile(captured))).getTime()).toBe(captured);
  });
  it('foto recém-tirada (lastModified ~ agora) reflete o momento real', () => {
    const now = Date.now();
    expect(new Date(evidenceCapturedAt(fakeFile(now))).getTime()).toBe(now);
  });
  it('sem lastModified confiável cai para agora, sem inventar data antiga', () => {
    const before = Date.now();
    expect(new Date(evidenceCapturedAt(fakeFile(0))).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
