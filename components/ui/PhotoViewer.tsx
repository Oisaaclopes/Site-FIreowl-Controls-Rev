'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Visualizador pequeno para URLs locais (blob:) ou remotas assinadas. */
export const PhotoViewer: React.FC<Props> = ({ src, alt = 'Fotografia', onClose }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const contain = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizar ${alt}`}
      onClick={contain}
      onPointerDown={contain}
      onPointerUp={contain}
      onTouchStart={contain}
      onTouchEnd={contain}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <span className="truncate pr-3 text-xs font-bold uppercase tracking-wide text-white/80">{alt}</span>
        <button type="button" onClick={onClose} className="material-symbols-outlined rounded-full bg-white/10 p-2" aria-label="Fechar fotografia">close</button>
      </div>
      <div className="relative min-h-0 flex-1">
        {!failed ? (
          <Image src={src} alt={alt} fill sizes="100vw" unoptimized className="object-contain" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/75">
            <span className="material-symbols-outlined text-5xl">broken_image</span>
            <p className="mt-3 text-sm">Não foi possível carregar esta imagem agora.</p>
            <p className="mt-1 text-xs text-white/55">Feche e tente novamente quando a conexão estiver disponível.</p>
          </div>
        )}
      </div>
    </div>
  );
};
