'use client';

import React, { useRef, useState } from 'react';
import { registerSignature } from '@/lib/signatures';
import { ReportSignature } from '@/lib/types';

interface SignatureCanvasProps {
  open: boolean;
  papel?: ReportSignature['papel'];
  onClose: () => void;
  onDone: (signatureId: string, nome: string) => void;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ open, papel = 'cliente', onClose, onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [cargo, setCargo] = useState('');
  const [err, setErr] = useState('');

  if (!open) return null;

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };
  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    if (!nome.trim()) {
      setErr('Informe o nome de quem assina.');
      return;
    }
    if (!hasDrawn) {
      setErr('Colete a assinatura no quadro.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const id = registerSignature(blob, { nome: nome.trim(), documento: documento.trim() || undefined, cargo: cargo.trim() || undefined, papel });
      onDone(id, nome.trim());
      // reset para próxima
      setNome('');
      setDocumento('');
      setCargo('');
      clear();
      setErr('');
    }, 'image/png');
  };

  const inputCls =
    'w-full border border-border rounded-lg p-2.5 text-fg bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl border border-border flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-bold text-fg uppercase">Coleta de assinatura</h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={inputCls} placeholder="Nome *" value={nome} onChange={(e) => { setNome(e.target.value); setErr(''); }} />
            <input className={`${inputCls} font-data-mono`} placeholder="Documento (CPF/RG)" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            <input className={inputCls} placeholder="Cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>

          <div className="rounded-lg border-2 border-dashed border-border-strong bg-surface-2 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={900}
              height={320}
              className="w-full touch-none block bg-surface"
              style={{ height: 220 }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
          </div>
          <p className="text-[10px] text-fg-muted">Assine no quadro acima com o dedo ou o mouse. Melhor com o celular na horizontal.</p>
          {err && <p className="text-[11px] font-semibold text-danger">{err}</p>}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <button onClick={clear} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:text-fg uppercase">Limpar</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 rounded-lg uppercase">Cancelar</button>
            <button onClick={confirm} className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 text-white text-xs font-semibold uppercase tracking-wide">Confirmar assinatura</button>
          </div>
        </div>
      </div>
    </div>
  );
};
