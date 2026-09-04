import { describe, expect, it } from 'vitest';
import { blobToCapturedFile, cameraConstraints, cameraErrorMessage, cameraSupported } from './cameraCapture';

describe('blobToCapturedFile (§7)', () => {
  it('gera File image/jpeg válido a partir do Blob do canvas', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const before = Date.now();
    const file = blobToCapturedFile(blob);
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/^foto_\d+\.jpg$/);
    expect(file.lastModified).toBeGreaterThanOrEqual(before - 1000);
  });
  it('normaliza type ausente/estranho para image/jpeg', () => {
    const blob = new Blob([new Uint8Array([1])], { type: '' });
    expect(blobToCapturedFile(blob).type).toBe('image/jpeg');
  });
  it('respeita nome customizado', () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    const file = blobToCapturedFile(blob, 'central.png');
    expect(file.name).toBe('central.png');
    expect(file.type).toBe('image/png');
  });
});

describe('cameraConstraints (§3)', () => {
  it('prioriza a câmera traseira (environment)', () => {
    const c = cameraConstraints('environment');
    expect((c.video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'environment' });
    expect(c.audio).toBe(false);
  });
  it('permite câmera frontal (user) ao trocar', () => {
    expect(((cameraConstraints('user').video as MediaTrackConstraints).facingMode)).toEqual({ ideal: 'user' });
  });
});

describe('cameraErrorMessage (§10)', () => {
  it('permissão negada oferece galeria', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/galeria/i);
  });
  it('sem câmera oferece galeria', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/galeria/i);
  });
  it('erro desconhecido tem fallback', () => {
    expect(cameraErrorMessage(new Error('x'))).toMatch(/galeria/i);
  });
});

describe('cameraSupported', () => {
  it('false em ambiente sem mediaDevices (Node/SSR)', () => {
    expect(cameraSupported()).toBe(false);
  });
});
