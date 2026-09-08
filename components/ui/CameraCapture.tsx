'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { blobToCapturedFile, CameraFacing, cameraConstraints, cameraErrorMessage, cameraSupported } from '@/lib/cameraCapture';

/* ===================================================================
 * CameraCapture — câmera in-app (getUserMedia) como AÇÃO PRINCIPAL no mobile,
 * com acesso à GALERIA dentro da própria tela (§1–§10). Genérico e reutilizável
 * (3D: SDAI/CFTV/Alarme/BMS/CA). Produz um File image/jpeg e o entrega via
 * onCapture — o resto segue o pipeline existente (field_photos/outbox).
 *
 * Robusto a: permissão negada, sem câmera, API indisponível, erro de init —
 * nesses casos oferece imediatamente "Escolher da galeria" (§10). Nunca bloqueia.
 * Offline-safe: getUserMedia não depende de rede (§12).
 * =================================================================== */

interface Props {
  onCapture: (file: File) => void | Promise<void>;
  onClose: () => void;
  title?: string;
}

export const CameraCapture: React.FC<Props> = ({ onCapture, onClose, title = 'Adicionar foto' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ file: File; url: string; source: 'camera' | 'gallery' } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const confirmedRef = useRef(false);

  const replacePreview = useCallback((file: File, source: 'camera' | 'gallery') => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreview({ file, url, source });
    setBusy(false);
  }, []);

  const discardPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
    confirmedRef.current = false;
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (mode: CameraFacing) => {
    if (!cameraSupported()) { setError('Câmera não suportada neste navegador. Escolha uma foto da galeria.'); return; }
    setError(null); setReady(false);
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(mode));
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
        setReady(true);
      }
    } catch (e) {
      setError(cameraErrorMessage(e));
    }
  }, [stop]);

  useEffect(() => {
    start(facing);
    return () => {
      stop();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !ready || busy) return;
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return;
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBusy(false); return; }
    ctx.drawImage(v, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) { setBusy(false); return; }
      stop();
      replacePreview(blobToCapturedFile(blob), 'camera');
    }, 'image/jpeg', 0.9);
  }, [ready, busy, replacePreview, stop]);

  const onGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem válida.'); return; }
    stop();
    replacePreview(file, 'gallery');
  };

  const retake = () => {
    discardPreview();
    start(facing);
  };

  const usePhoto = () => {
    if (!preview || confirmedRef.current) return;
    confirmedRef.current = true;
    setBusy(true);
    onCapture(preview.file);
  };

  const close = () => { stop(); discardPreview(); onClose(); };

  // A câmera pode ser montada dentro de formulários e overlays com fechamento
  // por backdrop. Isole todos os gestos no boundary do componente para que um
  // tap/click nunca alcance o modal pai (especialmente no Safari/Chrome mobile).
  const containInteraction = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-[97] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={containInteraction}
      onPointerDown={containInteraction}
      onPointerUp={containInteraction}
      onTouchStart={containInteraction}
      onTouchEnd={containInteraction}
    >
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button type="button" onClick={close} className="text-white/85 hover:text-white text-2xl leading-none" aria-label="Fechar">×</button>
        <span className="text-xs font-bold uppercase tracking-wide text-white/80">{title}</span>
        <span className="w-6" />
      </div>

      {/* Área da câmera / erro */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {preview ? (
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${preview.url})` }}
            role="img"
            aria-label="Pré-visualização da foto"
          />
        ) : error ? (
          <div className="max-w-xs text-center px-6">
            <span className="material-symbols-outlined text-5xl text-white/70">no_photography</span>
            <p className="mt-3 text-sm text-white/90">{error}</p>
            <button type="button" onClick={() => galleryRef.current?.click()} className="mt-5 w-full min-h-[52px] rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold uppercase tracking-wide">Escolher da galeria</button>
            <button type="button" onClick={() => start(facing)} className="mt-2 w-full min-h-[44px] rounded-xl border border-white/30 text-white/85 text-xs font-bold uppercase">Tentar câmera novamente</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="max-h-full max-w-full object-contain" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">Abrindo câmera…</div>}
          </>
        )}
      </div>

      {/* Controles inferiores: [galeria] [capturar] [trocar] */}
      {preview ? (
        <div className="grid grid-cols-2 gap-3 px-4 py-6">
          <button type="button" onClick={preview.source === 'gallery' ? () => galleryRef.current?.click() : retake} disabled={busy} className="min-h-[52px] rounded-xl border border-white/40 text-sm font-bold text-white disabled:opacity-50">
            {preview.source === 'gallery' ? 'Escolher outra' : 'Tirar novamente'}
          </button>
          <button type="button" onClick={usePhoto} disabled={busy} className="min-h-[52px] rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'Processando…' : 'Usar foto'}
          </button>
        </div>
      ) : !error && (
        <div className="px-8 py-6 flex items-center justify-between">
          <button type="button" onClick={() => galleryRef.current?.click()} className="w-12 h-12 rounded-lg border border-white/40 bg-white/10 text-white flex items-center justify-center" aria-label="Galeria">
            <span className="material-symbols-outlined">photo_library</span>
          </button>
          <button type="button" onClick={capture} disabled={!ready || busy} className="w-18 h-18 rounded-full bg-white disabled:opacity-50 flex items-center justify-center" aria-label="Capturar" style={{ width: 72, height: 72 }}>
            <span className="w-16 h-16 rounded-full border-4 border-navy/80" />
          </button>
          <button type="button" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="w-12 h-12 rounded-lg border border-white/40 bg-white/10 text-white flex items-center justify-center" aria-label="Trocar câmera">
            <span className="material-symbols-outlined">cameraswitch</span>
          </button>
        </div>
      )}

      <input ref={galleryRef} type="file" accept="image/*" onChange={onGallery} className="hidden" />
    </div>
  );
};
