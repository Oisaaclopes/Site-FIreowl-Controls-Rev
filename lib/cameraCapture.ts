/* ===================================================================
 * Helpers PUROS da captura por câmera (getUserMedia). Sem React/DOM de UI —
 * testáveis em Node. O componente CameraCapture usa estas funções para produzir
 * um File compatível com o pipeline existente de field_photos.
 * =================================================================== */

export type CameraFacing = 'environment' | 'user';

/** Constraints do getUserMedia priorizando a câmera traseira (§3). */
export function cameraConstraints(facing: CameraFacing): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: facing === 'environment' ? { ideal: 'environment' } : { ideal: 'user' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
}

/**
 * Converte o Blob do canvas em File compatível com o pipeline (§7). Mantém
 * type image/jpeg e lastModified = agora (a foto foi tirada neste instante, o
 * que casa com evidenceCapturedAt). Nome estável e único.
 */
export function blobToCapturedFile(blob: Blob, name = `foto_${Date.now()}.jpg`): File {
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], name, { type, lastModified: Date.now() });
}

/** getUserMedia disponível neste ambiente? (SSR-safe / navegadores antigos) */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
}

/** Mensagem amigável a partir do erro do getUserMedia. */
export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permissão de câmera negada. Você ainda pode escolher da galeria.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'Nenhuma câmera disponível. Escolha uma foto da galeria.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'A câmera está em uso por outro app. Escolha da galeria ou tente novamente.';
  return 'Não foi possível abrir a câmera. Escolha uma foto da galeria.';
}
