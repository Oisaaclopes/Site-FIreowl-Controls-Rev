'use client';

import React, { useState } from 'react';
import { SystemAuditLog, UserRole, CompanyProfile, PartnerBrand } from '@/lib/types';
import { Building2, Layers, Plus, Trash2, Save, ShieldCheck } from 'lucide-react';

interface ContaViewProps {
  logs: SystemAuditLog[];
  userRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  companyProfile: CompanyProfile;
  onUpdateCompanyProfile: (cp: CompanyProfile) => void;
  partnerBrands: PartnerBrand[];
  onAddPartnerBrand: (brand: PartnerBrand) => void;
  onDeletePartnerBrand: (id: string) => void;
}

export const ContaView: React.FC<ContaViewProps> = ({
  logs,
  userRole,
  onSelectRole,
  companyProfile,
  onUpdateCompanyProfile,
  partnerBrands,
  onAddPartnerBrand,
  onDeletePartnerBrand,
}) => {
  // Local state for editing Company Profile
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);

  // Local state for adding new partner brand
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCategory, setNewBrandCategory] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCompanyProfile(profile);
    alert('Dados da Empresa atualizados com sucesso!');
  };

  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    onAddPartnerBrand({
      id: `pb_${Date.now()}`,
      name: newBrandName.trim(),
      category: newBrandCategory.trim() || 'Equipamentos e Alarme',
      logoUrl: newBrandLogo.trim() || undefined,
    });
    setNewBrandName('');
    setNewBrandCategory('');
    setNewBrandLogo('');
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Configurações da Empresa &amp; Rastreabilidade Integrada
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Conta, Dados da Empresa, Marcas Parceiras &amp; Auditoria
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 7: Company Profile Settings */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#ba1a1a]" /> Dados Cadastrais da Empresa (Capa e Propostas)
            </h3>
          </div>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-3 text-xs font-medium">
            <div>
              <label className="block text-slate-600 font-bold uppercase mb-1">Razão Social</label>
              <input
                type="text"
                required
                value={profile.razaoSocial}
                onChange={(e) => setProfile({ ...profile, razaoSocial: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">CNPJ</label>
                <input
                  type="text"
                  required
                  value={profile.cnpj}
                  onChange={(e) => setProfile({ ...profile, cnpj: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-data-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Regime Tributário</label>
                <input
                  type="text"
                  value={profile.regimeTributario}
                  onChange={(e) => setProfile({ ...profile, regimeTributario: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold uppercase mb-1">Endereço Completo</label>
              <input
                type="text"
                value={profile.endereco}
                onChange={(e) => setProfile({ ...profile, endereco: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">Telefone de Contato</label>
                <input
                  type="text"
                  value={profile.telefone}
                  onChange={(e) => setProfile({ ...profile, telefone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-data-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold uppercase mb-1">E-mail Comercial</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold uppercase mb-1">URL / Logo da Empresa (Opcional)</label>
              <input
                type="text"
                placeholder="https://..."
                value={profile.logoUrl || ''}
                onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#0B1E38] hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4 text-[#F2A900]" /> Salvar Dados da Empresa
            </button>
          </form>
        </div>

        {/* Section 6: Global Partner Brands Library */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ba1a1a]" /> Biblioteca Global de Marcas Parceiras
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            Cadastre fabricantes homologados para disponibilizar no seletor de Propostas Comerciais.
          </p>

          <form onSubmit={handleCreateBrand} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-800 uppercase block text-[11px]">Nova Marca Parceira</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nome (ex.: Edwards EST3X)"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                className="border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
              <input
                type="text"
                placeholder="Categoria (ex.: Centrais & Alarme)"
                value={newBrandCategory}
                onChange={(e) => setNewBrandCategory(e.target.value)}
                className="border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="URL do Logotipo (Opcional)"
                value={newBrandLogo}
                onChange={(e) => setNewBrandLogo(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#ba1a1a] hover:bg-[#a51515] text-white font-bold rounded-lg uppercase text-xs flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Cadastrar
              </button>
            </div>
          </form>

          {/* List of Partner Brands */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {partnerBrands.map((pb) => (
              <div
                key={pb.id}
                className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0B1E38] text-[#F2A900] font-bold rounded flex items-center justify-center text-xs">
                    {pb.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">{pb.name}</h5>
                    <p className="text-[10px] text-slate-500 uppercase">{pb.category}</p>
                  </div>
                </div>

                <button
                  onClick={() => onDeletePartnerBrand(pb.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role Selector Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Matriz de Permissões de Usuário (RBAC)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Selecione o perfil ativo para simular o nível de permissão de acesso da interface:
        </p>
        <select
          value={userRole}
          onChange={(e) => onSelectRole(e.target.value as UserRole)}
          className="w-full border border-slate-200 rounded-lg p-3 text-xs font-semibold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/20"
        >
          <option value="ADMINISTRATIVO">ADMINISTRATIVO — Acesso Irrestrito Aos Módulos</option>
          <option value="TECNICO">TÉCNICO DE CAMPO — Execução de OS, Ponto &amp; Relatórios</option>
          <option value="GESTOR">GESTOR DE CONTRATO — Aprovação &amp; Escala da Equipe</option>
          <option value="FINANCEIRO">FINANCEIRO — Receitas, Despesas &amp; DRE</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Log Geral de Auditoria do Sistema (Rastreabilidade Integrada)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Timestamp / IP</th>
                <th className="p-4">Usuário</th>
                <th className="p-4">Módulo / Ação</th>
                <th className="p-4">Detalhes da Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4">
                    <span className="font-data-mono font-bold text-[#ba1a1a]">{log.timestamp}</span> <br />
                    <span className="font-data-mono text-[10px] text-slate-400">{log.ip}</span>
                  </td>
                  <td className="p-4 font-bold text-slate-900">{log.user}</td>
                  <td className="p-4">
                    <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded text-[10px] font-bold">
                      {log.module}
                    </span> <br />
                    <span className="text-[11px] font-bold text-slate-900 mt-1 inline-block">{log.action}</span>
                  </td>
                  <td className="p-4 text-slate-600 max-w-sm">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
