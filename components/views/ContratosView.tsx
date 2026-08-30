'use client';

import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Contract, Client } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { usePrivacy } from '@/lib/privacy';
import { publishDocumentVerification, verificationUrl } from '@/lib/documentVerification';
import { ContractDetailPanel } from '@/components/contratos/ContractDetailPanel';

interface ContratosViewProps {
  contracts: Contract[];
  clients: Client[];
  onAddContract: (contract: Contract) => void;
}

/** Áreas/sistemas cobertos (multi-select) e tipos de atendimento. */
const AREAS_COBERTAS = ['SDAI', 'CFTV', 'BMS / Automação', 'Alarme / Intrusão', 'Controle de Acesso', 'Iluminação de Emergência', 'Pressurização'];
const TIPOS_ATENDIMENTO = ['Preventiva', 'Corretiva', 'Emergencial', 'Inspeção', 'Operação', 'Suporte remoto'];
const MATERIAIS_POLITICAS = [
  { v: 'inclusos', l: 'Materiais inclusos' },
  { v: 'nao_inclusos', l: 'Materiais não inclusos' },
  { v: 'limite', l: 'Inclusos até um limite' },
  { v: 'so_mao_de_obra', l: 'Somente mão de obra' },
  { v: 'mediante_aprovacao', l: 'Fornecimento mediante aprovação' },
];

const _labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';
const _inputCls = 'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';

/** Multi-select por chips. */
const Chips: React.FC<{ options: string[]; selected: string[]; onToggle: (v: string) => void }> = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const on = selected.includes(o);
      return (
        <button key={o} type="button" onClick={() => onToggle(o)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${on ? 'bg-[#0B1E38] text-white border-[#0B1E38]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#0B1E38]'}`}>{o}</button>
      );
    })}
  </div>
);

/** Editor de lista de strings. */
const StrList: React.FC<{ items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder?: string }> = ({ items, onChange, addLabel, placeholder }) => (
  <div className="space-y-2">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-2">
        <input value={it} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={placeholder} className={`flex-1 ${_inputCls}`} />
        <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg shrink-0"><span className="material-symbols-outlined text-base">delete</span></button>
      </div>
    ))}
    <button type="button" onClick={() => onChange([...items, ''])} className="w-full py-2 rounded-lg border border-dashed border-[#0B1E38]/40 text-[11px] font-semibold text-[#0B1E38] hover:bg-[#0B1E38]/5 uppercase">+ {addLabel}</button>
  </div>
);

/** Seção colapsável do cadastro. */
const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200 p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-[#0B1E38] mb-3">{title}</p>
    {children}
  </div>
);

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const contractStatusColor = (status: Contract['status']) =>
  status === 'ATIVO' ? 'emerald' : status === 'A VENCER' ? 'amber' : 'red';

const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';
const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';

/** Converte "2026-12-30" (input date) para "30 DEZ 2026" (padrão exibido no sistema). */
const formatDateBR = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return `${String(d).padStart(2, '0')} ${meses[m - 1]} ${y}`;
};

export const ContratosView: React.FC<ContratosViewProps> = ({
  contracts,
  clients,
  onAddContract,
}) => {
  const { maskMoney } = usePrivacy();
  const [showModal, setShowModal] = useState(false);
  const [selectedPdfContract, setSelectedPdfContract] = useState<Contract | null>(null);

  // Formulário de novo contrato (vinculado à base de clientes)
  const [fClientId, setFClientId] = useState('');
  const [fUnit, setFUnit] = useState('');
  const [fScope, setFScope] = useState('Manutenção Preventiva + Corretiva SDAI');
  const [fMonthly, setFMonthly] = useState(15000);
  const [fStatus, setFStatus] = useState<Contract['status']>('ATIVO');
  const [fStartDate, setFStartDate] = useState('');
  const [fRenewalDate, setFRenewalDate] = useState('');
  const [fIndex, setFIndex] = useState('IPCA (+4.5%)');
  const [fHours, setFHours] = useState(100);
  const [fPaymentDay, setFPaymentDay] = useState(10);
  const [fResponsible, setFResponsible] = useState('Isaac Lopes');

  // ETAPA 3 — modo edição + campos estruturados
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [fNumero, setFNumero] = useState('');
  const [fRespComercial, setFRespComercial] = useState('');
  const [fRenovAuto, setFRenovAuto] = useState(false);
  const [fAvisoDias, setFAvisoDias] = useState<number | ''>(30);
  const [fReajustePeriodo, setFReajustePeriodo] = useState<number | ''>(12);
  const [fFaturamento, setFFaturamento] = useState('');
  const [fObsFinanceiras, setFObsFinanceiras] = useState('');
  const [fAreas, setFAreas] = useState<string[]>([]);
  const [fTiposAtend, setFTiposAtend] = useState<string[]>([]);
  const [fIncluso, setFIncluso] = useState<string[]>([]);
  const [fNaoIncluso, setFNaoIncluso] = useState<string[]>([]);
  const [fRespContratada, setFRespContratada] = useState<string[]>([]);
  const [fRespContratante, setFRespContratante] = useState<string[]>([]);
  const [fEntregaveis, setFEntregaveis] = useState<string[]>([]);
  const [fMateriaisPol, setFMateriaisPol] = useState('');
  const [fMateriaisObs, setFMateriaisObs] = useState('');
  const [fSla, setFSla] = useState<{ situacao: string; prazo: string; cobertura?: string }[]>([]);
  const [fObsOper, setFObsOper] = useState('');
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const selectedClient = clients.find((c) => c.id === fClientId) || null;

  const parseBRtoISO = (s?: string): string => {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const meses: Record<string, string> = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' };
    const m = s.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
    if (m && meses[m[2]]) return `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}`;
    return '';
  };

  const openCreate = () => {
    setEditingId(null);
    setFClientId(clients[0]?.id || '');
    setFUnit(clients[0]?.address || '');
    setFScope('Manutenção Preventiva + Corretiva SDAI');
    setFMonthly(15000);
    setFStatus('ATIVO');
    setFStartDate('');
    setFRenewalDate('');
    setFIndex('IPCA (+4.5%)');
    setFHours(100);
    setFPaymentDay(10);
    setFResponsible('Isaac Lopes');
    setFNumero(''); setFRespComercial(''); setFRenovAuto(false); setFAvisoDias(30); setFReajustePeriodo(12);
    setFFaturamento(''); setFObsFinanceiras(''); setFAreas([]); setFTiposAtend([]);
    setFIncluso([]); setFNaoIncluso([]); setFRespContratada([]); setFRespContratante([]); setFEntregaveis([]);
    setFMateriaisPol(''); setFMateriaisObs(''); setFSla([]); setFObsOper('');
    setShowModal(true);
  };

  const openEdit = (c: Contract) => {
    setEditingId(c.id);
    setFClientId(c.clientId || '');
    setFUnit(c.unit || '');
    setFScope(c.contractType || '');
    setFMonthly(c.monthlyValue || 0);
    setFStatus(c.status);
    setFStartDate(parseBRtoISO(c.startDate));
    setFRenewalDate(parseBRtoISO(c.renewalDate));
    setFIndex(c.readjustmentIndex || '');
    setFHours(c.contractedHours || 0);
    setFPaymentDay(c.paymentDay || 10);
    setFResponsible(c.responsibleTech || '');
    setFNumero(c.numero || ''); setFRespComercial(c.responsavelComercial || '');
    setFRenovAuto(!!c.renovacaoAutomatica); setFAvisoDias(c.avisoAntecedenciaDias ?? 30);
    setFReajustePeriodo(c.reajustePeriodicidadeMeses ?? 12);
    setFFaturamento(c.faturamento || ''); setFObsFinanceiras(c.observacoesFinanceiras || '');
    setFAreas(c.areasCobertas || []); setFTiposAtend(c.tiposAtendimento || []);
    setFIncluso(c.incluso || []); setFNaoIncluso(c.naoIncluso || []);
    setFRespContratada(c.respContratada || []); setFRespContratante(c.respContratante || []);
    setFEntregaveis(c.entregaveis || []); setFMateriaisPol(c.materiaisPolitica || '');
    setFMateriaisObs(c.materiaisObs || ''); setFSla(c.sla || []); setFObsOper(c.observacoesOperacionais || '');
    setShowModal(true);
  };

  const handleSelectClient = (id: string) => {
    setFClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) setFUnit(c.address);
  };

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === fClientId);
    if (!client) return;

    const existing = editingId ? contracts.find((c) => c.id === editingId) : null;
    const stamp = Date.now().toString(36);
    const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
    onAddContract({
      // Preserva o registro histórico ao editar (id, usedHours, art, source, createdAt).
      ...(existing || {}),
      id: existing?.id || `CTR-FOWL-${stamp}`,
      clientName: client.name,
      clientId: client.id,
      unit: fUnit || client.address || 'Unidade Londrina',
      contractType: fScope,
      monthlyValue: Number(fMonthly),
      startDate: formatDateBR(fStartDate),
      renewalDate: formatDateBR(fRenewalDate) || existing?.renewalDate || '30 DEZ 2026',
      readjustmentIndex: fIndex,
      contractedHours: Number(fHours),
      usedHours: existing?.usedHours ?? 0,
      paymentDay: Number(fPaymentDay),
      status: fStatus,
      responsibleTech: fResponsible,
      artDocumentRef: existing?.artDocumentRef || `ART-PR-2026-${stamp}`,
      // ETAPA 3 — estruturados
      numero: fNumero.trim() || undefined,
      responsavelComercial: fRespComercial.trim() || undefined,
      renovacaoAutomatica: fRenovAuto,
      avisoAntecedenciaDias: fAvisoDias === '' ? undefined : Number(fAvisoDias),
      reajustePeriodicidadeMeses: fReajustePeriodo === '' ? undefined : Number(fReajustePeriodo),
      faturamento: fFaturamento.trim() || undefined,
      observacoesFinanceiras: fObsFinanceiras.trim() || undefined,
      areasCobertas: fAreas,
      tiposAtendimento: fTiposAtend,
      incluso: clean(fIncluso),
      naoIncluso: clean(fNaoIncluso),
      respContratada: clean(fRespContratada),
      respContratante: clean(fRespContratante),
      entregaveis: clean(fEntregaveis),
      materiaisPolitica: fMateriaisPol || undefined,
      materiaisObs: fMateriaisObs.trim() || undefined,
      sla: fSla.filter((r) => r.situacao.trim() || r.prazo.trim()),
      observacoesOperacionais: fObsOper.trim() || undefined,
    });

    setShowModal(false);
    setEditingId(null);
  };

  const totalMonthlyRec = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);

  // Imprime o resumo do contrato numa janela nova (imprimir → salvar como PDF).
  const printContract = async (ctr: Contract) => {
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const row = (label: string, valor: string) =>
      `<tr>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;width:40%">${esc(label)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace">${valor}</td>
      </tr>`;
    const authenticityUrl = verificationUrl('contrato', ctr.id);
    let qrDataUrl = '';
    try {
      await publishDocumentVerification({ type: 'contrato', sourceId: ctr.id, number: ctr.id, clientName: ctr.clientName, issuedAt: ctr.startDate, status: ctr.status });
      qrDataUrl = await QRCode.toDataURL(authenticityUrl, { width: 112, margin: 1, errorCorrectionLevel: 'M' });
    } catch (error) { console.warn('Não foi possível publicar a validação do contrato:', error); }
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Contrato ${esc(ctr.id)} — Fireowl Controls</title></head>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;max-width:800px;margin:0 auto">
        <div style="border-bottom:3px solid #E63946;padding-bottom:10px;margin-bottom:18px">
          <p style="margin:0;font-family:monospace;color:#E63946;font-weight:bold;font-size:12px">${esc(ctr.id)}</p>
          <h2 style="margin:2px 0 0;text-transform:uppercase">${esc(ctr.clientName)}</h2>
          <p style="margin:2px 0 0;font-size:13px;color:#64748b">Contrato de Manutenção de Sistemas SDAI &amp; Hidráulicos</p>
        </div>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          ${ctr.contractType ? row('Escopo', esc(ctr.contractType)) : ''}
          ${row('Unidade / Local', esc(ctr.unit))}
          ${row('Valor mensal', brl(ctr.monthlyValue))}
          ${row('Início da vigência', esc(ctr.startDate || '—'))}
          ${row('Renovação', esc(ctr.renewalDate))}
          ${row('Índice de reajuste', esc(ctr.readjustmentIndex))}
          ${row('Bolsa de horas de campo', `${ctr.usedHours}h / ${ctr.contractedHours}h`)}
          ${row('Responsável técnico', esc(ctr.responsibleTech))}
          ${row('Registro ART CREA', esc(ctr.artDocumentRef))}
          ${row('Status', esc(ctr.status))}
        </table>
        <div style="display:flex;align-items:center;gap:12px;margin-top:22px;padding:10px;border:1px solid #bbf7d0;border-left:3px solid #059669;background:#f0fdf4;border-radius:6px">
          ${qrDataUrl ? `<img src="${qrDataUrl}" width="66" height="66" alt="QR de autenticidade">` : ''}
          <div><strong style="font-size:11px;color:#047857;text-transform:uppercase">Contrato verificável</strong><p style="margin:4px 0 0;font-size:11px;color:#475569">${qrDataUrl ? 'Aponte a câmera para confirmar a autenticidade deste documento.' : `Validação: ${esc(authenticityUrl)}`}</p></div>
        </div>
        <p style="margin-top:24px;font-size:11px;color:#94a3b8">Emitido em ${new Date().toLocaleDateString('pt-BR')} · Fireowl Controls</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para gerar o documento.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo de Receita Recorrente (MRR)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Gestão de Contratos de Manutenção
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Contrato
        </button>
      </div>

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Receita Mensal Recorrente (MRR)</p>
          <h2 className="font-data-mono text-3xl font-bold text-slate-900 mt-2">
            {maskMoney(brl(totalMonthlyRec))}
          </h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Contratos Vigentes</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">{contracts.length}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Índice de Reajuste Anual</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#E63946] mt-2">IPCA (+4.8%)</h2>
        </div>
      </div>

      {/* Lista de contratos */}
      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">description</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhum contrato cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;Novo Contrato&quot; para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contracts.map((ctr) => {
            const pct = ctr.contractedHours > 0 ? Math.round((ctr.usedHours / ctr.contractedHours) * 100) : 0;
            return (
              <DataListRow
                key={ctr.id}
                leading={
                  <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">description</span>
                  </span>
                }
                title={<span className="uppercase">{ctr.clientName}</span>}
                meta={
                  <>
                    <RowMeta label="Ref" value={<span className="font-data-mono">{ctr.id}</span>} />
                    {ctr.contractType && <RowMeta label="Escopo" value={ctr.contractType} />}
                    <RowMeta label="Unidade" value={ctr.unit} />
                    <RowMeta label="Resp" value={ctr.responsibleTech} />
                    <RowMeta label="ART" value={<span className="font-data-mono">{ctr.artDocumentRef}</span>} />
                  </>
                }
                center={
                  <div className="w-40">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                      <span>Bolsa de horas</span>
                      <span className="font-data-mono">
                        {ctr.usedHours}/{ctr.contractedHours}h
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-[#1A1A72] h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-data-mono">
                      Renova: {ctr.renewalDate} · {ctr.readjustmentIndex}
                    </p>
                  </div>
                }
                right={
                  <>
                    <div className="text-right">
                      <span className="font-data-mono font-bold text-emerald-600 text-base md:text-lg block">
                        {maskMoney(brl(ctr.monthlyValue))}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">por mês</span>
                    </div>
                    <Badge color={contractStatusColor(ctr.status)}>{ctr.status}</Badge>
                    <RowAction icon="event_repeat" label="Rotinas, agenda, bolsa de horas e documentos" onClick={() => setDetailContract(ctr)} />
                    <RowAction icon="edit" label="Editar contrato" onClick={() => openEdit(ctr)} />
                    <RowAction icon="print" label="Imprimir resumo do contrato" onClick={() => setSelectedPdfContract(ctr)} />
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Modal Add Contract */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-xl border border-slate-200 shadow-2xl relative max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase">{editingId ? 'Editar Contrato' : 'Novo Contrato Recorrente'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Vincule o contrato a um cliente da base e defina as condições comerciais.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">
                ✕
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">group_off</span>
                <p className="mt-2 text-sm font-bold text-slate-600 uppercase">Nenhum cliente cadastrado</p>
                <p className="text-xs text-slate-400 mt-1">Cadastre um cliente na aba <strong>Clientes</strong> antes de criar um contrato.</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs uppercase hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateContract} className="p-6 space-y-4 text-xs font-medium overflow-y-auto">
                {/* Cliente vinculado */}
                <div>
                  <label className={labelCls}>Cliente (base cadastral)</label>
                  <select value={fClientId} onChange={(e) => handleSelectClient(e.target.value)} className={inputCls} required>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.cnpj}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dados do cliente selecionado (somente leitura) */}
                {selectedClient && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider">Código</p>
                      <p className="font-data-mono text-slate-800 font-semibold">{selectedClient.code}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider">Segmento</p>
                      <p className="text-slate-800 font-semibold">{selectedClient.segment}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider">Status cadastral</p>
                      <p className="text-slate-800 font-semibold">{selectedClient.contractStatus}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wider">Contato</p>
                      <p className="text-slate-800 font-semibold truncate">{selectedClient.contacts?.[0]?.name || '—'}</p>
                    </div>
                  </div>
                )}

                {/* Unidade / local */}
                <div>
                  <label className={labelCls}>Unidade / Local de Atendimento</label>
                  <input
                    type="text"
                    value={fUnit}
                    onChange={(e) => setFUnit(e.target.value)}
                    className={inputCls}
                    placeholder="Ex.: Unidade Londrina — Torre A"
                  />
                </div>

                {/* Escopo do contrato */}
                <div>
                  <label className={labelCls}>Escopo do Contrato</label>
                  <select value={fScope} onChange={(e) => setFScope(e.target.value)} className={inputCls}>
                    <option>Manutenção Preventiva SDAI</option>
                    <option>Manutenção Preventiva + Corretiva SDAI</option>
                    <option>CFTV &amp; Monitoramento</option>
                    <option>Controle de Acesso</option>
                    <option>Automação Predial (BMS)</option>
                    <option>Full (Multissistemas)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Valor mensal */}
                  <div>
                    <label className={labelCls}>Valor Mensal Recorrente (R$)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={fMonthly}
                      onChange={(e) => setFMonthly(Number(e.target.value))}
                      className={`${inputCls} font-data-mono`}
                    />
                  </div>
                  {/* Horas contratadas */}
                  <div>
                    <label className={labelCls}>Bolsa de Horas / mês</label>
                    <input
                      type="number"
                      min={0}
                      value={fHours}
                      onChange={(e) => setFHours(Number(e.target.value))}
                      className={`${inputCls} font-data-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Início da vigência */}
                  <div>
                    <label className={labelCls}>Início da Vigência</label>
                    <input
                      type="date"
                      value={fStartDate}
                      onChange={(e) => setFStartDate(e.target.value)}
                      className={`${inputCls} font-data-mono`}
                    />
                  </div>
                  {/* Renovação */}
                  <div>
                    <label className={labelCls}>Data de Renovação</label>
                    <input
                      type="date"
                      value={fRenewalDate}
                      onChange={(e) => setFRenewalDate(e.target.value)}
                      className={`${inputCls} font-data-mono`}
                    />
                  </div>
                  {/* Dia de vencimento */}
                  <div>
                    <label className={labelCls}>Dia de Vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={fPaymentDay}
                      onChange={(e) => setFPaymentDay(Number(e.target.value))}
                      className={`${inputCls} font-data-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Índice de reajuste */}
                  <div>
                    <label className={labelCls}>Índice de Reajuste</label>
                    <select value={fIndex} onChange={(e) => setFIndex(e.target.value)} className={inputCls}>
                      <option>IPCA (+4.5%)</option>
                      <option>IGP-M (+5.0%)</option>
                      <option>INPC (+4.2%)</option>
                      <option>Sem reajuste</option>
                    </select>
                  </div>
                  {/* Responsável técnico (movido) */}
                  <div>
                    <label className={labelCls}>Responsável Técnico (ART)</label>
                    <input
                      type="text"
                      value={fResponsible}
                      onChange={(e) => setFResponsible(e.target.value)}
                      className={inputCls}
                      placeholder="Isaac Lopes"
                    />
                  </div>
                </div>

                <div>
                  {/* Status */}
                  <label className={labelCls}>Status do Contrato</label>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Contract['status'])} className={inputCls}>
                    <option value="ATIVO">ATIVO</option>
                    <option value="A VENCER">A VENCER</option>
                    <option value="SUSPENSO">SUSPENSO</option>
                  </select>
                </div>

                {/* ===== ETAPA 3 — cadastro estruturado ===== */}
                <FormSection title="Identificação">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className={_labelCls}>Número do contrato</label><input value={fNumero} onChange={(e) => setFNumero(e.target.value)} className={_inputCls} placeholder="Ex.: 2026-014" /></div>
                    <div><label className={_labelCls}>Responsável comercial</label><input value={fRespComercial} onChange={(e) => setFRespComercial(e.target.value)} className={_inputCls} /></div>
                  </div>
                </FormSection>

                <FormSection title="Vigência & reajuste">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={fRenovAuto} onChange={(e) => setFRenovAuto(e.target.checked)} /> Renovação automática</label>
                    <div><label className={_labelCls}>Aviso de renovação (dias)</label><input type="number" min={0} value={fAvisoDias} onChange={(e) => setFAvisoDias(e.target.value === '' ? '' : Number(e.target.value))} className={_inputCls} /></div>
                    <div><label className={_labelCls}>Reajuste a cada (meses)</label><input type="number" min={1} value={fReajustePeriodo} onChange={(e) => setFReajustePeriodo(e.target.value === '' ? '' : Number(e.target.value))} className={_inputCls} /></div>
                  </div>
                </FormSection>

                <FormSection title="Financeiro">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className={_labelCls}>Faturamento</label><input value={fFaturamento} onChange={(e) => setFFaturamento(e.target.value)} className={_inputCls} placeholder="Ex.: Mensal, dia 10, NF-e" /></div>
                    <div><label className={_labelCls}>Observações financeiras</label><input value={fObsFinanceiras} onChange={(e) => setFObsFinanceiras(e.target.value)} className={_inputCls} /></div>
                  </div>
                </FormSection>

                <FormSection title="Áreas / sistemas cobertos">
                  <Chips options={AREAS_COBERTAS} selected={fAreas} onToggle={(v) => setFAreas((a) => toggle(a, v))} />
                </FormSection>

                <FormSection title="Tipos de atendimento">
                  <Chips options={TIPOS_ATENDIMENTO} selected={fTiposAtend} onToggle={(v) => setFTiposAtend((a) => toggle(a, v))} />
                </FormSection>

                <FormSection title="SLA (situação → prazo)">
                  <div className="space-y-2">
                    {fSla.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input value={r.situacao} onChange={(e) => setFSla((p) => p.map((x, idx) => (idx === i ? { ...x, situacao: e.target.value } : x)))} placeholder="Situação (ex.: Falha crítica)" className={_inputCls} />
                        <input value={r.prazo} onChange={(e) => setFSla((p) => p.map((x, idx) => (idx === i ? { ...x, prazo: e.target.value } : x)))} placeholder="Prazo (ex.: Até 4h)" className={_inputCls} />
                        <button type="button" onClick={() => setFSla((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-[#E63946] p-1">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setFSla((p) => [...p, { situacao: '', prazo: '' }])} className="text-[11px] font-semibold text-[#1A1A72] hover:text-[#E63946] uppercase">+ Adicionar SLA</button>
                  </div>
                </FormSection>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormSection title="Incluso"><StrList items={fIncluso} onChange={setFIncluso} addLabel="Adicionar" placeholder="Item incluso" /></FormSection>
                  <FormSection title="Não incluso"><StrList items={fNaoIncluso} onChange={setFNaoIncluso} addLabel="Adicionar" placeholder="Item fora do escopo" /></FormSection>
                  <FormSection title="Responsabilidades da Contratada"><StrList items={fRespContratada} onChange={setFRespContratada} addLabel="Adicionar" /></FormSection>
                  <FormSection title="Responsabilidades da Contratante"><StrList items={fRespContratante} onChange={setFRespContratante} addLabel="Adicionar" /></FormSection>
                </div>

                <FormSection title="Entregáveis"><StrList items={fEntregaveis} onChange={setFEntregaveis} addLabel="Adicionar entregável" placeholder="Ex.: Relatório mensal, ART, checklist" /></FormSection>

                <FormSection title="Materiais">
                  <label className={_labelCls}>Política</label>
                  <select value={fMateriaisPol} onChange={(e) => setFMateriaisPol(e.target.value)} className={_inputCls}>
                    <option value="">Selecione…</option>
                    {MATERIAIS_POLITICAS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                  <label className={`${_labelCls} mt-2`}>Observações de materiais</label>
                  <input value={fMateriaisObs} onChange={(e) => setFMateriaisObs(e.target.value)} className={_inputCls} />
                </FormSection>

                <FormSection title="Observações / cláusulas operacionais">
                  <textarea rows={3} value={fObsOper} onChange={(e) => setFObsOper(e.target.value)} className={_inputCls} />
                </FormSection>

                <button
                  type="submit"
                  className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
                >
                  {editingId ? 'Salvar alterações do contrato' : 'Salvar e Ativar Contrato'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal PDF Preview */}
      {selectedPdfContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setSelectedPdfContract(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <div className="border-b border-slate-200 pb-3 mb-4">
              <span className="font-data-mono text-xs text-[#E63946] font-bold">{selectedPdfContract.id}</span>
              <h3 className="text-xl font-bold text-slate-900 uppercase">{selectedPdfContract.clientName}</h3>
              <p className="text-xs text-slate-500">Contrato de Manutenção de Sistemas SDAI &amp; Hidráulicos</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-slate-200 mb-6">
              <div><strong>Valor Mensal:</strong> R$ {selectedPdfContract.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><strong>Renovação Automática:</strong> {selectedPdfContract.renewalDate}</div>
              <div><strong>Reajuste Aplicável:</strong> {selectedPdfContract.readjustmentIndex}</div>
              <div><strong>Bolsa de Horas de Campo:</strong> {selectedPdfContract.usedHours}h / {selectedPdfContract.contractedHours}h</div>
              <div><strong>Responsável Técnico:</strong> {selectedPdfContract.responsibleTech}</div>
              <div><strong>Registro ART CREA:</strong> {selectedPdfContract.artDocumentRef}</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => void printContract(selectedPdfContract)}
                className="bg-[#E63946] hover:bg-[#a51515] text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
              >
                Imprimir Documento
              </button>
              <button
                onClick={() => setSelectedPdfContract(null)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {detailContract && (
        <ContractDetailPanel contract={detailContract} onClose={() => setDetailContract(null)} />
      )}
    </div>
  );
};
