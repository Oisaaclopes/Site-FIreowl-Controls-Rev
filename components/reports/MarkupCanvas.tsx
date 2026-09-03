'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MarkupCanvasProps {
  open: boolean;
  /** URL da foto original (object URL do registro transitório). */
  imageUrl?: string;
  onClose: () => void;
  /** Recebe o blob JPEG da foto já com as marcações desenhadas. */
  onDone: (marked: Blob) => void;
}

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

const CORES = [
  { nome: 'Vermelho', hex: '#E63946' },
  { nome: 'Amarelo', hex: '#FFB703' },
  { nome: 'Preto', hex: '#0f172a' },
];
const MAX_DIM = 1600;

/**
 * Editor de marcação de fotos (setas/círculos/traços). Preserva a foto original
 * — o resultado é uma cópia com as anotações "queimadas" sobre a imagem.
 */
export const MarkupCanvas: React.FC<MarkupCanvasProps> = ({ open, imageUrl, onClose, onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [cor, setCor] = useState(CORES[0].hex);
  const [largura, setLargura] = useState(5);
  const [pronto, setPronto] = useState(false);

  // Carrega a imagem e dimensiona o canvas ao tamanho dela (limitado).
  useEffect(() => {
    if (!open || !imageUrl) return;
    setStrokes([]);
    setPronto(false);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let { width, height } = img;
      const maior = Math.max(width, height);
      if (maior > MAX_DIM) {
        const s = MAX_DIM / maior;
        width = Math.round(width * s);
        height = Math.round(height * s);
      }
      canvas.width = width;
      canvas.height = height;
      imgRef.current = img;
      setPronto(true);
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  // Redesenha imagem + todos os traços a cada alteração (permite desfazer).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img || !pronto) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => {
      if (s.points.length < 1) return;
      ctx.beginPath();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  }, [strokes, pronto]);

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
    drawing.current = true;
    const p = pos(e);
    setStrokes((prev) => [...prev, { color: cor, width: largura, points: [p] }]);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pos(e);
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const cur = next[next.length - 1];
      next[next.length - 1] = { ...cur, points: [...cur.points, p] };
      return next;
    });
  };
  const end = () => {
    drawing.current = false;
  };

  const desfazer = () => setStrokes((prev) => prev.slice(0, -1));
  const limpar = () => setStrokes([]);

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (blob) onDone(blob);
        onClose();
      },
      'image/jpeg',
      0.85
    );
  };

  return (
    <div className="fixed inset-0 z-[65] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface w-full max-w-3xl rounded-xl shadow-2xl border border-border flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-bold text-fg uppercase">Marcar foto</h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Barra de ferramentas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {CORES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setCor(c.hex)}
                  title={c.nome}
                  className={`w-6 h-6 rounded-full border-2 ${cor === c.hex ? 'border-slate-900' : 'border-white'} shadow`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
              <span>Espessura</span>
              <input type="range" min={2} max={14} value={largura} onChange={(e) => setLargura(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={desfazer} disabled={strokes.length === 0} className="text-[11px] font-semibold text-fg-secondary hover:text-fg disabled:opacity-40 uppercase">
                Desfazer
              </button>
              <button onClick={limpar} disabled={strokes.length === 0} className="text-[11px] font-semibold text-danger hover:underline disabled:opacity-40 uppercase">
                Limpar
              </button>
            </div>
          </div>

          <div className="rounded-lg border-2 border-dashed border-border-strong bg-surface-3 overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full touch-none block"
              style={{ maxHeight: '55vh' }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
          </div>
          <p className="text-[10px] text-fg-muted">Desenhe sobre a foto com o dedo ou o mouse para destacar o problema. O original é preservado.</p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 rounded-lg uppercase">Cancelar</button>
          <button
            onClick={confirmar}
            disabled={strokes.length === 0}
            className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            Salvar marcação
          </button>
        </div>
      </div>
    </div>
  );
};
