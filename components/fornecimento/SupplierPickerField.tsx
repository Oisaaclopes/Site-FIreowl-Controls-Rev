'use client';
import React, { useState } from 'react';
import { Supplier } from '@/lib/types';
import { upsertSupplier } from '@/lib/suppliers';
import { PickerField } from '@/components/ui/PickerField';

/* ===================================================================
 * Seletor ÚNICO de fornecedor (base canônica `suppliers`) + cadastro inline.
 * Reutilizado no Recebimento e no Registro de Compra — mesma fonte/UX (§26).
 * Não perde o estado do formulário pai: só cria/seleciona o fornecedor.
 * =================================================================== */
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`);

interface Props {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (s: Supplier) => void;   // pai adiciona à lista e seleciona
  online?: boolean;
  onError?: (msg: string) => void;
}

export const SupplierPickerField: React.FC<Props> = ({ suppliers, value, onChange, onCreated, online = true, onError }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cnpj: '', tradeName: '' });
  const [saving, setSaving] = useState(false);
  const selected = suppliers.find((s) => s.id === value);

  const salvar = async () => {
    const nome = form.name.trim();
    if (!nome) { onError?.('Informe o nome/razão social do fornecedor.'); return; }
    if (!online) { onError?.('Conecte-se à internet para cadastrar fornecedor.'); return; }
    setSaving(true);
    try {
      const created = await upsertSupplier({
        id: newId(), code: '', name: nome, cnpj: form.cnpj.trim(), category: '',
        contactName: '', phone: '', email: '', city: '', rating: 0, leadTimeDays: 0,
        activeStatus: 'EM AVALIACAO', brands: [], tradeName: form.tradeName.trim() || undefined,
      } as Supplier);
      onCreated(created);
      onChange(created.id);
      setForm({ name: '', cnpj: '', tradeName: '' });
      setOpen(false);
    } catch (e: any) { onError?.(e?.message || 'Não foi possível cadastrar o fornecedor.'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-3 text-center">
          <p className="text-[11px] text-fg-muted">Nenhum fornecedor cadastrado.</p>
          <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-bold text-primary hover:underline">+ Cadastrar primeiro fornecedor</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <PickerField
            ariaLabel="Fornecedor"
            sheetTitle="Selecionar fornecedor"
            placeholder="Selecionar fornecedor"
            searchPlaceholder="Buscar fornecedor..."
            emptyLabel="Nenhum fornecedor encontrado."
            value={value}
            onChange={onChange}
            options={suppliers.map((s) => ({ id: s.id, name: s.tradeName ? `${s.name} (${s.tradeName})` : s.name }))}
            triggerClassName="flex-1 flex items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-fg-secondary"
          />
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary hover:bg-navy hover:text-white">+ Novo</button>
        </div>
      )}
      {selected?.cnpj && <p className="mt-1 text-[10px] text-fg-muted">CNPJ: {selected.cnpj}</p>}

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-fg-secondary">Novo fornecedor</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome / Razão social *" className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm sm:col-span-2" />
            <input value={form.tradeName} onChange={(e) => setForm((p) => ({ ...p, tradeName: e.target.value }))} placeholder="Nome fantasia" className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="CNPJ" className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm" />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setForm({ name: '', cnpj: '', tradeName: '' }); }} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:bg-surface">Cancelar</button>
            <button type="button" onClick={salvar} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Cadastrar e selecionar'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
