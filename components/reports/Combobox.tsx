'use client';

import React, { useEffect, useRef, useState } from 'react';

/* Combobox de lista clássica: fundo branco, borda fina, item ativo azul sólido,
 * hover cinza sutil, e uma ação fixa no topo ("Cadastrar novo…") que abre um
 * modal rápido de cadastro sem sair da tela. Substitui o <datalist> nativo. */

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  /** Rótulo da ação fixa no topo. Ex.: "Cadastrar nova marca". Sem isso, sem ação. */
  createLabel?: string;
  /** Chamado ao confirmar o cadastro rápido (para persistir, quando aplicável). */
  onCreate?: (name: string) => void;
}

const inputCls =
  'w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 focus:border-[#1A1A72]/40';

export const Combobox: React.FC<ComboboxProps> = ({ value, onChange, options, placeholder, createLabel, onCreate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
    setQuery('');
  };

  const abrirCadastro = () => {
    setOpen(false);
    setNovoNome(query || value || '');
    setModalOpen(true);
  };
  const confirmarCadastro = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    onChange(nome);
    onCreate?.(nome);
    setModalOpen(false);
    setNovoNome('');
    setQuery('');
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className={inputCls}
        value={open ? query : value}
        placeholder={open && !query ? value || placeholder || 'Buscar…' : placeholder || 'Buscar…'}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />

      {open && (
        <div className="absolute left-0 right-0 top-full -mt-px z-50 bg-white border border-gray-300 rounded-b-md shadow-lg max-h-60 overflow-y-auto">
          {/* Ação fixa no topo */}
          {createLabel && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                abrirCadastro();
              }}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-blue-600 font-semibold text-xs hover:bg-blue-50 border-b border-gray-200"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {createLabel}
            </button>
          )}
          {/* Resultados */}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-400 italic">Nenhum resultado.</p>
          ) : (
            filtered.map((o) => {
              const sel = o === value;
              return (
                <button
                  key={o}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs ${
                    sel ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-gray-100'
                  }`}
                >
                  {o}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Modal de cadastro rápido */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => setModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xs rounded-xl shadow-2xl border border-slate-200 p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-slate-900 uppercase mb-2">{createLabel || 'Cadastrar'}</p>
            <input
              autoFocus
              className={inputCls}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmarCadastro();
                }
              }}
              placeholder="Nome"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCadastro}
                disabled={!novoNome.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] text-white text-xs font-bold uppercase disabled:opacity-40"
              >
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
