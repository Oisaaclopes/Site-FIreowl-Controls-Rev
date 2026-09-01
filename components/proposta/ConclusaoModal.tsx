'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useMemo, useState } from 'react';
import { Pedido, RecebimentoProposta } from '@/lib/types';
import { CheckCircle, X } from 'lucide-react';

interface Props {
  pedido: Pedido;
  onClose: () => void;
  onConfirm: (recebimento: RecebimentoProposta) => void;
}

const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Transferência / TED', 'Cartão', 'Dinheiro', 'Cheque'];

const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Corrige overflow de fim de mês (ex.: 31 jan + 1 mês).
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().split('T')[0];
}

const todayISO = () => new Date().toISOString().split('T')[0];

export const ConclusaoModal: React.FC<Props> = ({ pedido, onClose, onConfirm }) => {
  const total = pedido.proposal?.valorTotal || 0;
  const [forma, setForma] = useState<'avista' | 'parcelado'>('avista');
  const [valor, setValor] = useState<number>(total);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [dataRecebimento, setDataRecebimento] = useState<string>(todayISO());
  const [entrada, setEntrada] = useState<number>(0);
  const [numParcelas, setNumParcelas] = useState<number>(3);
  const [primeiroVenc, setPrimeiroVenc] = useState<string>(addMonthsISO(todayISO(), 1));

  const parcelas = useMemo(() => {
    if (forma !== 'parcelado' || numParcelas < 1) return [];
    const base = round2(Math.max(0, valor - (entrada || 0)));
    const bruta = round2(base / numParcelas);
    const list: { numero: number; total: number; valor: number; vencimento: string }[] = [];
    let acumulado = 0;
    for (let i = 1; i <= numParcelas; i++) {
      // A última parcela absorve o arredondamento para fechar o total.
      const v = i === numParcelas ? round2(base - acumulado) : bruta;
      acumulado = round2(acumulado + v);
      list.push({ numero: i, total: numParcelas, valor: v, vencimento: addMonthsISO(primeiroVenc, i - 1) });
    }
    return list;
  }, [forma, valor, entrada, numParcelas, primeiroVenc]);

  const somaParcelas = parcelas.reduce((a, p) => a + p.valor, 0);
  const confere = forma === 'avista' ? true : round2((entrada || 0) + somaParcelas) === round2(valor);

  const confirmar = () => {
    if (valor <= 0) {
      showToast('Informe o valor recebido.');
      return;
    }
    if (forma === 'avista') {
      onConfirm({ forma: 'avista', valor: round2(valor), paymentMethod, dataRecebimento });
    } else {
      onConfirm({
        forma: 'parcelado',
        valor: round2(valor),
        paymentMethod,
        dataRecebimento,
        entrada: round2(entrada || 0),
        parcelas,
      });
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
  const labelCls = 'text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="font-display text-base font-bold text-emerald-700 uppercase tracking-wide">Concluir & Receber</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-500">
            Proposta <span className="font-data-mono font-bold text-slate-700">{pedido.numeroPedido}</span> — {pedido.clienteNome}.
            O recebimento será lançado no Financeiro (Receitas).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valor recebido</label>
              <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Forma de pagamento</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Como foi recebido?</label>
            <div className="grid grid-cols-2 gap-2">
              {(['avista', 'parcelado'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForma(f)}
                  className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-colors ${
                    forma === f ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {f === 'avista' ? 'À vista' : 'Parcelado'}
                </button>
              ))}
            </div>
          </div>

          {forma === 'avista' ? (
            <div>
              <label className={labelCls}>Data do recebimento</label>
              <input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} className={`${inputCls} font-data-mono`} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Entrada (pago agora)</label>
                  <input type="number" min={0} step="0.01" value={entrada} onChange={(e) => setEntrada(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nº de parcelas</label>
                  <input type="number" min={1} max={60} value={numParcelas} onChange={(e) => setNumParcelas(Math.max(1, Math.floor(Number(e.target.value))))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>1º vencimento</label>
                  <input type="date" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} className={`${inputCls} font-data-mono`} />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <span>Parcelas ({numParcelas}x)</span>
                  <span>{entrada > 0 ? `Entrada ${brl(entrada)}` : 'Sem entrada'}</span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {parcelas.map((p) => (
                    <div key={p.numero} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-semibold">{p.numero}/{p.total}</span>
                      <span className="font-data-mono text-slate-400">{p.vencimento}</span>
                      <span className="font-data-mono font-bold text-slate-800">{brl(p.valor)}</span>
                    </div>
                  ))}
                </div>
                {!confere && (
                  <p className="text-[11px] text-red-600 font-semibold mt-2">
                    Entrada + parcelas ({brl(entrada + somaParcelas)}) não fecham com o valor ({brl(valor)}).
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Cada parcela vira uma receita com vencimento no Financeiro. A entrada entra como recebida; as parcelas
                ficam pendentes até você confirmar o pagamento de cada uma.
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" /> Concluir & Lançar no Financeiro
          </button>
        </div>
      </div>
    </div>
  );
};
