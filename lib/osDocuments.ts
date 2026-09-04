import { Client, CompanyProfile, OrdemServico, Pedido, ServiceAttendance, ServiceAttendanceEvidenceItem } from './types';
import { fetchServiceAttendances } from './serviceAttendances';
import { fetchEvidenceItems } from './evidenceItems';
import { listFieldPhotosForOs, FieldPhoto, FieldPhotoMoment } from './fieldPhotos';
import { fetchOsMission, OsMission } from './osMission';
import { fetchTimeClockParticipants, getUserFullName } from './users';
import { resolveLogoDataUrls } from './institucional';
import { resolveFieldPhotoDataUrls } from './fieldPhotoStorage';
import { getClientOperationalName, getClientLegalName } from './utils';

/* ===================================================================
 * FECHAMENTO DOCUMENTAL — monta, a partir das FONTES REAIS (Pedido + OS +
 * Atendimentos + Itens de Evidência + Fotos + Assinaturas), o view-model que os
 * documentos React-PDF (OS executada e Relatório Técnico) apenas apresentam.
 * Nada é inventado: apenas organiza/formata/embute dados existentes (§8/§11).
 * NUNCA carrega dado comercial (preço/custo/margem) — a Missão vem price-free.
 * =================================================================== */

export interface DocEvidencePhoto { id: string; moment?: FieldPhotoMoment; dataUrl?: string; note?: string; brand?: string; model?: string; capturedAt?: string; }
export interface DocEvidenceItem {
  id: string; title: string; category: string; equipmentType?: string;
  manufacturer?: string; model?: string; deviceAddress?: string; location?: string; notes?: string;
  antes: DocEvidencePhoto[]; durante: DocEvidencePhoto[]; depois: DocEvidencePhoto[];
}
export interface DocAttendance {
  id: string; index: number; technicianName: string; technicianRole?: string;
  startedAt?: string; finishedAt?: string; result?: string;
  diagnosis?: string; executionNotes?: string;
  centralConditionInitial?: string; centralConditionFinal?: string; centralNotApplicable?: boolean; centralNaReason?: string;
  centralAntes: DocEvidencePhoto[]; centralDepois: DocEvidencePhoto[];
  items: DocEvidenceItem[];
  signature?: { name?: string; role?: string; status?: string; note?: string; signedAt?: string; dataUrl?: string };
}
export interface OsDocumentData {
  os: OrdemServico;
  clientOperational: string;
  clientLegal: string;
  clientLogoDataUrl?: string;
  fachadaDataUrl?: string;
  companyLogoDataUrl?: string;
  company: CompanyProfile | null;
  mission: OsMission;
  /** Textos do Pedido de origem (só quando o chamador tem acesso — gestão). */
  objetivo?: string;
  premissas?: string[];
  conclusao?: string;
  attendances: DocAttendance[];
}

const RESULT_LABEL: Record<string, string> = {
  RESOLVIDO: 'Resolvido', PARCIALMENTE_RESOLVIDO: 'Parcialmente resolvido', NAO_RESOLVIDO: 'Não resolvido',
};
export const attendanceResultLabel = (r?: string) => (r ? RESULT_LABEL[r] || r : '—');

const toPhoto = (p: FieldPhoto, urls: Record<string, string>): DocEvidencePhoto => ({
  id: p.id,
  moment: p.evidenceMoment,
  dataUrl: urls[p.storagePathEvidencia || p.storagePathOriginal] || urls[p.storagePathOriginal],
  note: p.notaRapida,
  brand: p.equipmentBrand,
  model: p.equipmentModel,
  capturedAt: p.capturadoEm,
});

/**
 * Monta o pacote documental da OS. `pedido` é opcional: quando fornecido (a
 * gestão tem o Pedido em memória), enriquece objetivo/premissas/conclusão; sem
 * ele (técnico, RLS de pedidos), o documento usa a Missão (price-free) e a
 * descrição da OS. Resolve as imagens (logos/fachada/fotos/assinaturas) para
 * data URIs, pois o React-PDF não acessa o bucket privado por URL.
 */
export async function buildOsDocumentData(
  os: OrdemServico,
  ctx: { company: CompanyProfile | null; client?: Client; pedido?: Pedido }
): Promise<OsDocumentData> {
  const [attendancesRaw, mission, participants] = await Promise.all([
    fetchServiceAttendances({ workOrderId: os.id }).catch(() => [] as ServiceAttendance[]),
    fetchOsMission(os.id).catch(() => ({ found: false, source: 'os', services: [], materials: [], responsibilities: [], servicosOfertados: [], area: [] } as OsMission)),
    fetchTimeClockParticipants().catch(() => []),
  ]);
  // Atendimentos em ordem cronológica (mais antigo primeiro) para o relatório.
  const attendances = [...attendancesRaw].sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));

  const techById = new Map(participants.map((p) => [p.id, p]));

  const [items, photos] = await Promise.all([
    Promise.all(attendances.map((a) => fetchEvidenceItems(a.id).catch(() => [] as ServiceAttendanceEvidenceItem[]))),
    listFieldPhotosForOs(os.id).catch(() => [] as FieldPhoto[]),
  ]);
  const itemsByAttendance = new Map<string, ServiceAttendanceEvidenceItem[]>();
  attendances.forEach((a, i) => itemsByAttendance.set(a.id, items[i] || []));

  // Resolve imagens: logos/fachada (report-media) + fotos (field-photos).
  const logoPaths = [ctx.company?.logoPrincipalPath, ctx.company?.logoIconePath, ctx.client?.logoPath, ctx.client?.fachadaPath, ...attendances.map((a) => a.clientSignaturePath)];
  const [logoMap, photoMap] = await Promise.all([
    resolveLogoDataUrls(logoPaths.filter((p): p is string => !!p)).catch(() => ({} as Record<string, string>)),
    resolveFieldPhotoDataUrls(photos.flatMap((p) => [p.storagePathEvidencia, p.storagePathOriginal])).catch(() => ({} as Record<string, string>)),
  ]);

  const photosOf = (attId: string, itemId: string | undefined, moment: FieldPhotoMoment): DocEvidencePhoto[] =>
    photos.filter((p) => p.serviceAttendanceId === attId && (itemId === undefined ? !p.evidenceItemId : p.evidenceItemId === itemId) && p.evidenceMoment === moment).map((p) => toPhoto(p, photoMap));

  const docAttendances: DocAttendance[] = attendances.map((a, idx) => {
    const its = (itemsByAttendance.get(a.id) || []).map((it): DocEvidenceItem => ({
      id: it.id, title: it.title, category: it.category, equipmentType: it.equipmentType,
      manufacturer: it.manufacturer, model: it.model, deviceAddress: it.deviceAddress, location: it.location, notes: it.notes,
      antes: photosOf(a.id, it.id, 'ANTES'), durante: photosOf(a.id, it.id, 'DURANTE'), depois: photosOf(a.id, it.id, 'DEPOIS'),
    }));
    const tech = a.technicianId ? techById.get(a.technicianId) : undefined;
    return {
      id: a.id, index: idx + 1,
      technicianName: getUserFullName(tech, 'Técnico'),
      technicianRole: tech?.cargo,
      startedAt: a.startedAt, finishedAt: a.finishedAt, result: a.result,
      diagnosis: a.diagnosis, executionNotes: a.executionNotes,
      centralConditionInitial: a.centralConditionInitial, centralConditionFinal: a.centralConditionFinal,
      centralNotApplicable: a.centralNotApplicable, centralNaReason: a.centralNaReason,
      centralAntes: photosOf(a.id, undefined, 'CENTRAL_ANTES'), centralDepois: photosOf(a.id, undefined, 'CENTRAL_DEPOIS'),
      items: its,
      signature: a.clientSignatureStatus ? {
        name: a.clientSignatureName, role: a.clientSignatureRole, status: a.clientSignatureStatus,
        note: a.clientSignatureNote, signedAt: a.clientSignedAt,
        dataUrl: a.clientSignaturePath ? logoMap[a.clientSignaturePath] : undefined,
      } : undefined,
    };
  });

  const prop = ctx.pedido?.proposal;
  return {
    os,
    clientOperational: getClientOperationalName(ctx.client?.name || os.clienteId, 'Cliente'),
    clientLegal: getClientLegalName(ctx.client?.name, ''),
    clientLogoDataUrl: ctx.client?.logoPath ? logoMap[ctx.client.logoPath] : undefined,
    fachadaDataUrl: ctx.client?.fachadaPath ? logoMap[ctx.client.fachadaPath] : undefined,
    companyLogoDataUrl: (ctx.company?.logoPrincipalPath && logoMap[ctx.company.logoPrincipalPath]) || (ctx.company?.logoIconePath && logoMap[ctx.company.logoIconePath]) || undefined,
    company: ctx.company,
    mission,
    objetivo: prop?.objetivo || undefined,
    premissas: Array.isArray(prop?.premissas) ? prop!.premissas.filter((s) => (s || '').trim()) : undefined,
    conclusao: prop?.conclusao || undefined,
    attendances: docAttendances,
  };
}

/**
 * Nome de arquivo saneado (§21/§47). O número da OS já contém "OS-2026-0003";
 * não duplicar o prefixo "OS". Ex.: OS-2026-0003-MUFFATO-FOODS.pdf e
 * RELATORIO-TECNICO-OS-2026-0003-MUFFATO-FOODS.pdf.
 */
export function osDocumentFileName(kind: 'os' | 'relatorio', os: OrdemServico, clientOperational: string): string {
  const slug = (s: string) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase().slice(0, 40);
  const numero = slug(os.numero || `OS-${os.id.slice(0, 8)}`);
  const cli = slug(clientOperational);
  const base = kind === 'relatorio' ? `RELATORIO-TECNICO-${numero}` : numero;
  return `${base}${cli ? `-${cli}` : ''}.pdf`;
}
