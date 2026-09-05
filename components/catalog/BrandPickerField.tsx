'use client';
import React, { useState } from 'react';
import { PickerField } from '@/components/ui/PickerField';
import { findExistingBrand } from '@/lib/catalogSelection';

/* ===================================================================
 * Seletor de FABRICANTE (base canônica `brands`) + cadastro inline.
 * Lista marcas existentes (marcas cadastradas ∪ marcas do catálogo), busca e
 * ordena. "+ Cadastrar nova marca" cria sem inventar inventory_item fake; a
 * deduplicação normaliza caixa/espaço/acento — "TECNOHOLD" == "Tecnohold".
 * Não perde o estado do formulário pai: só cria/seleciona a marca.
 * =================================================================== */

interface Props {
  brands: string[];
  value: string;
  onChange: (name: string) => void;
  /** Persiste a marca e devolve o nome canônico salvo (para seleção). */
  onCreate: (name: string) => Promise<string>;
  onError?: (msg: string) => void;
  triggerClassName?: string;
}

export const BrandPickerField: React.FC<Props> = ({ brands, value, onChange, onCreate, onError, triggerClassName }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    const nome = name.trim();
    if (!nome) { onError?.('Informe o nome do fabricante.'); return; }
    // Dedup local: se já existe marca equivalente, apenas seleciona.
    const existing = findExistingBrand(nome, brands);
    if (existing) { onChange(existing); setName(''); setOpen(false); return; }
    setSaving(true);
    try {
      const saved = await onCreate(nome);
      onChange(saved || nome);
      setName('');
      setOpen(false);
    } catch (e: any) {
      onError?.(e?.message || 'Não foi possível cadastrar a marca.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <PickerField
          ariaLabel="Fabricante"
          sheetTitle="Selecionar fabricante"
          placeholder="Selecionar fabricante"
          searchPlaceholder="Buscar fabricante..."
          emptyLabel="Nenhum fabricante cadastrado."
          value={value}
          onChange={onChange}
          options={brands.map((b) => ({ id: b, name: b }))}
          triggerClassName={triggerClassName || 'flex-1 flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg-secondary'}
        />
        <button type="button" onClick={() => { setOpen((v) => !v); setName(''); }} className="shrink-0 rounded-md border border-primary px-3 py-2 text-xs font-bold text-primary hover:bg-navy hover:text-white">+ Nova</button>
      </div>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-fg-secondary">Nova marca / fabricante</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } }}
            placeholder="Nome do fabricante (ex.: Bosch)"
            className="w-full rounded-md border border-border-strong px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setName(''); }} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:bg-surface">Cancelar</button>
            <button type="button" onClick={salvar} disabled={saving} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-navy disabled:opacity-50">{saving ? 'Salvando…' : 'Cadastrar e selecionar'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
