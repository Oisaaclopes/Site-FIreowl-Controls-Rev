'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SystemAuditLog, UserRole, CompanyProfile, PartnerBrand, PdfPrefs } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { Toggle, SidePanel } from '@/components/SidePanel';
import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserProfile,
  deleteUserProfile,
  ManagedUser,
} from '@/lib/users';
import { WorkSchedule, DEFAULT_SCHEDULE, WEEKDAY_SHORT } from '@/lib/schedule';
import { maskCpf } from '@/lib/utils';
import { listEmployeeDocs, uploadEmployeeDoc, signedDocUrl, deleteEmployeeDoc, EmployeeDoc } from '@/lib/storage';

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
  canSwitchRole?: boolean;
  currentEmail?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRATIVO: 'Administrativo',
  GESTOR: 'Gestor',
  FINANCEIRO: 'Financeiro',
  TECNICO: 'Técnico',
};

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20 focus:border-[#1A1A72]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

const SettingIcon: React.FC<{ icon: string }> = ({ icon }) => (
  <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-lg">{icon}</span>
  </span>
);

// Editor de escala de trabalho (reutilizado no criar/editar funcionário)
const ScheduleEditor: React.FC<{ value: WorkSchedule; onChange: (s: WorkSchedule) => void }> = ({ value, onChange }) => {
  const setDay = (i: number, patch: Partial<WorkSchedule[number]>) =>
    onChange(value.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-1.5">
      {value.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 w-20 shrink-0 cursor-pointer">
            <input type="checkbox" checked={d.works} onChange={(e) => setDay(i, { works: e.target.checked })} />
            <span className="text-[11px] font-semibold text-slate-600">{WEEKDAY_SHORT[i]}</span>
          </label>
          <input
            type="time"
            value={d.start}
            disabled={!d.works}
            onChange={(e) => setDay(i, { start: e.target.value })}
            className={`${inputCls} font-data-mono py-1.5 disabled:bg-slate-100 disabled:text-slate-300`}
          />
          <span className="text-slate-400 text-[11px]">às</span>
          <input
            type="time"
            value={d.end}
            disabled={!d.works}
            onChange={(e) => setDay(i, { end: e.target.value })}
            className={`${inputCls} font-data-mono py-1.5 disabled:bg-slate-100 disabled:text-slate-300`}
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={0}
              value={d.lunchMinutes}
              disabled={!d.works}
              onChange={(e) => setDay(i, { lunchMinutes: Number(e.target.value) })}
              className={`${inputCls} font-data-mono py-1.5 w-16 text-center disabled:bg-slate-100 disabled:text-slate-300`}
            />
            <span className="text-slate-400 text-[10px]">min almoço</span>
          </div>
        </div>
      ))}
    </div>
  );
};

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
  canSwitchRole = false,
  currentEmail = '',
}) => {
  const [tab, setTab] = useState<'conta' | 'preferencias' | 'pdf' | 'usuarios'>('conta');

  // Gestão de usuários (apenas admin)
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [nuName, setNuName] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuPassword, setNuPassword] = useState('');
  const [nuRole, setNuRole] = useState<UserRole>('TECNICO');
  const [nuFullName, setNuFullName] = useState('');
  const [nuCpf, setNuCpf] = useState('');
  const [nuBirth, setNuBirth] = useState('');
  const [nuPhone, setNuPhone] = useState('');
  const [nuCourses, setNuCourses] = useState('');
  const [nuSchedule, setNuSchedule] = useState<WorkSchedule>(() => DEFAULT_SCHEDULE.map((d) => ({ ...d })));

  // Edição de funcionário existente
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [revealCpf, setRevealCpf] = useState(false); // LGPD: CPF oculto por padrão
  const [euForm, setEuForm] = useState({
    name: '',
    fullName: '',
    cpf: '',
    birthDate: '',
    phone: '',
    role: 'TECNICO' as UserRole,
    courses: '',
    schedule: DEFAULT_SCHEDULE.map((d) => ({ ...d })) as WorkSchedule,
  });

  // Documentos do funcionário (Storage privado)
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async (id: string) => {
    setDocsLoading(true);
    try {
      setDocs(await listEmployeeDocs(id));
    } catch (err) {
      console.warn('Documentos: falha ao carregar.', err);
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editUser) return;
    setUploading(true);
    try {
      await uploadEmployeeDoc(editUser.id, file);
      await loadDocs(editUser.id);
    } catch (err) {
      console.error('Falha ao enviar documento:', err);
      alert('Não foi possível enviar o documento.');
    } finally {
      setUploading(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleOpenDoc = async (path: string) => {
    try {
      window.open(await signedDocUrl(path), '_blank');
    } catch (err) {
      console.error('Falha ao abrir documento:', err);
      alert('Não foi possível abrir o documento.');
    }
  };

  const handleDeleteDoc = async (d: EmployeeDoc) => {
    if (!window.confirm(`Excluir o documento "${d.name.replace(/^\d+_/, '')}"?`)) return;
    try {
      await deleteEmployeeDoc(d.path);
      setDocs((prev) => prev.filter((x) => x.path !== d.path));
    } catch (err) {
      console.error('Falha ao excluir documento:', err);
      alert('Não foi possível excluir o documento.');
    }
  };

  const openEditUser = (u: ManagedUser) => {
    setDocs([]);
    setRevealCpf(false);
    loadDocs(u.id);
    setEuForm({
      name: u.name || '',
      fullName: u.fullName || '',
      cpf: u.cpf || '',
      birthDate: u.birthDate || '',
      phone: u.phone || '',
      role: u.role,
      courses: (u.courses || []).join('\n'),
      schedule: u.schedule ? u.schedule.map((d) => ({ ...d })) : DEFAULT_SCHEDULE.map((d) => ({ ...d })),
    });
    setEditUser(u);
  };

  const handleSaveUserEdit = async () => {
    if (!editUser || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateUserProfile(editUser.id, {
        name: euForm.name.trim() || undefined,
        role: euForm.role,
        fullName: euForm.fullName.trim() || undefined,
        cpf: euForm.cpf.trim() || undefined,
        birthDate: euForm.birthDate || undefined,
        phone: euForm.phone.trim() || undefined,
        schedule: euForm.schedule,
        courses: euForm.courses
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditUser(null);
      setTimeout(refreshUsers, 300);
    } catch (err) {
      console.error('Falha ao salvar edição do funcionário:', err);
      alert('Não foi possível salvar as alterações.');
    } finally {
      setSavingEdit(false);
    }
  };
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const refreshUsers = () => {
    setUsersLoading(true);
    setUsersError('');
    listUsers()
      .then(setUsers)
      .catch((err) => {
        console.error('Falha ao listar usuários:', err);
        setUsersError('Não foi possível carregar os usuários.');
      })
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    if (canSwitchRole) refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSwitchRole]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreateMsg('');
    if (!nuEmail.trim() || nuPassword.length < 6) {
      setCreateMsg('Informe um e-mail válido e uma senha de pelo menos 6 caracteres.');
      return;
    }
    setCreating(true);
    try {
      await createUser({
        email: nuEmail.trim(),
        password: nuPassword,
        name: (nuName || nuFullName || nuEmail.split('@')[0]).trim(),
        role: nuRole,
        fullName: nuFullName.trim() || undefined,
        cpf: nuCpf.trim() || undefined,
        birthDate: nuBirth || undefined,
        phone: nuPhone.trim() || undefined,
        schedule: nuSchedule,
        courses: nuCourses
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setCreateMsg('OK: usuário criado. Já pode fazer login (se a confirmação de e-mail estiver desativada).');
      setNuName('');
      setNuEmail('');
      setNuPassword('');
      setNuRole('TECNICO');
      setNuFullName('');
      setNuCpf('');
      setNuBirth('');
      setNuPhone('');
      setNuCourses('');
      setNuSchedule(DEFAULT_SCHEDULE.map((d) => ({ ...d })));
      setTimeout(refreshUsers, 600);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/already registered|already exists/i.test(msg)) {
        setCreateMsg('Já existe um usuário com esse e-mail.');
      } else if (/signups? not allowed|disabled/i.test(msg)) {
        setCreateMsg('Cadastro desativado no Supabase (Auth → Providers → Email → habilite os cadastros).');
      } else {
        setCreateMsg('Não foi possível criar o usuário: ' + msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (u: ManagedUser, role: UserRole) => {
    try {
      await updateUserRole(u.id, role);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (err) {
      console.error('Falha ao alterar papel:', err);
      alert('Não foi possível alterar o nível de acesso.');
    }
  };

  const handleDeleteUser = async (u: ManagedUser) => {
    if (u.email && currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase()) {
      alert('Você não pode remover o seu próprio acesso.');
      return;
    }
    if (!window.confirm(`Remover o acesso de "${u.name || u.email}"?\n\nO usuário perde o acesso ao sistema.`)) return;
    try {
      await deleteUserProfile(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      console.error('Falha ao remover usuário:', err);
      alert('Não foi possível remover o usuário.');
    }
  };

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
    ...(canSwitchRole ? [{ key: 'usuarios', label: 'Usuários', icon: 'group' }] : []),
  ] as { key: 'conta' | 'preferencias' | 'pdf' | 'usuarios'; label: string; icon: string }[];

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
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
                <p className="text-[11px] text-slate-400">
                  {canSwitchRole
                    ? 'Simule um perfil para pré-visualizar o acesso (não altera o perfil real).'
                    : 'Seu perfil é definido pela autenticação e não pode ser alterado aqui.'}
                </p>
              </div>
            </div>
            {canSwitchRole ? (
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
            ) : (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span className="text-xs font-semibold text-slate-700">Perfil atual</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1A1A72] bg-[#1A1A72]/5 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  {userRole}
                </span>
              </div>
            )}
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

      {/* ===== TAB: USUÁRIOS (apenas admin) ===== */}
      {tab === 'usuarios' && canSwitchRole && (
        <div className="flex flex-col gap-6">
          {/* Novo usuário */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="person_add" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-[#1A1A72]">
                  Novo usuário
                </h3>
                <p className="text-[11px] text-slate-400">Cria o login e já define o nível de acesso.</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome de exibição</label>
                  <input type="text" value={nuName} onChange={(e) => setNuName(e.target.value)} className={inputCls} placeholder="Ex.: Isaac L." />
                </div>
                <div>
                  <label className={labelCls}>Nível de acesso</label>
                  <select value={nuRole} onChange={(e) => setNuRole(e.target.value as UserRole)} className={`${inputCls} font-semibold`}>
                    <option value="ADMINISTRATIVO">Administrativo — acesso total</option>
                    <option value="GESTOR">Gestor — operação e contratos</option>
                    <option value="FINANCEIRO">Financeiro — receitas e despesas</option>
                    <option value="TECNICO">Técnico — campo e ponto</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>E-mail (login)</label>
                  <input type="email" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="nome@fireowlcontrols.com.br" />
                </div>
                <div>
                  <label className={labelCls}>Senha inicial</label>
                  <input type="text" value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="mín. 6 caracteres" />
                </div>
              </div>

              {/* Dados do funcionário */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Dados do funcionário</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nome completo</label>
                    <input type="text" value={nuFullName} onChange={(e) => setNuFullName(e.target.value)} className={inputCls} placeholder="Nome civil completo" />
                  </div>
                  <div>
                    <label className={labelCls}>CPF</label>
                    <input type="text" value={nuCpf} onChange={(e) => setNuCpf(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className={labelCls}>Data de nascimento</label>
                    <input type="date" value={nuBirth} onChange={(e) => setNuBirth(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone</label>
                    <input type="text" value={nuPhone} onChange={(e) => setNuPhone(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Cursos, NRs e diplomas (um por linha)</label>
                  <textarea
                    value={nuCourses}
                    onChange={(e) => setNuCourses(e.target.value)}
                    rows={3}
                    placeholder={'Ex.: NR-10 (validade 2027)\nNR-35 Trabalho em Altura\nTécnico em Eletrônica'}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>

              {/* Escala de trabalho */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Escala de trabalho (usada nos alertas de ponto)
                </p>
                <ScheduleEditor value={nuSchedule} onChange={setNuSchedule} />
              </div>

              {createMsg && (
                <p className={`text-[11px] font-semibold ${createMsg.startsWith('OK') ? 'text-emerald-700' : 'text-[#E63946]'}`}>
                  {createMsg.replace(/^OK: /, '')}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="bg-[#E63946] hover:bg-[#a51515] text-white font-semibold py-2.5 px-5 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-70"
              >
                <span className={`material-symbols-outlined text-base ${creating ? 'animate-spin' : ''}`}>
                  {creating ? 'progress_activity' : 'person_add'}
                </span>
                {creating ? 'Criando...' : 'Criar usuário'}
              </button>
            </form>
          </div>

          {/* Lista de usuários */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Usuários com acesso</h3>
            {usersLoading ? (
              <div className="bg-white rounded-xl shadow-sm py-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-3xl animate-spin inline-block">progress_activity</span>
              </div>
            ) : usersError ? (
              <div className="bg-white rounded-xl shadow-sm py-10 text-center text-[#E63946] text-xs font-semibold">{usersError}</div>
            ) : users.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm py-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl text-slate-300">group</span>
                <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhum usuário</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {users.map((u) => {
                  const isSelf = !!currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase();
                  return (
                    <DataListRow
                      key={u.id}
                      leading={
                        <span className="w-10 h-10 rounded-lg bg-[#1A1A72] text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {(u.name || u.email).slice(0, 2).toUpperCase()}
                        </span>
                      }
                      title={
                        <span>
                          {u.name || '—'}
                          {isSelf && <span className="ml-2 text-[10px] text-slate-400 uppercase">(você)</span>}
                        </span>
                      }
                      meta={<span className="font-data-mono text-slate-500">{u.email}</span>}
                      right={
                        <>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
                          >
                            <option value="ADMINISTRATIVO">Administrativo</option>
                            <option value="GESTOR">Gestor</option>
                            <option value="FINANCEIRO">Financeiro</option>
                            <option value="TECNICO">Técnico</option>
                          </select>
                          <RowAction icon="edit" label="Editar dados" onClick={() => openEditUser(u)} />
                          {!isSelf && (
                            <RowAction icon="delete" label="Remover acesso" danger onClick={() => handleDeleteUser(u)} />
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              &quot;Remover&quot; revoga o acesso ao sistema. A exclusão total da conta de login é feita no painel do Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Drawer: Editar dados do funcionário */}
      <SidePanel
        open={!!editUser}
        title="Editar funcionário"
        subtitle={editUser?.email}
        onClose={() => setEditUser(null)}
        onSave={handleSaveUserEdit}
        saving={savingEdit}
      >
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs font-medium">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome de exibição</label>
              <input value={euForm.name} onChange={(e) => setEuForm({ ...euForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nível de acesso</label>
              <select
                value={euForm.role}
                onChange={(e) => setEuForm({ ...euForm, role: e.target.value as UserRole })}
                className={`${inputCls} font-semibold`}
              >
                <option value="ADMINISTRATIVO">Administrativo</option>
                <option value="GESTOR">Gestor</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="TECNICO">Técnico</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nome completo</label>
              <input value={euForm.fullName} onChange={(e) => setEuForm({ ...euForm, fullName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                CPF
                <span className="ml-1 text-[9px] font-normal text-slate-400 normal-case">(dado sensível — LGPD)</span>
              </label>
              {revealCpf ? (
                <input
                  value={euForm.cpf}
                  onChange={(e) => setEuForm({ ...euForm, cpf: e.target.value })}
                  className={`${inputCls} font-data-mono`}
                  placeholder="000.000.000-00"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={euForm.cpf ? maskCpf(euForm.cpf) : ''}
                    readOnly
                    placeholder="Não informado"
                    className={`${inputCls} font-data-mono bg-slate-50 text-slate-500 cursor-default`}
                  />
                  <button
                    type="button"
                    onClick={() => setRevealCpf(true)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-[#1A1A72] hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    {euForm.cpf ? 'Revelar' : 'Informar'}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input type="date" value={euForm.birthDate} onChange={(e) => setEuForm({ ...euForm, birthDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input value={euForm.phone} onChange={(e) => setEuForm({ ...euForm, phone: e.target.value })} className={`${inputCls} font-data-mono`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Cursos, NRs e diplomas (um por linha)</label>
            <textarea
              value={euForm.courses}
              onChange={(e) => setEuForm({ ...euForm, courses: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Escala de trabalho</p>
          <ScheduleEditor value={euForm.schedule} onChange={(s) => setEuForm({ ...euForm, schedule: s })} />
        </div>

        {/* Documentos (Storage privado) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Documentos (diplomas, NRs, currículo)
            </p>
            <input ref={docFileRef} type="file" onChange={handleUploadDoc} className="hidden" />
            <button
              type="button"
              onClick={() => docFileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-[#1A1A72] hover:bg-[#12124f] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-70"
            >
              <span className={`material-symbols-outlined text-base ${uploading ? 'animate-spin' : ''}`}>
                {uploading ? 'progress_activity' : 'upload_file'}
              </span>
              {uploading ? 'Enviando...' : 'Enviar documento'}
            </button>
          </div>

          {docsLoading ? (
            <p className="text-xs text-slate-400">Carregando documentos...</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum documento enviado.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li key={d.path} className="flex items-center justify-between py-2 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-slate-400">description</span>
                    <span className="truncate text-slate-700">{d.name.replace(/^\d+_/, '')}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(d.path)}
                      className="text-[#1A1A72] font-semibold hover:underline px-2"
                    >
                      abrir
                    </button>
                    <RowAction icon="delete" label="Excluir documento" danger onClick={() => handleDeleteDoc(d)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">lock</span>
            Armazenamento privado — acesso só do próprio funcionário e do administrador, via link temporário.
          </p>
        </div>
      </SidePanel>
    </div>
  );
};
