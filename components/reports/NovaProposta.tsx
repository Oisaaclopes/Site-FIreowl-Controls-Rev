'use client';

import React, { useMemo, useState } from 'react';
import { Client, InventoryItem, ServiceCatalogItem, Pendencia } from '@/lib/types';
import { montarProposta, RegimePrecificacao } from '@/lib/proposta';
import { gerarPdfProposta } from '@/lib/propostaPdf';
import { updatePendenciaStatus } from '@/lib/pendencias';
import { usePrivacy } from '@/lib/privacy';

interface NovaPropostaProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  inventory: InventoryItem[];
  services: ServiceCatalogItem[];
  pendencias: Pendencia[];
  onGenerated?: () => void;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const inputCls = 'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20';

export const NovaProposta: React.FC<NovaPropostaProps> = ({ open, onClose, clients, inventory, services, pendencias, onGenerated }) => {
  const { maskMoney } = usePrivacy();
  const [clienteId, setClienteId] = useState(clients[0]?.id || '');
  const [regime, setRegime] = useState<RegimePrecificacao>('unitario');
  const [contingenciaPct, setContingenciaPct] = useState(15);
  const [margemPct, setMargemPct] = useState(25);
  const [prazoDias, setPrazoDias] = useState(5);
  const [tecnicos, setTecnicos] = useState(2);
  const [logistica, setLogistica] = useState(0);
  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});

  const cliente = clients.find((c) => c.id === clienteId);
  const provisorio = !!cliente?.pendenteValidacao;

  // Pendências abertas do cliente (viram escopo)
  const abertas = useMemo(
    () => pendencias.filter((p) => p.status === 'aberta' && p.clienteId === clienteId),
    [pendencias, clienteId]
  );

  const precoItem = (p: Pendencia): number => {
    const nome = p.itemCatalogoId || '';
    const inv = inventory.find((i) => i.name === nome);
    if (inv) return inv.unitPrice || 0;
    const svc = services.find((s) => s.title === nome);
    if (svc) return svc.standardValue || 0;
    return 0;
  };

  const escolhidas = abertas.filter((p) => selecionadas[p.id] !== false); // default: todas marcadas

  const { composicao, publica } = useMemo(
    () =>
      montarProposta(escolhidas, {
        numero: `PROP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        cliente: cliente?.name || '',
        regime,
        contingenciaPct: contingenciaPct / 100,
        margemPct: margemPct / 100,
        precoItem,
        logistica,
        prazoDias,
        tecnicos,
        contexto: 'Proposta elaborada a partir de pendências de levantamento/preventiva em campo.',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escolhidas, cliente, regime, contingenciaPct, margemPct, logistica, prazoDias, tecnicos]
  );

  if (!open) return null;

  const semPreco = escolhidas.some((p) => precoItem(p) === 0);

  const gerar = async () => {
    if (provisorio || escolhidas.length === 0) return;
    gerarPdfProposta(publica);
    // Move as pendências para "orçada" (best-effort; requer admin/gestor na RLS).
    try {
      await Promise.all(
        escolhidas.map((p) => updatePendenciaStatus(p.id, 'orcada', { propostaId: publica.numero }))
      );
      onGenerated?.();
    } catch (err) {
      console.warn('Proposta gerada, mas não foi possível marcar as pendências como orçadas.', err);
    }
  };

  const CompRow: React.FC<{ label: string; valor: number; bold?: boolean }> = ({ label, valor, bold }) => (
    <div className={`flex justify-between ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className="font-data-mono">{maskMoney(brl(valor))}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase">Nova proposta</h3>
            <p className="text-[11px] text-slate-500">Monta o escopo a partir das pendências abertas do cliente.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Coluna esquerda: parâmetros + pendências */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Cliente</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputCls}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.pendenteValidacao ? ' (provisório)' : ''}</option>
                ))}
              </select>
            </div>

            {provisorio && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-[11px] text-amber-800 font-semibold">
                Cliente provisório: não pode receber proposta antes da homologação (§8.1). Homologue no Conta & Log.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Regime</label>
                <select value={regime} onChange={(e) => setRegime(e.target.value as RegimePrecificacao)} className={inputCls}>
                  <option value="unitario">Unitário</option>
                  <option value="fechado">Fechado</option>
                  <option value="fechado_com_anexo">Fechado + anexo</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Contingência (%)</label>
                <input type="number" value={contingenciaPct} onChange={(e) => setContingenciaPct(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Margem (%)</label>
                <input type="number" value={margemPct} onChange={(e) => setMargemPct(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Logística (R$)</label>
                <input type="number" value={logistica} onChange={(e) => setLogistica(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Prazo (dias)</label>
                <input type="number" value={prazoDias} onChange={(e) => setPrazoDias(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Técnicos</label>
                <input type="number" value={tecnicos} onChange={(e) => setTecnicos(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-600 mb-1">Pendências abertas ({abertas.length})</p>
              {abertas.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Este cliente não tem pendências abertas.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {abertas.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-[11px] border border-slate-100 rounded-lg p-2">
                      <input
                        type="checkbox"
                        checked={selecionadas[p.id] !== false}
                        onChange={(e) => setSelecionadas((s) => ({ ...s, [p.id]: e.target.checked }))}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-slate-800">{p.grupo || 'Pendência'}</span> — {p.descricao}
                        {precoItem(p) === 0 && <span className="ml-1 text-amber-600 font-semibold">(a precificar)</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: composição interna (só nesta tela; nunca no PDF) */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Composição interna (não vai ao PDF)</p>
              <div className="space-y-1 text-xs">
                <CompRow label="Materiais" valor={composicao.materiais} />
                <CompRow label="Mão de obra (70/30)" valor={composicao.maoDeObra} />
                <CompRow label="Logística" valor={composicao.logistica} />
                <div className="border-t border-slate-200 my-1" />
                <CompRow label="Subtotal de custo" valor={composicao.subtotalCusto} bold />
                <CompRow label={`Contingência (${contingenciaPct}%)`} valor={composicao.contingencia} />
                <CompRow label={`Margem (${margemPct}%)`} valor={composicao.margem} />
                <div className="border-t border-slate-200 my-1" />
                <div className="flex justify-between font-bold text-[#1A1A72] text-sm">
                  <span>Preço de venda</span>
                  <span className="font-data-mono">{maskMoney(brl(composicao.precoVenda))}</span>
                </div>
              </div>
              {semPreco && (
                <p className="text-[10px] text-amber-600 mt-2">Há itens sem preço (fora do catálogo) — entram como linha a precificar.</p>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              No PDF do cliente aparece só o <b>preço de venda</b> — custo, contingência e margem nunca são impressos (trava anti-vazamento).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg uppercase">Cancelar</button>
          <button
            onClick={gerar}
            disabled={provisorio || escolhidas.length === 0}
            className="px-5 py-2 rounded-lg bg-[#E63946] hover:bg-[#a51515] disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            Gerar proposta (PDF)
          </button>
        </div>
      </div>
    </div>
  );
};
