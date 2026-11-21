import React, { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import type { Pedido } from '@/lib/types';
import { showToast } from '@/components/ui/Feedback';
import { isNotaFiscalEmitida, pedidoValorNota, registrarNotaFiscalEmitida } from '@/lib/notaFiscal';

const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);

interface Props {
  pedido: Pedido;
  autor?: string;
  onSave: (pedido: Pedido) => void;
  onClose: () => void;
}

/**
 * Registrar/editar a NF emitida de um pedido (nº, data, observação).
 * Usado na linha do pedido (a partir de ACEITO — NF pode sair antes da
 * conclusão), na pendência "Emitir nota fiscal" e no card de emitidas.
 */
export const NotaFiscalRegistroModal: React.FC<Props> = ({ pedido, autor, onSave, onClose }) => {
  const nf = pedido.proposal?.notaFiscal;
  const editando = isNotaFiscalEmitida(pedido);
  const [numero, setNumero] = useState(nf?.numero || '');
  const [data, setData] = useState((editando && nf?.dataEmissao?.slice(0, 10)) || hoje());
  const [obs, setObs] = useState(nf?.observacao || '');

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    onSave(registrarNotaFiscalEmitida(pedido, { numero, dataEmissao: data, observacao: obs }, autor));
    showToast(
      `NF${numero.trim() ? ` nº ${numero.trim()}` : ''} ${editando ? 'atualizada' : 'registrada como emitida'} — pedido ${pedido.numeroPedido}.`,
      'success',
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <form
        onSubmit={salvar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nf-registro-title"
        className="bg-surface w-full max-w-md rounded-xl shadow-2xl flex flex-col"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
              {editando ? 'Editar nota fiscal' : 'Informar nota fiscal emitida'}
            </p>
            <h3 id="nf-registro-title" className="font-bold text-fg mt-1 truncate">{pedido.clienteNome || 'Cliente'}</h3>
            <p className="text-xs text-fg-secondary">
              Pedido <span className="font-data-mono">{pedido.numeroPedido}</span> ·{' '}
              <span className="font-data-mono font-semibold text-emerald-700">{brl(pedidoValorNota(pedido))}</span>
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Nº da NF</span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              autoFocus
              placeholder="Ex.: 001234"
              className="w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-2 text-sm font-data-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Data de emissão</span>
            <input
              type="date"
              value={data}
              max={hoje()}
              required
              onChange={(e) => setData(e.target.value)}
              className="w-full bg-surface text-fg border border-border rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[11px] font-bold text-fg-secondary uppercase mb-1">Observação (opcional)</span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: faturamento antecipado, 50% na aceitação…"
              className="w-full bg-surface text-fg border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <p className="sm:col-span-2 text-[11px] text-fg-muted">
            O número pode ficar em branco e ser informado depois. Registro administrativo — não emite NF-e.
          </p>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-fg-secondary hover:bg-surface-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1"
          >
            <BadgeCheck className="w-3.5 h-3.5" /> {editando ? 'Salvar' : 'Marcar emitida'}
          </button>
        </div>
      </form>
    </div>
  );
};
