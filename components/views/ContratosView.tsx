'use client';
import { showToast } from '@/components/ui/Feedback';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Contract, Client, UserRole } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { usePrivacy } from '@/lib/privacy';
import { publishDocumentVerification, verificationUrl } from '@/lib/documentVerification';
import { ContractDetailPanel } from '@/components/contratos/ContractDetailPanel';
import { ContractForm } from '@/components/contratos/ContractForm';
import { ClientLogo } from '@/components/ClientLogo';
import { resolveLogoDataUrls } from '@/lib/institucional';
import { friendlyContractRef } from '@/lib/contracts';
import { nomeFantasiaCliente } from '@/lib/utils';

interface ContratosViewProps {
  contracts: Contract[];
  clients: Client[];
  onAddContract: (contract: Contract) => void;
  userRole?: UserRole;
  /** Usuário atual (técnico que iniciaria o atendimento contratual). */
  currentUserId?: string;
  /** Recarrega os contratos após excluir/encerrar. */
  onReload?: () => void | Promise<void>;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const contractStatusColor = (status: Contract['status']) =>
  status === 'ATIVO' ? 'emerald' : status === 'A VENCER' ? 'amber' : 'red';

const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';
const inputCls =
  'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger/40';

export const ContratosView: React.FC<ContratosViewProps> = ({
  contracts,
  currentUserId,
  onReload,
  clients,
  onAddContract,
  userRole,
}) => {
  const { maskMoney } = usePrivacy();
  const [showModal, setShowModal] = useState(false);
  const [selectedPdfContract, setSelectedPdfContract] = useState<Contract | null>(null);

  // Formulário extraído para ContractForm (reutilizado no Cliente 360). Aqui só o
  // contrato em edição (null = criação).
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [detailTab, setDetailTab] = useState<'rotinas' | 'operacoes' | 'horas' | 'docs'>('rotinas');
  const openDetail = (ctr: Contract, tab: 'rotinas' | 'operacoes' | 'horas' | 'docs') => { setDetailTab(tab); setDetailContract(ctr); };

  // Logos dos clientes (data URLs) para exibir na linha do contrato.
  const [clientLogoUrls, setClientLogoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    resolveLogoDataUrls(clients.map((c) => c.logoPath || '').filter(Boolean))
      .then((map) => { if (alive) setClientLogoUrls(map); })
      .catch(() => {});
    return () => { alive = false; };
  }, [clients]);
  const clientForContract = (ctr: Contract) =>
    clients.find((c) => c.id === ctr.clientId)
    || clients.find((c) => (c.name || '').toUpperCase() === (ctr.clientName || '').toUpperCase());

  const openCreate = () => { setEditingContract(null); setShowModal(true); };
  const openEdit = (c: Contract) => { setEditingContract(c); setShowModal(true); };

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
      showToast('Permita pop-ups para gerar o documento.');
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
      <div className="flex justify-between items-center border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Módulo de Receita Recorrente (MRR)
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            Gestão de Contratos de Manutenção
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Contrato
        </button>
      </div>

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Receita Mensal Recorrente (MRR)</p>
          <h2 className="font-data-mono text-3xl font-bold text-fg mt-2">
            {maskMoney(brl(totalMonthlyRec))}
          </h2>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Contratos Vigentes</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">{contracts.length}</h2>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-fg-secondary uppercase">Índice de Reajuste Anual</p>
          <h2 className="font-data-mono text-3xl font-bold text-danger mt-2">IPCA (+4.8%)</h2>
        </div>
      </div>

      {/* Lista de contratos */}
      {contracts.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm py-16 text-center text-fg-muted">
          <span className="material-symbols-outlined text-4xl text-fg-muted">description</span>
          <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhum contrato cadastrado</p>
          <p className="text-xs text-fg-muted mt-1">Clique em &quot;Novo Contrato&quot; para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contracts.map((ctr) => {
            const pct = ctr.contractedHours > 0 ? Math.round((ctr.usedHours / ctr.contractedHours) * 100) : 0;
            return (
              <DataListRow
                key={ctr.id}
                leading={
                  <ClientLogo
                    src={(() => { const cli = clientForContract(ctr); return cli?.logoPath ? clientLogoUrls[cli.logoPath] : undefined; })()}
                    name={nomeFantasiaCliente(ctr.clientName)}
                    sizeClass="w-10 h-10"
                    rounded="rounded-lg"
                    padding="p-1"
                    fallback={<span className="material-symbols-outlined text-lg">description</span>}
                  />
                }
                title={<span className="uppercase">{ctr.clientName}</span>}
                meta={
                  <>
                    <RowMeta label="Ref" value={<span className="font-data-mono">{friendlyContractRef(ctr)}</span>} />
                    {ctr.contractType && <RowMeta label="Escopo" value={ctr.contractType} />}
                    <RowMeta label="Unidade" value={ctr.unit} />
                    <RowMeta label="Resp" value={ctr.responsibleTech} />
                  </>
                }
                center={
                  <div className="w-40">
                    <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider">
                      <span>Bolsa de horas</span>
                      <span className="font-data-mono">
                        {ctr.usedHours}/{ctr.contractedHours}h
                      </span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-navy h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-fg-secondary mt-1 font-data-mono">
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
                      <span className="text-[10px] text-fg-muted uppercase">por mês</span>
                    </div>
                    <Badge color={contractStatusColor(ctr.status)}>{ctr.status}</Badge>
                    <RowAction icon="hub" label="Operações de campo (auditoria, residente, preventiva…)" onClick={() => openDetail(ctr, 'operacoes')} />
                    <RowAction icon="event_repeat" label="Rotinas, agenda, bolsa de horas e documentos" onClick={() => openDetail(ctr, 'rotinas')} />
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
        <ContractForm
          clients={clients}
          contracts={contracts}
          contract={editingContract}
          userRole={userRole}
          onSaved={(c) => { onAddContract(c); setShowModal(false); }}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* Modal PDF Preview */}
      {selectedPdfContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-lg w-full rounded-xl border border-border p-6 shadow-2xl relative">
            <button onClick={() => setSelectedPdfContract(null)} className="absolute top-4 right-4 text-fg-muted hover:text-fg-secondary font-bold">
              ✕
            </button>
            <div className="border-b border-border pb-3 mb-4">
              <span className="font-data-mono text-xs text-danger font-bold">{selectedPdfContract.id}</span>
              <h3 className="text-xl font-bold text-fg uppercase">{selectedPdfContract.clientName}</h3>
              <p className="text-xs text-fg-secondary">Contrato de Manutenção de Sistemas SDAI &amp; Hidráulicos</p>
            </div>

            <div className="bg-surface-2 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-border mb-6">
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
                className="bg-danger hover:bg-danger-hover text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
              >
                Imprimir Documento
              </button>
              <button
                onClick={() => setSelectedPdfContract(null)}
                className="px-4 border border-border text-fg-secondary font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {detailContract && (
        <ContractDetailPanel
          contract={detailContract}
          onClose={() => setDetailContract(null)}
          userRole={userRole}
          initialTab={detailTab}
          technicianId={currentUserId}
          onChanged={() => { setDetailContract(null); void onReload?.(); }}
        />
      )}
    </div>
  );
};
