'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SystemAuditLog, UserRole, UserStatus, CompanyProfile, PartnerBrand, PdfPrefs, Client, CatalogoProvisorio, DocumentosPadrao, PedidoTipo, DocumentType, EmpresaAtendida, MarcaTecnologia } from '@/lib/types';
import { ExperienciaAdmin } from '@/components/views/ExperienciaAdmin';
import {
  PEDIDO_TIPO_LABELS,
  PEDIDO_TIPO_ORDER,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ORDER,
  isDocumentoImplementado,
} from '@/lib/documentos';
import { fetchClients } from '@/lib/clients';
import { useDomainRefresh } from '@/lib/realtime/RealtimeProvider';
import {
  aprovarClienteProvisorio,
  mesclarClienteProvisorio,
  fetchCatalogoProvisorio,
  atualizarCatalogoProvisorio,
  precificarComoEstoque,
} from '@/lib/homologacao';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { Toggle, SidePanel } from '@/components/SidePanel';
import { useToast, useConfirm, showToast, requestText } from '@/components/ui/Feedback';
import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserProfile,
  deleteUserProfile,
  setUserStatus,
  logUserAudit,
  ManagedUser,
} from '@/lib/users';
import { WorkSchedule, DEFAULT_SCHEDULE, WEEKDAY_SHORT } from '@/lib/schedule';
import { maskCpf } from '@/lib/utils';
import { listEmployeeDocs, uploadEmployeeDoc, signedDocUrl, deleteEmployeeDoc, EmployeeDoc } from '@/lib/storage';
import { uploadPropostaCapa, removePropostaCapa } from '@/lib/propostaCapa';
import { uploadInstitucionalLogo, removeInstitucionalLogo, resolveLogoDataUrls } from '@/lib/institucional';
import { canResetUserPassword } from '@/lib/rbac';
import { ResetPasswordModal } from '@/components/users/ResetPasswordModal';
import { checkPassword, generateStrongPassword, PASSWORD_MIN } from '@/lib/password';
import { useTheme, ThemeMode } from '@/lib/theme';

interface ContaViewProps {
  logs: SystemAuditLog[];
  userRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  companyProfile: CompanyProfile;
  onUpdateCompanyProfile: (cp: CompanyProfile) => void;
  partnerBrands: PartnerBrand[];
  onAddPartnerBrand: (brand: PartnerBrand) => void;
  onDeletePartnerBrand: (id: string) => void;
  empresasAtendidas?: EmpresaAtendida[];
  marcasTecnologias?: MarcaTecnologia[];
  onSaveEmpresaAtendida?: (e: EmpresaAtendida) => void;
  onDeleteEmpresaAtendida?: (id: string) => void;
  onSaveMarcaTecnologia?: (m: MarcaTecnologia) => void;
  onDeleteMarcaTecnologia?: (id: string) => void;
  pdfPrefs: PdfPrefs;
  onUpdatePdfPrefs: (p: PdfPrefs) => void;
  documentosPadrao: DocumentosPadrao;
  onUpdateDocumentosPadrao: (d: DocumentosPadrao) => void;
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
  'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40';
const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';

const SettingIcon: React.FC<{ icon: string }> = ({ icon }) => (
  <span className="w-10 h-10 rounded-lg bg-navy/10 text-primary flex items-center justify-center shrink-0">
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
            <span className="text-[11px] font-semibold text-fg-secondary">{WEEKDAY_SHORT[i]}</span>
          </label>
          <input
            type="time"
            value={d.start}
            disabled={!d.works}
            onChange={(e) => setDay(i, { start: e.target.value })}
            className={`${inputCls} font-data-mono py-1.5 disabled:bg-surface-3 disabled:text-fg-muted`}
          />
          <span className="text-fg-muted text-[11px]">às</span>
          <input
            type="time"
            value={d.end}
            disabled={!d.works}
            onChange={(e) => setDay(i, { end: e.target.value })}
            className={`${inputCls} font-data-mono py-1.5 disabled:bg-surface-3 disabled:text-fg-muted`}
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={0}
              value={d.lunchMinutes}
              disabled={!d.works}
              onChange={(e) => setDay(i, { lunchMinutes: Number(e.target.value) })}
              className={`${inputCls} font-data-mono py-1.5 w-16 text-center disabled:bg-surface-3 disabled:text-fg-muted`}
            />
            <span className="text-fg-muted text-[10px]">min almoço</span>
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
  empresasAtendidas = [],
  marcasTecnologias = [],
  onSaveEmpresaAtendida,
  onDeleteEmpresaAtendida,
  onSaveMarcaTecnologia,
  onDeleteMarcaTecnologia,
  pdfPrefs,
  onUpdatePdfPrefs,
  documentosPadrao,
  onUpdateDocumentosPadrao,
  canSwitchRole = false,
  currentEmail = '',
}) => {
  const [tab, setTab] = useState<'conta' | 'homologacao' | 'preferencias' | 'pdf' | 'usuarios'>('conta');
  const [homolSubTab, setHomolSubTab] = useState<'clientes' | 'marcas' | 'itens'>('clientes');
  const { theme, setTheme } = useTheme();

  // ---- Homologação (dados reais) ----
  const [provClients, setProvClients] = useState<Client[]>([]);
  const [officialClients, setOfficialClients] = useState<Client[]>([]);
  const [catMarcas, setCatMarcas] = useState<CatalogoProvisorio[]>([]);
  const [catItens, setCatItens] = useState<CatalogoProvisorio[]>([]);
  const [homolBusy, setHomolBusy] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Client | null>(null);
  const [mergeOficialId, setMergeOficialId] = useState('');

  const loadHomologacao = async () => {
    try {
      const [cls, marcas, itens] = await Promise.all([
        fetchClients(),
        fetchCatalogoProvisorio({ tipo: 'marca', status: 'pendente' }),
        fetchCatalogoProvisorio({ tipo: 'item', status: 'pendente' }),
      ]);
      setProvClients(cls.filter((c) => c.pendenteValidacao));
      setOfficialClients(cls.filter((c) => !c.pendenteValidacao));
      setCatMarcas(marcas);
      setCatItens(itens);
    } catch (e) {
      console.warn('Homologação: falha ao carregar.', e);
    }
  };

  useEffect(() => {
    if (tab === 'homologacao') loadHomologacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const aprovarCliente = async (c: Client) => {
    setHomolBusy(c.id);
    try {
      await aprovarClienteProvisorio(c.id);
      await loadHomologacao();
    } catch {
      showToast('Falha ao aprovar cliente.');
    } finally {
      setHomolBusy(null);
    }
  };

  const confirmarMerge = async () => {
    if (!mergeTarget || !mergeOficialId) return;
    setHomolBusy(mergeTarget.id);
    try {
      await mesclarClienteProvisorio(mergeTarget.id, mergeOficialId);
      setMergeTarget(null);
      setMergeOficialId('');
      await loadHomologacao();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao mesclar cliente.');
    } finally {
      setHomolBusy(null);
    }
  };

  const homologarMarca = async (m: CatalogoProvisorio) => {
    setHomolBusy(m.id);
    try {
      const nome = String(m.dados.nome || m.dados.name || 'Marca de campo');
      onAddPartnerBrand({ id: `pb_${Date.now()}`, name: nome, category: String(m.dados.categoria || m.dados.category || 'SDAI') });
      await atualizarCatalogoProvisorio(m.id, { status: 'aprovado' });
      await loadHomologacao();
    } catch {
      showToast('Falha ao homologar marca.');
    } finally {
      setHomolBusy(null);
    }
  };

  const precificarItem = async (it: CatalogoProvisorio) => {
    const entrada = await requestText('Preço de venda do item (R$):');
    if (entrada == null) return;
    const val = Number(entrada.replace(',', '.'));
    if (!isFinite(val) || val < 0) {
      showToast('Preço inválido.');
      return;
    }
    setHomolBusy(it.id);
    try {
      const novo = await precificarComoEstoque(it, val);
      await loadHomologacao();
      showToast(`Item cadastrado no Estoque (código ${novo.code}) com preço de R$ ${val.toFixed(2)}.`);
    } catch {
      showToast('Falha ao precificar item.');
    } finally {
      setHomolBusy(null);
    }
  };

  const mesclarItem = async (it: CatalogoProvisorio) => {
    const alvo = await requestText('Item oficial do Estoque/Serviços para mesclar (código ou nome):');
    if (!alvo) return;
    setHomolBusy(it.id);
    try {
      await atualizarCatalogoProvisorio(it.id, { status: 'mesclado', registroFinalId: alvo.trim() });
      await loadHomologacao();
    } catch {
      showToast('Falha ao mesclar item.');
    } finally {
      setHomolBusy(null);
    }
  };




  // Gestão de usuários (apenas admin)
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [nuName, setNuName] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuRole, setNuRole] = useState<UserRole>('TECNICO');
  const [nuCargo, setNuCargo] = useState('');
  const [nuStatus, setNuStatus] = useState<UserStatus>('ATIVO');
  const [nuUsesTimeClock, setNuUsesTimeClock] = useState(true);
  const [nuFullName, setNuFullName] = useState('');
  const [nuCpf, setNuCpf] = useState('');
  const [nuBirth, setNuBirth] = useState('');
  const [nuPhone, setNuPhone] = useState('');
  const [nuCourses, setNuCourses] = useState('');
  const [nuTemporaryPassword, setNuTemporaryPassword] = useState('');
  const [nuTemporaryPasswordConfirm, setNuTemporaryPasswordConfirm] = useState('');
  const [showNuPassword, setShowNuPassword] = useState(false);
  const [createdTemporaryPassword, setCreatedTemporaryPassword] = useState<string | null>(null);
  const [nuSchedule, setNuSchedule] = useState<WorkSchedule>(() => DEFAULT_SCHEDULE.map((d) => ({ ...d })));

  // Edição de funcionário existente
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const canReset = canResetUserPassword(userRole);
  const [savingEdit, setSavingEdit] = useState(false);
  const [revealCpf, setRevealCpf] = useState(false); // LGPD: CPF oculto por padrão
  const [euForm, setEuForm] = useState({
    name: '',
    fullName: '',
    cpf: '',
    birthDate: '',
    phone: '',
    role: 'TECNICO' as UserRole,
    cargo: '',
    status: 'ATIVO' as UserStatus,
    usesTimeClock: true,
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
      toast.error('Não foi possível enviar o documento.');
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
      toast.error('Não foi possível abrir o documento.');
    }
  };

  const handleDeleteDoc = async (d: EmployeeDoc) => {
    const ok = await confirm({
      title: 'Excluir documento?',
      message: `"${d.name.replace(/^\d+_/, '')}" será removido do armazenamento.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmployeeDoc(d.path);
      setDocs((prev) => prev.filter((x) => x.path !== d.path));
      toast.success('Documento excluído.');
    } catch (err) {
      console.error('Falha ao excluir documento:', err);
      toast.error('Não foi possível excluir o documento.');
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
      cargo: u.cargo || '',
      status: u.status || 'ATIVO',
      usesTimeClock: u.usesTimeClock,
      courses: (u.courses || []).join('\n'),
      schedule: u.schedule ? u.schedule.map((d) => ({ ...d })) : DEFAULT_SCHEDULE.map((d) => ({ ...d })),
    });
    setEditUser(u);
  };

  const handleSaveUserEdit = async () => {
    if (!editUser || savingEdit) return;
    setSavingEdit(true);
    const prev = editUser;
    try {
      await updateUserProfile(editUser.id, {
        name: euForm.name.trim() || undefined,
        role: euForm.role,
        cargo: euForm.cargo.trim() || undefined,
        status: euForm.status,
        usesTimeClock: euForm.usesTimeClock,
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
      // Auditoria das mudanças sensíveis (perfil/cargo/status).
      if (prev.role !== euForm.role) logUserAudit('USER_ROLE_CHANGED', `target=${prev.id} ${prev.role}→${euForm.role}`);
      if ((prev.cargo || '') !== euForm.cargo.trim()) logUserAudit('USER_CARGO_CHANGED', `target=${prev.id} "${prev.cargo || ''}"→"${euForm.cargo.trim()}"`);
      if (prev.status !== euForm.status) logUserAudit('USER_STATUS_CHANGED', `target=${prev.id} ${prev.status}→${euForm.status}`);
      if (prev.usesTimeClock !== euForm.usesTimeClock) logUserAudit('USER_TIME_CLOCK_CHANGED', `target=${prev.id} ${prev.usesTimeClock}→${euForm.usesTimeClock}`);
      setEditUser(null);
      setTimeout(refreshUsers, 300);
      toast.success('Dados do funcionário atualizados.');
    } catch (err) {
      console.error('Falha ao salvar edição do funcionário:', err);
      toast.error('Não foi possível salvar as alterações.');
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
  useDomainRefresh('employees', refreshUsers, canSwitchRole);

  useEffect(() => {
    if (canSwitchRole) refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSwitchRole]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreateMsg('');
    if (!nuEmail.trim()) {
      setCreateMsg('Informe um e-mail válido.');
      return;
    }
    if (!checkPassword(nuTemporaryPassword).ok) { setCreateMsg(`A senha deve ter ${PASSWORD_MIN}+ caracteres, maiúscula, minúscula, número e símbolo.`); return; }
    if (nuTemporaryPassword !== nuTemporaryPasswordConfirm) { setCreateMsg('As senhas temporárias não coincidem.'); return; }
    setCreating(true);
    try {
      await createUser({
        email: nuEmail.trim(),
        name: (nuName || nuFullName || nuEmail.split('@')[0]).trim(),
        role: nuRole,
        status: nuStatus,
        usesTimeClock: nuUsesTimeClock,
        cargo: nuCargo.trim() || undefined,
        fullName: nuFullName.trim() || undefined,
        cpf: nuCpf.trim() || undefined,
        birthDate: nuBirth || undefined,
        phone: nuPhone.trim() || undefined,
        schedule: nuSchedule,
        courses: nuCourses
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        temporaryPassword: nuTemporaryPassword,
      });
      setCreatedTemporaryPassword(nuTemporaryPassword);
      setCreateMsg('');
      setNuName('');
      setNuEmail('');
      setNuRole('TECNICO');
      setNuCargo('');
      setNuStatus('ATIVO');
      setNuUsesTimeClock(true);
      setNuFullName('');
      setNuCpf('');
      setNuBirth('');
      setNuPhone('');
      setNuCourses('');
      setNuSchedule(DEFAULT_SCHEDULE.map((d) => ({ ...d })));
      setTimeout(refreshUsers, 600);
    } catch (err: any) {
      // createUser já devolve mensagem amigável (PT) por código da Edge Function.
      setCreateMsg(String(err?.message || 'Não foi possível criar o usuário.'));
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (u: ManagedUser, role: UserRole) => {
    if (role === u.role) return;
    try {
      await updateUserRole(u.id, role);
      logUserAudit('USER_ROLE_CHANGED', `target=${u.id} ${u.role}→${role}`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
      toast.success(`Perfil de acesso de ${u.name || u.email} atualizado.`);
    } catch (err) {
      console.error('Falha ao alterar papel:', err);
      toast.error('Não foi possível alterar o nível de acesso.');
    }
  };

  // Ativar / Inativar / Desligar — sem DELETE (preserva histórico).
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const handleStatusChange = async (u: ManagedUser, status: UserStatus) => {
    if (status === u.status) return;
    if (u.email && currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error('Você não pode alterar o próprio status de acesso.');
      return;
    }
    const nome = u.name || u.email;
    const dialog =
      status === 'DESLIGADO'
        ? {
            title: 'Marcar usuário como desligado?',
            message: `O acesso de "${nome}" será bloqueado. O histórico e os registros anteriores permanecem arquivados.`,
            confirmLabel: 'Marcar como desligado',
            danger: true,
          }
        : status === 'INATIVO'
        ? {
            title: 'Inativar usuário?',
            message: `"${nome}" perderá temporariamente o acesso ao sistema. O histórico é mantido e o acesso pode ser reativado quando necessário.`,
            confirmLabel: 'Inativar',
          }
        : {
            title: 'Reativar usuário?',
            message: `"${nome}" voltará a ter acesso conforme o seu perfil de permissão.`,
            confirmLabel: 'Reativar',
          };
    if (!(await confirm(dialog))) return;
    setStatusBusy(u.id);
    try {
      await setUserStatus(u.id, status);
      logUserAudit('USER_STATUS_CHANGED', `target=${u.id} ${u.status}→${status}`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status } : x)));
      toast.success(
        status === 'ATIVO' ? `${nome} reativado.` : status === 'INATIVO' ? `${nome} inativado.` : `${nome} marcado como desligado.`
      );
    } catch (err) {
      console.error('Falha ao alterar status:', err);
      toast.error('Não foi possível alterar o status.');
    } finally {
      setStatusBusy(null);
    }
  };

  const handleDeleteUser = async (u: ManagedUser) => {
    if (u.email && currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error('Você não pode remover o seu próprio acesso.');
      return;
    }
    const ok = await confirm({
      title: 'Excluir definitivamente?',
      message: `Para o dia a dia, prefira Inativar/Desligar "${u.name || u.email}" (preserva o histórico). A exclusão remove o perfil e é irreversível — use apenas em caso excepcional.`,
      confirmLabel: 'Excluir definitivamente',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUserProfile(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success('Perfil excluído.');
    } catch (err) {
      console.error('Falha ao remover usuário:', err);
      toast.error('Não foi possível remover o usuário.');
    }
  };

  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);
  // §20 — upload de capa por área (id da área em envio).
  const [capaBusy, setCapaBusy] = useState<string | null>(null);
  const handleCapaAreaUpload = async (id: string, file: File) => {
    setCapaBusy(id);
    try {
      const path = await uploadPropostaCapa(file, `_areas_${id}`);
      setProfile((prev) => ({ ...prev, capaAreas: { ...(prev.capaAreas || {}), [id]: path } }));
    } catch {
      showToast('Não foi possível enviar a imagem. Verifique a conexão com o Supabase.');
    } finally {
      setCapaBusy(null);
    }
  };
  const handleCapaAreaRemove = async (id: string) => {
    const path = profile.capaAreas?.[id];
    if (path) { try { await removePropostaCapa(path); } catch { /* best-effort */ } }
    setProfile((prev) => {
      const next = { ...(prev.capaAreas || {}) };
      delete next[id];
      return { ...prev, capaAreas: next };
    });
  };

  // §1 — logos oficiais da Fireowl (rasterizados p/ PNG no upload).
  const [logoBusy, setLogoBusy] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<Record<string, string>>({});
  const handleProfileLogoUpload = async (field: keyof CompanyProfile, slug: string, file: File) => {
    setLogoBusy(field as string);
    try {
      const path = await uploadInstitucionalLogo(file, slug);
      setProfile((prev) => ({ ...prev, [field]: path }));
      setLogoPreview((prev) => ({ ...prev, [field as string]: URL.createObjectURL(file) }));
    } catch {
      showToast('Não foi possível enviar o logo. Verifique a conexão com o Supabase.');
    } finally {
      setLogoBusy(null);
    }
  };
  const handleProfileLogoRemove = async (field: keyof CompanyProfile) => {
    const path = profile[field] as string | undefined;
    if (path) { try { await removeInstitucionalLogo(path); } catch { /* best-effort */ } }
    setProfile((prev) => ({ ...prev, [field]: undefined }));
    setLogoPreview((prev) => { const n = { ...prev }; delete n[field as string]; return n; });
  };

  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCategory, setNewBrandCategory] = useState('');
  const [newBrandSegment, setNewBrandSegment] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');
  const [brandLogoUrls, setBrandLogoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = partnerBrands
      .map((brand) => brand.logoUrl || '')
      .filter((url) => url && !/^https?:\/\//i.test(url));
    if (paths.length === 0) return;
    let active = true;
    resolveLogoDataUrls(paths).then((urls) => { if (active) setBrandLogoUrls(urls); });
    return () => { active = false; };
  }, [partnerBrands]);

  // Preferências (estado de UI — front-end)
  const [prefs, setPrefs] = useState({
    criticalStock: true,
    confirmDelete: true,
    compactMode: false,
  });

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCompanyProfile(profile);
    showToast('Dados da Empresa atualizados com sucesso!');
  };

  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    onAddPartnerBrand({
      id: `pb_${Date.now()}`,
      name: newBrandName.trim(),
      category: newBrandCategory.trim() || 'Equipamentos e Alarme',
      logoUrl: newBrandLogo.trim() || undefined,
      segment: newBrandSegment.trim() || undefined,
    });
    setNewBrandName('');
    setNewBrandCategory('');
    setNewBrandSegment('');
    setNewBrandLogo('');
  };

  const TABS = [
    { key: 'conta', label: 'Conta & Log', icon: 'manage_accounts' },
    { key: 'homologacao', label: 'Fila de Homologação', icon: 'fact_check' },
    { key: 'preferencias', label: 'Preferências', icon: 'settings' },
    { key: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
    ...(canSwitchRole ? [{ key: 'usuarios', label: 'Usuários', icon: 'group' }] : []),
  ] as { key: 'conta' | 'homologacao' | 'preferencias' | 'pdf' | 'usuarios'; label: string; icon: string }[];


  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
          Configurações da Empresa &amp; Rastreabilidade Integrada
        </span>
        <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">Configurações</h1>
      </div>

      {/* Tabs centralizadas */}
      <div className="flex justify-center">
        <div className="inline-flex bg-surface-3 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t.key ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary hover:text-fg-secondary'
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
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="apartment" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  Dados cadastrais da empresa
                </h3>
                <p className="text-[11px] text-fg-muted">Usados na capa e nas propostas comerciais.</p>
              </div>
            </div>

            <form onSubmit={handleSaveCompanyProfile} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div>
                  <label className={labelCls}>Nome fantasia</label>
                  <input
                    type="text"
                    value={profile.nomeFantasia || ''}
                    onChange={(e) => setProfile({ ...profile, nomeFantasia: e.target.value })}
                    placeholder="Ex.: Fireowl Controls"
                    className={`${inputCls} font-bold`}
                  />
                  <p className="text-[10px] text-fg-muted mt-1">Aparece no cabeçalho dos documentos.</p>
                </div>
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

              {/* §8 — Biblioteca de textos institucionais (usados na página "Áreas de Atuação") */}
              <div className="pt-3 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary mb-1">Textos institucionais das propostas</p>
                <p className="text-[11px] text-fg-muted mb-3">Aparecem na página &ldquo;Áreas de Atuação&rdquo;. Em branco, o texto padrão do sistema é usado.</p>
                <div className="mb-3">
                  <label className={labelCls}>Apresentação geral / multi-área</label>
                  <textarea
                    rows={2}
                    placeholder="Texto usado quando a proposta cobre várias áreas ou integração."
                    value={profile.apresentacaoGeral || ''}
                    onChange={(e) => setProfile({ ...profile, apresentacaoGeral: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    ['sdai', 'SDAI — Detecção e Alarme'],
                    ['cftv', 'CFTV / Videomonitoramento'],
                    ['acesso', 'Controle de Acesso'],
                    ['alarme', 'Alarme de Intrusão'],
                    ['bms', 'Automação / BMS'],
                    ['integracao', 'Integração'],
                  ] as const).map(([id, nome]) => (
                    <div key={id}>
                      <label className={labelCls}>{nome}</label>
                      <textarea
                        rows={2}
                        placeholder="Texto padrão do sistema"
                        value={profile.apresentacaoAreas?.[id] || ''}
                        onChange={(e) => setProfile({ ...profile, apresentacaoAreas: { ...(profile.apresentacaoAreas || {}), [id]: e.target.value } })}
                        className={inputCls}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase tracking-wider text-fg-muted">Capa:</span>
                        {profile.capaAreas?.[id] ? (
                          <>
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5"><span className="material-symbols-outlined text-[13px]">check_circle</span>definida</span>
                            <button type="button" onClick={() => handleCapaAreaRemove(id)} className="text-[10px] font-bold uppercase text-fg-muted hover:text-danger">remover</button>
                          </>
                        ) : (
                          <label className="text-[10px] font-bold uppercase text-primary hover:text-danger cursor-pointer">
                            {capaBusy === id ? 'enviando…' : 'enviar imagem'}
                            <input type="file" accept="image/*" className="hidden" disabled={capaBusy === id}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCapaAreaUpload(id, f); e.target.value = ''; }} />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-fg-muted mt-2">Capa por área: usada na proposta/orçamento quando o pedido não tem capa própria. Enviada ao salvar os dados da empresa.</p>
              </div>

              {/* §1 — Identidade visual (logos oficiais) */}
              <div className="pt-3 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary mb-1">Identidade visual (logos)</p>
                <p className="text-[11px] text-fg-muted mb-3">Prefira arquivos <b>SVG</b> para preservar a qualidade da marca em documentos impressos e PDFs (o sistema converte para PNG de alta resolução automaticamente).</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    ['logoPrincipalPath', 'Logo principal', 'principal'],
                    ['logoClaroPath', 'Logo p/ fundo claro', 'claro'],
                    ['logoEscuroPath', 'Logo p/ fundo escuro', 'escuro'],
                    ['logoIconePath', 'Ícone / símbolo', 'icone'],
                  ] as const).map(([field, nome, slug]) => (
                    <div key={field} className="rounded-lg border border-border p-2 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-fg-secondary text-center">{nome}</span>
                      <div className={`w-full h-14 rounded flex items-center justify-center overflow-hidden ${slug === 'escuro' ? 'bg-navy-3' : 'bg-surface-2 border border-border'}`}>
                        {logoPreview[field] ? (
                          <img src={logoPreview[field]} alt={nome} className="max-h-12 max-w-full object-contain" />
                        ) : profile[field] ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5"><span className="material-symbols-outlined text-[14px]">check_circle</span>definido</span>
                        ) : (
                          <span className="material-symbols-outlined text-fg-muted text-xl">image</span>
                        )}
                      </div>
                      {profile[field] ? (
                        <button type="button" onClick={() => handleProfileLogoRemove(field)} className="text-[10px] font-bold uppercase text-fg-muted hover:text-danger">remover</button>
                      ) : (
                        <label className={`text-[10px] font-bold uppercase cursor-pointer ${logoBusy === field ? 'text-fg-muted' : 'text-primary hover:text-danger'}`}>
                          {logoBusy === field ? 'enviando…' : 'enviar'}
                          <input type="file" accept="image/svg+xml,image/png,image/*" className="hidden" disabled={logoBusy === field}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProfileLogoUpload(field, slug, f); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* §8 — Textos da página "Experiência e Capacidade Técnica" + limites */}
              <div className="pt-3 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary mb-2">Experiência e Capacidade Técnica</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Texto — Empresas Atendidas</label>
                    <textarea rows={2} placeholder="A Fireowl Controls atua em diferentes ambientes comerciais, industriais e corporativos…" value={profile.expIntro || ''} onChange={(e) => setProfile({ ...profile, expIntro: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Texto — Marcas e Tecnologias</label>
                    <textarea rows={2} placeholder="Atuamos com tecnologias e equipamentos de fabricantes reconhecidos…" value={profile.techIntro || ''} onChange={(e) => setProfile({ ...profile, techIntro: e.target.value })} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Máx. de empresas na página</label>
                      <input type="number" min={0} max={20} value={profile.expMaxEmpresas ?? 8} onChange={(e) => setProfile({ ...profile, expMaxEmpresas: e.target.value === '' ? 8 : Number(e.target.value) })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Máx. de marcas na página</label>
                      <input type="number" min={0} max={20} value={profile.expMaxMarcas ?? 8} onChange={(e) => setProfile({ ...profile, expMaxMarcas: e.target.value === '' ? 8 : Number(e.target.value) })} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="bg-navy hover:bg-navy-3 text-white font-semibold py-2.5 px-5 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">save</span> Salvar dados da empresa
              </button>
            </form>
          </div>

          {/* Card: Experiência, Clientes e Marcas (apresentação institucional) */}
          <ExperienciaAdmin
            empresas={empresasAtendidas}
            marcas={marcasTecnologias}
            onSaveEmpresa={(e) => onSaveEmpresaAtendida?.(e)}
            onDeleteEmpresa={(id) => onDeleteEmpresaAtendida?.(id)}
            onSaveMarca={(m) => onSaveMarcaTecnologia?.(m)}
            onDeleteMarca={(id) => onDeleteMarcaTecnologia?.(id)}
          />

          {/* Card: Permissões (RBAC) */}
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="admin_panel_settings" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  Matriz de permissões (RBAC)
                </h3>
                <p className="text-[11px] text-fg-muted">
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
              <div className="flex items-center justify-between bg-surface-2 border border-border rounded-lg px-3 py-2.5">
                <span className="text-xs font-semibold text-fg-secondary">Perfil atual</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary bg-navy/5 px-2.5 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  {userRole}
                </span>
              </div>
            )}
          </div>

          {/* Log de auditoria */}
          <div>
            <h3 className="text-xs font-bold text-fg-secondary uppercase tracking-wider mb-3">
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
                      <span className="text-fg-secondary truncate max-w-[260px] inline-block align-bottom">{log.details}</span>
                    </>
                  }
                  center={
                    <div className="text-left md:text-center">
                      <p className="font-data-mono text-fg-secondary font-semibold">{log.timestamp}</p>
                      <p className="font-data-mono text-[10px] text-fg-muted">{log.ip}</p>
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
          {/* Aparência / Tema */}
          <div className="bg-surface p-6 rounded-xl border border-border shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="palette" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  Aparência
                </h3>
                <p className="text-[11px] text-fg-muted">Escolha o tema da interface. A preferência é salva neste aparelho.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              {([
                { key: 'light', label: 'Claro', icon: 'light_mode' },
                { key: 'dark', label: 'Escuro', icon: 'dark_mode' },
                { key: 'system', label: 'Sistema', icon: 'contrast' },
              ] as { key: ThemeMode; label: string; icon: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme(opt.key)}
                  aria-pressed={theme === opt.key}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    theme === opt.key
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface-2 text-fg-secondary hover:border-border-strong'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="layers" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  Biblioteca de marcas parceiras
                </h3>
                <p className="text-[11px] text-fg-muted">Fabricantes homologados para o seletor de propostas.</p>
              </div>
            </div>

            <form onSubmit={handleCreateBrand} className="bg-surface-2 p-3 rounded-lg border border-border space-y-2 text-xs mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                  placeholder="Segmento (ex.: Incêndio, CFTV)"
                  value={newBrandSegment}
                  onChange={(e) => setNewBrandSegment(e.target.value)}
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
                  className="shrink-0 px-4 bg-danger hover:bg-danger-hover text-white font-bold rounded-lg uppercase text-xs flex items-center gap-1"
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
                    (() => {
                      const logo = pb.logoUrl && (/^https?:\/\//i.test(pb.logoUrl) ? pb.logoUrl : brandLogoUrls[pb.logoUrl]);
                      return logo ? (
                        <img src={logo} alt={`Logo ${pb.name}`} className="w-10 h-10 rounded-lg border border-border bg-surface object-contain p-1 shrink-0" />
                      ) : (
                        <span className="w-10 h-10 bg-navy text-[#FFD700] font-bold rounded-lg flex items-center justify-center text-xs shrink-0">
                          {pb.name.slice(0, 2).toUpperCase()}
                        </span>
                      );
                    })()
                  }
                  title={pb.name}
                  meta={[pb.category, pb.segment].filter(Boolean).join(' · ')}
                  right={
                    <RowAction icon="delete" label="Remover marca" danger onClick={() => onDeletePartnerBrand(pb.id)} />
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: HOMOLOGAÇÃO ===== */}
      {tab === 'homologacao' && (
        <div className="flex flex-col gap-5">
          {/* Banner explicativo de negócio */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">fact_check</span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold uppercase tracking-wide">Fila de Homologação de Registros de Campo (§6.3 &amp; §9)</p>
              <p className="mt-0.5">
                Os registros criados por técnicos em campo nascem em estado <strong>provisório</strong>. Eles funcionam imediatamente nos relatórios de vistoria, mas exigem validação do Administrativo antes de virarem propostas comerciais ou produtos oficiais.
              </p>
            </div>
          </div>

          {/* Sub-tabs de Homologação */}
          <div className="flex border-b border-border gap-4 font-semibold text-xs uppercase tracking-wider">
            <button
              onClick={() => setHomolSubTab('clientes')}
              className={`pb-2 border-b-2 transition-colors ${
                homolSubTab === 'clientes' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Clientes Provisórios
            </button>
            <button
              onClick={() => setHomolSubTab('marcas')}
              className={`pb-2 border-b-2 transition-colors ${
                homolSubTab === 'marcas' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Marcas de Campo
            </button>
            <button
              onClick={() => setHomolSubTab('itens')}
              className={`pb-2 border-b-2 transition-colors ${
                homolSubTab === 'itens' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary'
              }`}
            >
              Itens a Precificar / Homologar
            </button>
          </div>

          {/* Conteúdo da Sub-tab Clientes */}
          {homolSubTab === 'clientes' && (
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider">
                  Clientes em Validação Comercial
                </h4>
                <span className="text-[10px] text-fg-muted">{provClients.length} pendente(s)</span>
              </div>

              {provClients.length === 0 ? (
                <p className="text-[11px] text-fg-muted italic py-6 text-center">Nenhum cliente provisório aguardando homologação.</p>
              ) : (
                <div className="space-y-2">
                  {provClients.map((c) => (
                    <div key={c.id} className="border border-border rounded-lg p-3 bg-surface-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase">
                          PROVISÓRIO &middot; {c.createdByRole || 'CAMPO'}
                        </span>
                        <p className="font-bold text-fg text-xs mt-1">{c.name || 'Sem nome'}</p>
                        <p className="text-[10px] text-fg-secondary font-data-mono">
                          {c.cnpj ? `CNPJ: ${c.cnpj}` : 'Sem CNPJ'}{c.segment ? ` · ${c.segment}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => aprovarCliente(c)}
                          disabled={homolBusy === c.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => { setMergeTarget(c); setMergeOficialId(''); }}
                          disabled={homolBusy === c.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                        >
                          Mesclar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conteúdo da Sub-tab Marcas */}
          {homolSubTab === 'marcas' && (
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider">
                Marcas Detectadas em Campo
              </h4>
              <p className="text-xs text-fg-secondary">
                Marcas encontradas em campo que não pertencem ao catálogo oficial de marcas parceiras homologadas.
              </p>
              {catMarcas.length === 0 ? (
                <p className="text-[11px] text-fg-muted italic py-6 text-center">Nenhuma marca de campo pendente.</p>
              ) : (
                catMarcas.map((m) => {
                  const nome = String(m.dados.nome || m.dados.name || 'Marca de campo');
                  const origem = String(m.dados.origem || m.dados.detectada_em || '');
                  return (
                    <div key={m.id} className="border border-border rounded-lg p-3 bg-surface-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-fg text-xs">{nome}</p>
                        {origem && <p className="text-[10px] text-fg-secondary">Detectada em: {origem}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => homologarMarca(m)}
                          disabled={homolBusy === m.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                        >
                          Homologar Marca
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Conteúdo da Sub-tab Itens */}
          {homolSubTab === 'itens' && (
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider">
                Itens de Catálogo a Precificar
              </h4>
              <p className="text-xs text-fg-secondary">
                Materiais informados em texto livre por técnicos. Definir preço e fornecedor para converter em produto do Estoque/Serviços.
              </p>
              {catItens.length === 0 ? (
                <p className="text-[11px] text-fg-muted italic py-6 text-center">Nenhum item de campo pendente de precificação.</p>
              ) : (
                catItens.map((it) => {
                  const nome = String(it.dados.nome || it.dados.descricao || it.dados.item || 'Item de campo');
                  const obs = String(it.dados.origem || it.dados.observacao || '');
                  return (
                    <div key={it.id} className="border border-amber-100 bg-amber-50/50 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 uppercase">Sem preço</span>
                        <p className="font-bold text-fg text-xs mt-1">{nome}</p>
                        {obs && <p className="text-[10px] text-fg-secondary font-data-mono">{obs}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => precificarItem(it)}
                          disabled={homolBusy === it.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                        >
                          Precificar
                        </button>
                        <button
                          onClick={() => mesclarItem(it)}
                          disabled={homolBusy === it.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                        >
                          Mesclar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Modal: mesclar cliente provisório com um oficial */}
          {mergeTarget && (
            <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-sm font-bold text-fg uppercase">Mesclar cliente provisório</h3>
                  <button onClick={() => setMergeTarget(null)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[11px] text-fg-secondary">
                    O provisório <strong>{mergeTarget.name}</strong> será unificado ao cliente oficial escolhido.
                    Relatórios, pendências, dispositivos, OS, ciclos, contratos e lançamentos são reatribuídos e o provisório é removido.
                  </p>
                  <div>
                    <label className={labelCls}>Cliente oficial de destino</label>
                    <select className={inputCls} value={mergeOficialId} onChange={(e) => setMergeOficialId(e.target.value)}>
                      <option value="">Selecione…</option>
                      {officialClients.map((oc) => (
                        <option key={oc.id} value={oc.id}>
                          {oc.name}{oc.cnpj ? ` — ${oc.cnpj}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
                  <button onClick={() => setMergeTarget(null)} className="px-4 py-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 rounded-lg uppercase">Cancelar</button>
                  <button
                    onClick={confirmarMerge}
                    disabled={!mergeOficialId || homolBusy === mergeTarget.id}
                    className="px-5 py-2 rounded-lg bg-navy hover:bg-navy-3 text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
                  >
                    {homolBusy === mergeTarget.id ? 'Mesclando…' : 'Confirmar mesclagem'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
          <p className="text-[11px] text-fg-muted px-1 pt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">info</span>
            Preferências de geração de PDF (aplicadas às propostas comerciais).
          </p>

          {/* ===== Documentos padrão por tipo de pedido ===== */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="material-symbols-outlined text-primary text-lg">rule</span>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                Documentos padrão por tipo de pedido
              </h3>
            </div>
            <p className="text-[11px] text-fg-muted px-1 mb-3">
              Defina o documento gerado automaticamente para cada tipo de pedido. Com um padrão definido, o PDF é
              gerado direto — sem o modal de escolha. Deixe em &ldquo;Sempre perguntar&rdquo; para escolher toda vez.
            </p>
            <div className="flex flex-col gap-2">
              {PEDIDO_TIPO_ORDER.map((tipo: PedidoTipo) => (
                <div
                  key={tipo}
                  className="flex items-center justify-between gap-3 bg-surface border border-border rounded-lg px-3 py-2.5"
                >
                  <span className="text-sm font-semibold text-fg-secondary">{PEDIDO_TIPO_LABELS[tipo]}</span>
                  <select
                    value={documentosPadrao[tipo] ?? 'nenhum'}
                    onChange={(e) => {
                      const v = e.target.value as DocumentType | 'nenhum';
                      const next: DocumentosPadrao = { ...documentosPadrao };
                      if (v === 'nenhum') delete next[tipo];
                      else next[tipo] = v;
                      onUpdateDocumentosPadrao(next);
                    }}
                    className="text-xs font-semibold text-fg-secondary border border-border rounded-lg px-2.5 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[190px]"
                  >
                    <option value="nenhum">Sempre perguntar (nenhum padrão)</option>
                    {DOCUMENT_TYPE_ORDER.map((doc: DocumentType) => (
                      <option key={doc} value={doc}>
                        {DOCUMENT_TYPE_LABELS[doc]}
                        {isDocumentoImplementado(doc) ? '' : ' (em breve)'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-fg-muted px-1 pt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              Fase 1: só a Proposta comercial já gera de verdade; os demais documentos entram em breve.
            </p>
          </div>
        </div>
      )}

      {/* ===== TAB: USUÁRIOS (apenas admin) ===== */}
      {tab === 'usuarios' && canSwitchRole && (
        <div className="flex flex-col gap-6">
          {/* Novo usuário */}
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <SettingIcon icon="person_add" />
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  Novo usuário
                </h3>
                <p className="text-[11px] text-fg-muted">Crie o acesso com uma senha temporária para entregar diretamente ao funcionário.</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs font-medium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nome de exibição</label>
                  <input type="text" value={nuName} onChange={(e) => setNuName(e.target.value)} className={inputCls} placeholder="Ex.: Isaac L." />
                </div>
                <div>
                  <label className={labelCls}>Perfil de acesso</label>
                  <select value={nuRole} onChange={(e) => setNuRole(e.target.value as UserRole)} className={`${inputCls} font-semibold`}>
                    <option value="ADMINISTRATIVO">Administrativo — acesso total</option>
                    <option value="GESTOR">Gestor — operação e contratos</option>
                    <option value="FINANCEIRO">Financeiro — receitas e despesas</option>
                    <option value="TECNICO">Técnico — campo e ponto</option>
                  </select>
                  <p className="text-[10px] text-fg-muted mt-1">Controla o acesso ao sistema (RLS). Não é o cargo.</p>
                </div>
                <div>
                  <label className={labelCls}>Cargo (função profissional)</label>
                  <input type="text" value={nuCargo} onChange={(e) => setNuCargo(e.target.value)} className={inputCls} placeholder="Ex.: Técnico de Campo, Analista Administrativo" />
                  <p className="text-[10px] text-fg-muted mt-1">Descritivo; não altera permissões.</p>
                </div>
                <div>
                  <label className={labelCls}>Status inicial</label>
                  <select value={nuStatus} onChange={(e) => setNuStatus(e.target.value as UserStatus)} className={inputCls}>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>
                <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer">
                  <input type="checkbox" checked={nuUsesTimeClock} onChange={(e) => setNuUsesTimeClock(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1A1A72]" />
                  <span><strong className="block text-xs text-fg">Controle de ponto {nuUsesTimeClock ? 'ativado' : 'desativado'}</strong><span className="text-[10px] text-fg-secondary">Quando ativado, este funcionário participa do registro de jornada, ajustes e espelho de ponto.</span></span>
                </label>
                <div>
                  <label className={labelCls}>E-mail (login)</label>
                  <input type="email" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="nome@fireowlcontrols.com.br" />
                </div>
                <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-3 text-[11px] text-amber-900">Esta é uma senha temporária. O funcionário será obrigado a criar uma nova senha no primeiro acesso.</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><label className={labelCls}>Senha temporária</label><div className="relative"><input type={showNuPassword ? 'text' : 'password'} value={nuTemporaryPassword} onChange={(e) => setNuTemporaryPassword(e.target.value)} className={`${inputCls} pr-11 font-data-mono`} autoComplete="new-password"/><button type="button" onClick={() => setShowNuPassword((v) => !v)} className="absolute right-1 top-1 min-h-9 min-w-9" aria-label={showNuPassword ? 'Ocultar senha' : 'Mostrar senha'}><span className="material-symbols-outlined text-lg">{showNuPassword ? 'visibility_off' : 'visibility'}</span></button></div></div>
                    <div><label className={labelCls}>Confirmar senha temporária</label><input type={showNuPassword ? 'text' : 'password'} value={nuTemporaryPasswordConfirm} onChange={(e) => setNuTemporaryPasswordConfirm(e.target.value)} className={`${inputCls} font-data-mono`} autoComplete="new-password"/></div>
                  </div>
                  <button type="button" onClick={() => { const generated = generateStrongPassword(); setNuTemporaryPassword(generated); setNuTemporaryPasswordConfirm(generated); setShowNuPassword(true); }} className="mt-3 rounded-lg border border-amber-300 bg-surface px-3 py-2 text-[11px] font-bold uppercase text-amber-900">Gerar senha</button>
                </div>
              </div>

              {/* Dados do funcionário */}
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">Dados do funcionário</p>
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
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">
                  Escala de trabalho (usada nos alertas de ponto)
                </p>
                <ScheduleEditor value={nuSchedule} onChange={setNuSchedule} />
              </div>

              {createMsg && (
                <p className={`text-[11px] font-semibold ${createMsg.startsWith('OK') ? 'text-emerald-700' : 'text-danger'}`}>
                  {createMsg.replace(/^OK: /, '')}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="bg-danger hover:bg-danger-hover text-white font-semibold py-2.5 px-5 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-70"
              >
                <span className={`material-symbols-outlined text-base ${creating ? 'animate-spin' : ''}`}>
                  {creating ? 'progress_activity' : 'person_add'}
                </span>
                {creating ? 'Criando...' : 'Criar funcionário'}
              </button>
            </form>
          </div>

          {/* Lista de usuários */}
          <div>
            <h3 className="text-xs font-bold text-fg-secondary uppercase tracking-wider mb-3">Usuários com acesso</h3>
            {usersLoading ? (
              <div className="bg-surface rounded-xl shadow-sm py-12 text-center text-fg-muted">
                <span className="material-symbols-outlined text-3xl animate-spin inline-block">progress_activity</span>
              </div>
            ) : usersError ? (
              <div className="bg-surface rounded-xl shadow-sm py-10 text-center text-danger text-xs font-semibold">{usersError}</div>
            ) : users.length === 0 ? (
              <div className="bg-surface rounded-xl shadow-sm py-12 text-center text-fg-muted">
                <span className="material-symbols-outlined text-4xl text-fg-muted">group</span>
                <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhum usuário</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {users.map((u) => {
                  const isSelf = !!currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase();
                  return (
                    <DataListRow
                      key={u.id}
                      leading={
                        <span className="w-10 h-10 rounded-lg bg-navy text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {(u.name || u.email).slice(0, 2).toUpperCase()}
                        </span>
                      }
                      title={
                        <span>
                          {u.name || '—'}
                          {isSelf && <span className="ml-2 text-[10px] text-fg-muted uppercase">(você)</span>}
                        </span>
                      }
                      meta={
                        <>
                          <span className="font-data-mono text-fg-secondary">{u.email}</span>
                          {u.cargo && <span className="text-fg-secondary">{u.cargo}</span>}
                          <Badge color={u.status === 'ATIVO' && u.firstAccessCompleted ? 'emerald' : u.status === 'ATIVO' ? 'amber' : u.status === 'INATIVO' ? 'amber' : 'slate'}>
                            {u.status === 'ATIVO' && !u.firstAccessCompleted ? 'Primeiro acesso pendente' : u.status === 'ATIVO' ? 'Ativo' : u.status === 'INATIVO' ? 'Inativo' : 'Desligado'}
                          </Badge>
                        </>
                      }
                      right={
                        <>
                          <select
                            aria-label="Perfil de acesso"
                            title="Perfil de acesso (permissões)"
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                            className="border border-border rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-secondary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="ADMINISTRATIVO">Administrativo</option>
                            <option value="GESTOR">Gestor</option>
                            <option value="FINANCEIRO">Financeiro</option>
                            <option value="TECNICO">Técnico</option>
                          </select>
                          <select
                            aria-label="Status do funcionário"
                            title="Status (ciclo de vida)"
                            value={u.status}
                            disabled={isSelf || statusBusy === u.id}
                            onChange={(e) => handleStatusChange(u, e.target.value as UserStatus)}
                            className="border border-border rounded-lg px-2 py-1.5 text-[11px] font-semibold text-fg-secondary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                          >
                            <option value="ATIVO">Ativo</option>
                            <option value="INATIVO">Inativo</option>
                            <option value="DESLIGADO">Desligado</option>
                          </select>
                          <RowAction icon="edit" label="Editar dados" onClick={() => openEditUser(u)} />
                          {canReset && !isSelf && (
                            <RowAction icon="lock_reset" label="Redefinir senha" onClick={() => setResetUser(u)} />
                          )}
                          {!isSelf && (
                            <RowAction icon="delete" label="Excluir definitivamente (excepcional)" danger onClick={() => handleDeleteUser(u)} />
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-fg-muted mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              Use o status (Ativo/Inativo/Desligado) para o ciclo de vida — nada é excluído. &quot;Excluir&quot; é excepcional; a conta de login é removida no painel do Supabase.
            </p>
          </div>
        </div>
      )}

      {createdTemporaryPassword && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <span className="material-symbols-outlined text-5xl text-emerald-600">task_alt</span>
            <h3 className="mt-2 text-lg font-bold text-fg">Funcionário criado com sucesso</h3>
            <p className="mt-1 text-xs text-fg-secondary">Copie e entregue esta senha temporária agora. Depois de fechar, ela não ficará disponível novamente.</p>
            <div className="mt-4 rounded-xl bg-surface-3 p-3 font-data-mono text-sm font-bold text-fg break-all">{createdTemporaryPassword}</div>
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(createdTemporaryPassword); toast.success('Senha temporária copiada.'); }} className="mt-3 w-full rounded-lg border border-primary py-2.5 text-xs font-bold uppercase text-primary">Copiar senha temporária</button>
            <button type="button" onClick={() => { setCreatedTemporaryPassword(null); setNuTemporaryPassword(''); setNuTemporaryPasswordConfirm(''); setShowNuPassword(false); }} className="mt-2 w-full rounded-lg bg-navy py-2.5 text-xs font-bold uppercase text-white">Fechar</button>
          </div>
        </div>
      )}

      {resetUser && canReset && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
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
        <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-3 text-xs font-medium">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome de exibição</label>
              <input value={euForm.name} onChange={(e) => setEuForm({ ...euForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Perfil de acesso</label>
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
              <p className="text-[10px] text-fg-muted mt-1">Permissões (RLS). Distinto do cargo.</p>
            </div>
            <div>
              <label className={labelCls}>Cargo (função profissional)</label>
              <input value={euForm.cargo} onChange={(e) => setEuForm({ ...euForm, cargo: e.target.value })} className={inputCls} placeholder="Ex.: Coordenador Técnico" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={euForm.status}
                onChange={(e) => setEuForm({ ...euForm, status: e.target.value as UserStatus })}
                className={inputCls}
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="DESLIGADO">Desligado</option>
              </select>
              <p className="text-[10px] text-fg-muted mt-1">Só ATIVO acessa o sistema. Não exclui histórico.</p>
            </div>
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 cursor-pointer">
              <input type="checkbox" checked={euForm.usesTimeClock} onChange={(e) => setEuForm({ ...euForm, usesTimeClock: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#1A1A72]" />
              <span><strong className="block text-xs text-fg">Controle de ponto {euForm.usesTimeClock ? 'ativado' : 'desativado'}</strong><span className="text-[10px] text-fg-secondary">Quando ativado, este funcionário participa do registro de jornada, ajustes e espelho de ponto.</span></span>
            </label>
            <div>
              <label className={labelCls}>Nome completo</label>
              <input value={euForm.fullName} onChange={(e) => setEuForm({ ...euForm, fullName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                CPF
                <span className="ml-1 text-[9px] font-normal text-fg-muted normal-case">(dado sensível — LGPD)</span>
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
                    className={`${inputCls} font-data-mono bg-surface-2 text-fg-secondary cursor-default`}
                  />
                  <button
                    type="button"
                    onClick={() => setRevealCpf(true)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border text-[11px] font-semibold text-primary hover:bg-surface-2"
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

        <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">Escala de trabalho</p>
          <ScheduleEditor value={euForm.schedule} onChange={(s) => setEuForm({ ...euForm, schedule: s })} />
        </div>

        {/* Documentos (Storage privado) */}
        <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              Documentos (diplomas, NRs, currículo)
            </p>
            <input ref={docFileRef} type="file" onChange={handleUploadDoc} className="hidden" />
            <button
              type="button"
              onClick={() => docFileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy-3 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-70"
            >
              <span className={`material-symbols-outlined text-base ${uploading ? 'animate-spin' : ''}`}>
                {uploading ? 'progress_activity' : 'upload_file'}
              </span>
              {uploading ? 'Enviando...' : 'Enviar documento'}
            </button>
          </div>

          {docsLoading ? (
            <p className="text-xs text-fg-muted">Carregando documentos...</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-fg-muted">Nenhum documento enviado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.path} className="flex items-center justify-between py-2 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-fg-muted">description</span>
                    <span className="truncate text-fg-secondary">{d.name.replace(/^\d+_/, '')}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(d.path)}
                      className="text-primary font-semibold hover:underline px-2"
                    >
                      abrir
                    </button>
                    <RowAction icon="delete" label="Excluir documento" danger onClick={() => handleDeleteDoc(d)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-fg-muted mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">lock</span>
            Armazenamento privado — acesso só do próprio funcionário e do administrador, via link temporário.
          </p>
        </div>
      </SidePanel>
    </div>
  );
};
