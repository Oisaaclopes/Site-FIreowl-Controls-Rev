'use client';

import React, { useState } from 'react';
import { Supplier } from '@/lib/types';
import { SidePanel, FormSection, Toggle } from '@/components/SidePanel';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';

const supplierStatusColor = (status: Supplier['activeStatus']) =>
  status === 'HOMOLOGADO' ? 'emerald' : status === 'EM AVALIACAO' ? 'amber' : 'red';

interface FornecedoresViewProps {
  suppliers: Supplier[];
  onAddSupplier: (s: Supplier) => void;
  onUpdateSupplier?: (s: Supplier) => void;
  onDeleteSupplier?: (id: string) => void;
}

let fornSeq = 10;

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

export const FornecedoresView: React.FC<FornecedoresViewProps> = ({
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

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
    setEditing(null);
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

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setIsPJ(true);
    setName(s.name);
    setCNPJ(s.cnpj);
    setCategory(s.category);
    setContactName(s.contactName);
    setPhone(s.phone);
    setEmail(s.email);
    setCity(s.city);
    setLeadTimeDays(s.leadTimeDays);
    setShowPanel(true);
  };

  const handleDelete = (s: Supplier) => {
    if (!onDeleteSupplier) return;
    if (!window.confirm(`Excluir o fornecedor "${s.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    onDeleteSupplier(s.id);
  };

  const handleCreateSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      onUpdateSupplier?.({
        ...editing,
        name,
        cnpj,
        category,
        contactName,
        phone,
        email,
        city,
        leadTimeDays: Number(leadTimeDays),
      });
      setShowPanel(false);
      setEditing(null);
      return;
    }
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
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
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

      {/* Lista de fornecedores */}
      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">local_shipping</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhum fornecedor cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;Novo Fornecedor&quot; para homologar o primeiro.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suppliers.map((s) => (
            <DataListRow
              key={s.id}
              leading={
                <span className="w-10 h-10 bg-[#1A1A72] text-white font-bold rounded-lg flex items-center justify-center text-xs shrink-0">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
              }
              title={<span className="uppercase">{s.name}</span>}
              meta={
                <>
                  <RowMeta label="Cód" value={<span className="font-data-mono">{s.code}</span>} />
                  <RowMeta label="CNPJ" value={<span className="font-data-mono">{s.cnpj}</span>} />
                  <RowMeta label="Categoria" value={s.category} />
                  <RowMeta label="Cidade" value={s.city} />
                </>
              }
              center={
                <div className="text-left md:text-center">
                  <p className="text-slate-700 font-semibold">{s.contactName}</p>
                  <p className="text-[10px] text-slate-500 font-data-mono">{s.phone}</p>
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                    ★ {s.rating.toFixed(1)} · {s.leadTimeDays}d
                  </p>
                </div>
              }
              right={
                <>
                  <Badge color={supplierStatusColor(s.activeStatus)}>{s.activeStatus}</Badge>
                  <div className="flex items-center gap-1">
                    <RowAction
                      icon="mail"
                      label="Enviar e-mail ao fornecedor"
                      onClick={() => {
                        window.location.href = `mailto:${s.email}`;
                      }}
                    />
                    <RowAction icon="edit" label="Editar fornecedor" onClick={() => openEdit(s)} />
                    <RowAction icon="delete" label="Excluir fornecedor" danger onClick={() => handleDelete(s)} />
                  </div>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Drawer: Novo / Editar Fornecedor */}
      <SidePanel
        open={showPanel}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        subtitle={editing ? editing.code : 'Cadastro e homologação'}
        onClose={() => {
          setShowPanel(false);
          setEditing(null);
        }}
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
