'use client';

import React, { useState } from 'react';
import { SystemAuditLog, UserRole, CompanyProfile, PartnerBrand, PdfPrefs } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { Toggle } from '@/components/SidePanel';

interface ContaViewProps {
  logs: SystemAuditLog[];
  userRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  companyProfile: CompanyProfile;
  onUpdateCompanyProfile: (cp: CompanyProfile) => void;
  partnerBrands: PartnerBrand[];
  onAddPartnerBrand: (brand: PartnerBrand) => void;
  onDeletePartnerBrand: (id: string) => void;
  pdfPrefs: PdfPrefs;
  onUpdatePdfPrefs: (p: PdfPrefs) => void;
}

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 focus:border-[#1A1A72]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

const SettingIcon: React.FC<{ icon: string }> = ({ icon }) => (
  <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-lg">{icon}</span>
  </span>
);

export const ContaView: React.FC<ContaViewProps> = ({
  logs,
  userRole,
  onSelectRole,
  companyProfile,
  onUpdateCompanyProfile,
  partnerBrands,
  onAddPartnerBrand,
  onDeletePartnerBrand,
  pdfPrefs,
  onUpdatePdfPrefs,
}) => {
  const [tab, setTab] = useState<'conta' | 'preferencias' | 'pdf'>('conta');

  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);

  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCategory, setNewBrandCategory] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');

  // Preferências (estado de UI — front-end)
  const [prefs, setPrefs] = useState({
    criticalStock: true,
    confirmDelete: true,
    compactMode: false,
  });

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

  const TABS = [
    { key: 'conta', label: 'Conta', icon: 'account_circle' },
    { key: 'preferencias', label: 'Preferências', icon: 'tune' },
    { key: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
  ] as const;

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Configurações da Empresa &amp; Rastreabilidade Integrada
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Configurações</h1>
      </div>

      {/* Tabs centralizadas */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t.key ? 'bg-white text-[#1A1A72] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== TAB: CONTA ===== */}
      {tab === 'conta' && (
        <div className="flex flex-col gap-6">
          {/* Card: Dados da empresa */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="apartment" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1A1A72]">
                  Dados cadastrais da empresa
                </h3>
                <p className="text-[11px] text-slate-400">Usados na capa e nas propostas comerciais.</p>
              </div>
            </div>

            <form onSubmit={handleSaveCompanyProfile} className="space-y-3 text-xs font-medium">
              <div>
                <label className={labelCls}>Razão social</label>
                <input
                  type="text"
                  required
                  value={profile.razaoSocial}
                  onChange={(e) => setProfile({ ...profile, razaoSocial: e.target.value })}
                  className={`${inputCls} font-bold`}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <input
                    type="text"
                    required
                    value={profile.cnpj}
                    onChange={(e) => setProfile({ ...profile, cnpj: e.target.value })}
                    className={`${inputCls} font-data-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Regime tributário</label>
                  <input
                    type="text"
                    value={profile.regimeTributario}
                    onChange={(e) => setProfile({ ...profile, regimeTributario: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Endereço completo</label>
                <input
                  type="text"
                  value={profile.endereco}
                  onChange={(e) => setProfile({ ...profile, endereco: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    type="text"
                    value={profile.telefone}
                    onChange={(e) => setProfile({ ...profile, telefone: e.target.value })}
                    className={`${inputCls} font-data-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>E-mail comercial</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>URL do logotipo (opcional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={profile.logoUrl || ''}
                  onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                className="bg-[#1A1A72] hover:bg-[#12124f] text-white font-semibold py-2.5 px-5 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">save</span> Salvar dados da empresa
              </button>
            </form>
          </div>

          {/* Card: Permissões (RBAC) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="admin_panel_settings" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1A1A72]">
                  Matriz de permissões (RBAC)
                </h3>
                <p className="text-[11px] text-slate-400">Perfil ativo que define o nível de acesso da interface.</p>
              </div>
            </div>
            <select
              value={userRole}
              onChange={(e) => onSelectRole(e.target.value as UserRole)}
              className={`${inputCls} font-semibold`}
            >
              <option value="ADMINISTRATIVO">ADMINISTRATIVO — Acesso irrestrito aos módulos</option>
              <option value="TECNICO">TÉCNICO DE CAMPO — Execução de OS, ponto &amp; relatórios</option>
              <option value="GESTOR">GESTOR DE CONTRATO — Aprovação &amp; escala da equipe</option>
              <option value="FINANCEIRO">FINANCEIRO — Receitas, despesas &amp; DRE</option>
            </select>
          </div>

          {/* Log de auditoria */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Log geral de auditoria do sistema
            </h3>
            <div className="flex flex-col gap-3">
              {logs.map((log) => (
                <DataListRow
                  key={log.id}
                  leading={<SettingIcon icon="history" />}
                  title={log.action}
                  meta={
                    <>
                      <RowMeta label="Usuário" value={log.user} />
                      <span className="text-slate-500 truncate max-w-[260px] inline-block align-bottom">{log.details}</span>
                    </>
                  }
                  center={
                    <div className="text-left md:text-center">
                      <p className="font-data-mono text-slate-700 font-semibold">{log.timestamp}</p>
                      <p className="font-data-mono text-[10px] text-slate-400">{log.ip}</p>
                    </div>
                  }
                  right={<Badge color="slate">{log.module}</Badge>}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: PREFERÊNCIAS ===== */}
      {tab === 'preferencias' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <DataListRow
              leading={<SettingIcon icon="notifications_active" />}
              title="Alertas de estoque crítico"
              meta="Destaca produtos no nível mínimo ou abaixo."
              right={<Toggle checked={prefs.criticalStock} onChange={(v) => setPrefs({ ...prefs, criticalStock: v })} />}
            />
            <DataListRow
              leading={<SettingIcon icon="delete_forever" />}
              title="Confirmar antes de excluir"
              meta="Pede confirmação ao remover registros."
              right={<Toggle checked={prefs.confirmDelete} onChange={(v) => setPrefs({ ...prefs, confirmDelete: v })} />}
            />
            <DataListRow
              leading={<SettingIcon icon="density_small" />}
              title="Modo compacto"
              meta="Reduz o espaçamento das listas."
              right={<Toggle checked={prefs.compactMode} onChange={(v) => setPrefs({ ...prefs, compactMode: v })} />}
            />
          </div>

          {/* Marcas parceiras */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="layers" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1A1A72]">
                  Biblioteca de marcas parceiras
                </h3>
                <p className="text-[11px] text-slate-400">Fabricantes homologados para o seletor de propostas.</p>
              </div>
            </div>

            <form onSubmit={handleCreateBrand} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nome (ex.: Edwards EST3X)"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Categoria (ex.: Centrais & Alarme)"
                  value={newBrandCategory}
                  onChange={(e) => setNewBrandCategory(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL do logotipo (opcional)"
                  value={newBrandLogo}
                  onChange={(e) => setNewBrandLogo(e.target.value)}
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 bg-[#E63946] hover:bg-[#a51515] text-white font-bold rounded-lg uppercase text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">add</span> Cadastrar
                </button>
              </div>
            </form>

            <div className="flex flex-col gap-2">
              {partnerBrands.map((pb) => (
                <DataListRow
                  key={pb.id}
                  leading={
                    <span className="w-10 h-10 bg-[#1A1A72] text-[#FFD700] font-bold rounded-lg flex items-center justify-center text-xs shrink-0">
                      {pb.name.slice(0, 2).toUpperCase()}
                    </span>
                  }
                  title={pb.name}
                  meta={pb.category}
                  right={
                    <RowAction icon="delete" label="Remover marca" danger onClick={() => onDeletePartnerBrand(pb.id)} />
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: PDF ===== */}
      {tab === 'pdf' && (
        <div className="flex flex-col gap-3">
          <DataListRow
            leading={<SettingIcon icon="tune" />}
            title="Configurar antes de gerar"
            meta="Abre a tela de opções antes de gerar o PDF da proposta."
            right={
              <Toggle
                checked={pdfPrefs.configBeforeGenerate}
                onChange={(v) => onUpdatePdfPrefs({ ...pdfPrefs, configBeforeGenerate: v })}
              />
            }
          />
          <DataListRow
            leading={<SettingIcon icon="receipt_long" />}
            title="Subtotal detalhado"
            meta="Mostra o detalhamento de itens e subtotais no PDF."
            right={
              <Toggle
                checked={pdfPrefs.detailedSubtotal}
                onChange={(v) => onUpdatePdfPrefs({ ...pdfPrefs, detailedSubtotal: v })}
              />
            }
          />
          <DataListRow
            leading={<SettingIcon icon="image" />}
            title="Incluir logotipo no cabeçalho"
            meta="Exibe o logo da empresa no topo do documento."
            right={<Toggle checked={pdfPrefs.showLogo} onChange={(v) => onUpdatePdfPrefs({ ...pdfPrefs, showLogo: v })} />}
          />
          <DataListRow
            leading={<SettingIcon icon="account_balance" />}
            title="Mostrar dados bancários"
            meta="Inclui os dados para pagamento no rodapé do PDF."
            right={
              <Toggle checked={pdfPrefs.showBankData} onChange={(v) => onUpdatePdfPrefs({ ...pdfPrefs, showBankData: v })} />
            }
          />
          <p className="text-[11px] text-slate-400 px-1 pt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">info</span>
            Preferências de geração de PDF (aplicadas às propostas comerciais).
          </p>
        </div>
      )}
    </div>
  );
};
