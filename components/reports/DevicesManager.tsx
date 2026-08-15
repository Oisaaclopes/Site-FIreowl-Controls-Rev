'use client';

import React, { useEffect, useState } from 'react';
import { Device, PartnerBrand, Supplier, InventoryItem } from '@/lib/types';
import { fetchDevices, upsertDevice, deleteDevice } from '@/lib/devices';
import { isSupabaseConfigured } from '@/lib/inventory';

interface DevicesManagerProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  /** Fabricantes cadastrados (marcas parceiras) para o seletor. */
  fabricantes: PartnerBrand[];
  /** Fornecedores — para mostrar quem trabalha a marca escolhida. */
  suppliers: Supplier[];
  /** Estoque — para mostrar se há itens da marca/modelo. */
  inventory: InventoryItem[];
  /** Cadastra um novo fabricante e o deixa disponível na lista. */
  onAddFabricante: (name: string) => void;
}

const inputCls = 'w-full border border-slate-200 rounded-lg p-2 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20';

// Tipos de dispositivo SDAI. A CENTRAL é um dispositivo como os demais — por isso
// encabeça a lista. (CFTV/Controle de Acesso/BMS terão seus próprios tipos depois.)
const TIPOS_SDAI = [
  'Central de alarme endereçável',
  'Central de alarme convencional',
  'Repetidor',
  'Detector óptico de fumaça',
  'Detector de temperatura / termovelocimétrico',
  'Detector linear (barreira)',
  'Acionador manual',
  'Sirene audiovisual',
  'Módulo isolador',
  'Módulo de comando / relé',
];

const emptyForm = (clienteId: string): Device => ({
  id: '',
  clienteId,
  sistema: 'SDAI',
  central: '',
  laco: '',
  endereco: '',
  tipoDispositivo: '',
  fabricante: '',
  modelo: '',
  localizacao: '',
  pavimento: '',
  status: 'ativo',
});

export const DevicesManager: React.FC<DevicesManagerProps> = ({ open, onClose, clienteId, clienteNome, fabricantes, suppliers, inventory, onAddFabricante }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Device>(emptyForm(clienteId));
  const [err, setErr] = useState<string | null>(null);
  const [addingFab, setAddingFab] = useState(false);
  const [newFab, setNewFab] = useState('');

  // Centrais já cadastradas deste cliente (para referência dos demais dispositivos).
  const centraisExistentes = Array.from(
    new Set(devices.map((d) => (d.central || '').trim()).filter(Boolean))
  );

  // Interligação marca -> fornecedor -> estoque (pela marca escolhida no form).
  const marca = (form.fabricante || '').trim();
  const marcaLc = marca.toLowerCase();
  const fornecedoresDaMarca = marca
    ? suppliers.filter((s) => (s.brands || []).some((b) => b.toLowerCase() === marcaLc))
    : [];
  const itensEmEstoque = marca
    ? inventory.filter((i) => (i.brand || '').trim().toLowerCase() === marcaLc)
    : [];
  const qtdEstoque = itensEmEstoque.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const modelosEstoque = Array.from(
    new Set(itensEmEstoque.map((i) => i.model || i.name).filter(Boolean))
  ).slice(0, 4);

  const confirmarFab = () => {
    const nome = newFab.trim();
    if (!nome) return;
    onAddFabricante(nome);
    setForm((f) => ({ ...f, fabricante: nome }));
    setNewFab('');
    setAddingFab(false);
  };

  const load = () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    fetchDevices(clienteId)
      .then(setDevices)
      .catch((e) => console.warn('Dispositivos: falha ao carregar.', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      setForm(emptyForm(clienteId));
      setErr(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId]);

  if (!open) return null;

  const set = (k: keyof Device, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    if (!form.tipoDispositivo && !form.endereco) {
      setErr('Informe ao menos o tipo do dispositivo ou o endereço.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const saved = await upsertDevice({ ...form, clienteId });
      setDevices((prev) => [saved, ...prev]);
      setForm(emptyForm(clienteId));
    } catch (e: any) {
      // Índice único parcial (cliente+central+laço+endereço) pode barrar duplicata.
      setErr(e?.message?.includes('duplicate') ? 'Já existe um dispositivo ativo com este central/laço/endereço.' : 'Não foi possível salvar o dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remover este dispositivo?')) return;
    try {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert('Não foi possível remover.');
    }
  };

  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase">Dispositivos (as-built)</h3>
            <p className="text-[11px] text-slate-500 truncate">{clienteNome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Formulário de cadastro */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] font-semibold uppercase text-slate-600">Novo dispositivo</p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A72] bg-[#1A1A72]/10 px-2 py-0.5 rounded">SDAI</span>
              <span className="text-[10px] text-slate-400">CFTV, Controle de Acesso e BMS terão cadastro próprio (em breve).</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              A <b>central é um dispositivo</b>: cadastre-a com Tipo “Central de alarme…” e um identificador em <b>Central</b> (ex.: “Central 01”). Os demais dispositivos apontam para ela por esse identificador (Central / Laço / Endereço = endereçamento).
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Central: referência a um painel já cadastrado deste cliente (ou novo) */}
              <input list="dm-centrais" className={inputCls} placeholder="Central (ex.: Central 01)" value={form.central || ''} onChange={(e) => set('central', e.target.value)} />
              <datalist id="dm-centrais">{centraisExistentes.map((c) => <option key={c} value={c} />)}</datalist>

              <input className={inputCls} placeholder="Laço (1-10)" inputMode="numeric" value={form.laco || ''} onChange={(e) => set('laco', e.target.value)} />
              <input className={inputCls} placeholder="Endereço" inputMode="numeric" value={form.endereco || ''} onChange={(e) => set('endereco', e.target.value)} />

              {/* Tipo: lista SDAI (a Central é uma opção) + texto livre */}
              <input list="dm-tipos" className={`${inputCls} col-span-2`} placeholder="Tipo (ex.: Detector óptico)" value={form.tipoDispositivo || ''} onChange={(e) => set('tipoDispositivo', e.target.value)} />
              <datalist id="dm-tipos">{TIPOS_SDAI.map((t) => <option key={t} value={t} />)}</datalist>

              {/* Fabricante: lista cadastrada + cadastrar novo */}
              {addingFab ? (
                <div className="col-span-2 flex gap-1">
                  <input autoFocus className={inputCls} placeholder="Novo fabricante" value={newFab}
                    onChange={(e) => setNewFab(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarFab(); } }} />
                  <button type="button" onClick={confirmarFab} className="px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold">OK</button>
                  <button type="button" onClick={() => { setAddingFab(false); setNewFab(''); }} className="px-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-[11px]">✕</button>
                </div>
              ) : (
                <select className={inputCls} value={form.fabricante || ''}
                  onChange={(e) => { if (e.target.value === '__novo__') setAddingFab(true); else set('fabricante', e.target.value); }}>
                  <option value="">Fabricante…</option>
                  {form.fabricante && !fabricantes.some((f) => f.name === form.fabricante) && (
                    <option value={form.fabricante}>{form.fabricante}</option>
                  )}
                  {fabricantes.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                  <option value="__novo__">＋ Cadastrar novo fabricante…</option>
                </select>
              )}

              <input className={inputCls} placeholder="Modelo" value={form.modelo || ''} onChange={(e) => set('modelo', e.target.value)} />
              <input className={inputCls} placeholder="Localização" value={form.localizacao || ''} onChange={(e) => set('localizacao', e.target.value)} />
              <input className={inputCls} placeholder="Pavimento" value={form.pavimento || ''} onChange={(e) => set('pavimento', e.target.value)} />
            </div>

            {/* Interligação: quem fornece a marca escolhida e se há em estoque */}
            {marca && (
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-sm text-slate-400 mt-px">local_shipping</span>
                  <span>
                    <span className="font-semibold text-slate-600">Fornecedores de {marca}: </span>
                    {fornecedoresDaMarca.length === 0 ? (
                      <span className="text-amber-600">nenhum fornecedor marcou esta marca — defina em Fornecedores.</span>
                    ) : (
                      <span className="text-slate-700">
                        {fornecedoresDaMarca.map((s) => `${s.name}${s.leadTimeDays ? ` (${s.leadTimeDays}d)` : ''}`).join(' · ')}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-sm text-slate-400 mt-px">inventory_2</span>
                  <span>
                    <span className="font-semibold text-slate-600">Em estoque: </span>
                    {qtdEstoque > 0 ? (
                      <span className="text-emerald-700 font-semibold">{qtdEstoque} un</span>
                    ) : (
                      <span className="text-slate-400">sem itens desta marca no estoque</span>
                    )}
                    {modelosEstoque.length > 0 && (
                      <span className="text-slate-400"> · {modelosEstoque.join(', ')}</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {err && <p className="text-[11px] font-semibold text-[#E63946]">{err}</p>}
            <button onClick={add} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wide">
              {saving ? 'Salvando…' : 'Adicionar dispositivo'}
            </button>
          </div>

          {/* Lista */}
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-6">Carregando…</p>
          ) : devices.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-6">Nenhum dispositivo cadastrado para este cliente.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase text-slate-600">{devices.length} dispositivo(s)</p>
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {d.tipoDispositivo || 'Dispositivo'} {d.modelo ? `· ${d.modelo}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400 font-data-mono">
                      {d.sistema} · {[d.central, d.laco, d.endereco].filter(Boolean).join(' / ') || 'sem endereço'}
                      {d.localizacao ? ` · ${d.localizacao}` : ''}
                    </p>
                  </div>
                  <button onClick={() => remove(d.id)} className="text-slate-400 hover:text-[#E63946] shrink-0" title="Remover">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
