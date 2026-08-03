'use client';

import React, { useState } from 'react';
import { Supplier } from '@/lib/types';
import { SidePanel, FormSection, Toggle } from '@/components/SidePanel';

interface FornecedoresViewProps {
  suppliers: Supplier[];
  onAddSupplier: (s: Supplier) => void;
}

let fornSeq = 10;

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

export const FornecedoresView: React.FC<FornecedoresViewProps> = ({
  suppliers,
  onAddSupplier,
}) => {
  const [showPanel, setShowPanel] = useState(false);

  // Form State
  const [isPJ, setIsPJ] = useState(true);
  const [name, setName] = useState('');
  const [cnpj, setCNPJ] = useState('');
  const [category, setCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(0);

  const openPanel = () => {
    setIsPJ(true);
    setName('');
    setCNPJ('');
    setCategory('');
    setContactName('');
    setPhone('');
    setEmail('');
    setCity('');
    setLeadTimeDays(0);
    setShowPanel(true);
  };

  const handleCreateSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
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
    setShowPanel(false);
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
          onClick={openPanel}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Fornecedor
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

      {/* Drawer: Novo Fornecedor */}
      <SidePanel
        open={showPanel}
        title="Novo fornecedor"
        subtitle="Cadastro e homologação"
        onClose={() => setShowPanel(false)}
        onSave={() => handleCreateSupplier()}
        saveLabel="Salvar"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-5 text-xs font-medium">
          {/* Bloco: Dados da empresa */}
          <FormSection
            icon="apartment"
            title="Dados da empresa"
            action={<Toggle checked={isPJ} onChange={setIsPJ} label={isPJ ? 'Pessoa jurídica' : 'Pessoa física'} />}
          >
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Razão social / Nome *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Siemens Building Technologies"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isPJ ? 'CNPJ' : 'CPF'}</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCNPJ(e.target.value)}
                    placeholder={isPJ ? '00.000.000/0001-00' : '000.000.000-00'}
                    className={`${inputCls} font-data-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex.: Centrais & Detecção"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Bloco: Contatos */}
          <FormSection icon="contacts" title="Contatos">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Contato principal</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nome do responsável"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 0000-0000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>E-mail comercial</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendas@fornecedor.com"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Bloco: Logística & homologação */}
          <FormSection icon="local_shipping" title="Logística & homologação">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cidade / UF</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Londrina / PR"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Prazo de entrega (dias)</label>
                <input
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
            </div>
          </FormSection>

          {/* submit oculto: permite salvar com Enter */}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </SidePanel>
    </div>
  );
};
