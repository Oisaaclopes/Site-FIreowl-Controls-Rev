import { GeoPoint } from './types';

/**
 * Captura a posição atual (Parte 4.6). SEMPRE grava `accuracy` — dentro de
 * shopping o GPS erra 50–100 m. Trate como evidência indiciária, não prova.
 * Permissão negada / indisponível => resolve null (NÃO bloqueia o trabalho).
 */
export async function getGeoPoint(timeoutMs = 8000): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: GeoPoint | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          finish({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: new Date(pos.timestamp).toISOString(),
          }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    } catch {
      finish(null);
    }
  });
}

/** Texto padrão para exibição/PDF: coordenada + precisão declarada, sem afirmar presença. */
export function formatGeo(g?: GeoPoint | null): string {
  if (!g || g.lat === undefined || g.lng === undefined) return 'Localização não disponível';
  const acc = g.accuracy !== undefined ? ` (±${Math.round(g.accuracy)} m)` : '';
  return `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}${acc}`;
}
