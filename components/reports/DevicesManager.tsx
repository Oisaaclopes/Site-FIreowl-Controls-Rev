'use client';

import React, { useEffect, useState } from 'react';
import { Device } from '@/lib/types';
import { fetchDevices, upsertDevice, deleteDevice } from '@/lib/devices';
import { isSupabaseConfigured } from '@/lib/inventory';

interface DevicesManagerProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
}

const inputCls = 'w-full border border-slate-200 rounded-lg p-2 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20';
const SISTEMAS: Device['sistema'][] = ['SDAI', 'CFTV', 'CONTROLE_ACESSO', 'BMS'];

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

export const DevicesManager: React.FC<DevicesManagerProps> = ({ open, onClose, clienteId, clienteNome }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Device>(emptyForm(clienteId));
  const [err, setErr] = useState<string | null>(null);

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
            <p className="text-[11px] font-semibold uppercase text-slate-600">Novo dispositivo</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select value={form.sistema} onChange={(e) => set('sistema', e.target.value)} className={inputCls}>
                {SISTEMAS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className={inputCls} placeholder="Central" value={form.central || ''} onChange={(e) => set('central', e.target.value)} />
              <input className={inputCls} placeholder="Laço" value={form.laco || ''} onChange={(e) => set('laco', e.target.value)} />
              <input className={inputCls} placeholder="Endereço" value={form.endereco || ''} onChange={(e) => set('endereco', e.target.value)} />
              <input className={`${inputCls} col-span-2`} placeholder="Tipo (ex.: Detector óptico)" value={form.tipoDispositivo || ''} onChange={(e) => set('tipoDispositivo', e.target.value)} />
              <input className={inputCls} placeholder="Fabricante" value={form.fabricante || ''} onChange={(e) => set('fabricante', e.target.value)} />
              <input className={inputCls} placeholder="Modelo" value={form.modelo || ''} onChange={(e) => set('modelo', e.target.value)} />
              <input className={inputCls} placeholder="Localização" value={form.localizacao || ''} onChange={(e) => set('localizacao', e.target.value)} />
              <input className={inputCls} placeholder="Pavimento" value={form.pavimento || ''} onChange={(e) => set('pavimento', e.target.value)} />
            </div>
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
