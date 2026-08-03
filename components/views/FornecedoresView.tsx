'use client';

import React, { useState } from 'react';
import { Supplier } from '@/lib/types';

interface FornecedoresViewProps {
  suppliers: Supplier[];
  onAddSupplier: (s: Supplier) => void;
}

let fornSeq = 10;

export const FornecedoresView: React.FC<FornecedoresViewProps> = ({
  suppliers,
  onAddSupplier,
}) => {
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('Siemens Building Technologies');
  const [cnpj, setCNPJ] = useState('11.222.333/0001-99');
  const [category, setCategory] = useState('Centrais & Detecção');
  const [contactName, setContactName] = useState('Marcelo Prado');
  const [phone, setPhone] = useState('(11) 4004-9000');
  const [email, setEmail] = useState('vendas.siemens@siemens.com');
  const [city, setCity] = useState('São Paulo / SP');
  const [leadTimeDays, setLeadTimeDays] = useState(4);

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const seq = (fornSeq++).toString();
    const created: Supplier = {
      id: `forn-${seq}`,
      code: `FORN-0${seq}`,
      name,
      cnpj,
      category,
      contactName,
      phone,
      email,
      city,
      rating: 4.8,
      leadTimeDays: Number(leadTimeDays),
      activeStatus: 'HOMOLOGADO',
    };
    onAddSupplier(created);
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão de Cadeia de Suprimentos &amp; Homologação
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Fornecedores &amp; Parceiros Homologados
          </h1>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Homologar Fornecedor
        </button>
      </div>

      {/* Grid of Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-data-mono text-xs font-bold text-[#E63946]">{s.code}</span>
                  <h3 className="text-lg font-bold text-slate-900 uppercase mt-0.5">{s.name}</h3>
                  <p className="text-xs text-slate-500 font-data-mono">CNPJ: {s.cnpj}</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase">
                  {s.activeStatus}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-data-mono bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Categoria</span>
                  <span className="font-bold text-slate-900">{s.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Prazo de Entrega</span>
                  <span className="font-bold text-slate-900">{s.leadTimeDays} dias úteis</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Localização</span>
                  <span className="font-bold text-slate-900">{s.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Avaliação</span>
                  <span className="font-bold text-amber-600">★ {s.rating.toFixed(1)} / 5.0</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 text-xs flex justify-between items-center text-slate-600">
              <div>
                <strong className="text-slate-900 uppercase">Contato:</strong> {s.contactName} ({s.phone})
              </div>
              <a href={`mailto:${s.email}`} className="text-[#E63946] font-semibold hover:underline">
                {s.email}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Supplier */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Cadastrar Fornecedor</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">CNPJ</label>
                  <input
                    type="text"
                    required
                    value={cnpj}
                    onChange={(e) => setCNPJ(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Categoria</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Contato Principal</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Telefone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">E-mail Comercial</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Cidade / UF</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold uppercase">Prazo de Entrega (Dias)</label>
                  <input
                    type="number"
                    required
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Cadastrar e Homologar Fornecedor
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
