import { ReportInstance, ReportAnswer, ReportMedia, ReportSignature, Pendencia, Client, CompanyProfile, UserRole } from './types';
import { fetchAnswers, fetchMedia } from './reports';
import { fetchSignatures } from './signatures';
import { fetchPendencias } from './pendencias';
import { resolveLogoDataUrls } from './institucional';
import { formatGeo } from './geo';
import { nomeFantasiaCliente, slugArquivo } from './utils';
import { ALL_TEMPLATES } from './reportTemplatesData';
import { FieldSchema } from './reportSchema';

/**
 * Camada de dados do PDF de Relatório Técnico (react-pdf). NÃO altera o motor de
 * coleta: só LÊ reports/answers/media/signatures/pendencias e monta um objeto
 * plano com imagens já em data URI. Regra de ouro: nada é inventado — campos
 * vazios não aparecem.
 */

export type ReportNivel = 'simples' | 'tecnico' | 'corporativo';

export interface RpFoto {
  url?: string;
  /** A original é preservada: a marcada é usada como principal quando houver. */
  originalUrl?: string;
  marcadaUrl?: string;
  tipo?: ReportMedia['tipo'];
  contexto?: string;
  legenda?: string;
  nota?: string;
}
export interface RpCard {
  titulo: string;
  descricao?: string;
  local?: string;
  acao?: string;
  qtd?: string;
  /** Fotos ligadas ao card, com tipo e original preservados. */
  fotos: RpFoto[];
}
export interface RpSecao { key: string; titulo: string; cards: RpCard[] }
export interface RpCampo { label: string; valor: string; reprovado?: boolean }
export interface RpRespostaSecao { titulo: string; campos: RpCampo[] }
export interface RpPend {
  grupo: string;
  descricao?: string;
  acao?: string;
  norma?: string;
  status?: string;
  criticidade?: number;
  fotoUrl?: string;
}
export interface RpSig { nome: string; cargo?: string; papel: string; documentoMasc?: string; url?: string }
export interface RpIndicador { label: string; valor: string }
export interface RpStatus { label: string; valor: number; tone: 'ok' | 'warn' | 'info' }

export interface ReportPdfData {
  tipo: ReportInstance['tipo'];
  tituloDoc: string;
  tipoLabel: string;
  numero: string;
  nivel: ReportNivel;
  // cliente
  clienteNome: string;
  clienteFantasia?: string;
  clienteCnpj?: string;
  clienteEndereco?: string;
  clienteContato?: string;
  clienteLogoUrl?: string;
  local?: string;
  // execução
  tecnicoNome?: string;
  responsavelTecnico?: string;
  dataInicio?: string;
  dataFim?: string;
  geoResumo?: string;
  geoRegistrada: boolean;
  resumoTexto?: string;
  conclusaoTexto?: string;
  indicadores: RpIndicador[];
  status: RpStatus[];
  secoes: RpSecao[];
  /** Respostas escalares, organizadas pelo título real do template. */
  respostasPorSecao: RpRespostaSecao[];
  registroFotografico: RpFoto[];
  pendencias: RpPend[];
  assinaturas: RpSig[];
  // identidade Fireowl
  razaoSocial: string;
  fantasiaFireowl?: string;
  cnpjFireowl?: string;
  contatoFireowl?: string;
  logoFireowlUrl?: string;
  capaImagemUrl?: string;
}

// ------------------------------ helpers puros ------------------------------

export const TIPO_LABEL_REL: Record<string, string> = {
  LEVANTAMENTO: 'Levantamento Técnico',
  CORRETIVA: 'Manutenção Corretiva',
  PREVENTIVA: 'Manutenção Preventiva',
};

export function tituloRelatorio(tipo: string): string {
  if (tipo === 'CORRETIVA') return 'Relatório Técnico de Manutenção Corretiva';
  if (tipo === 'PREVENTIVA') return 'Relatório Técnico de Manutenção Preventiva';
  if (tipo === 'LEVANTAMENTO') return 'Relatório Técnico de Levantamento';
  return 'Relatório Técnico';
}

/** Nome do arquivo: Relatorio-COR-2026-00123-NomeFantasia.pdf */
export function nomeArquivoRelatorio(numero: string, clienteNome?: string): string {
  const fant = slugArquivo(nomeFantasiaCliente(clienteNome));
  return `Relatorio-${numero || 'SN'}${fant ? `-${fant}` : ''}.pdf`;
}

const isPath = (v: unknown): v is string => typeof v === 'string' && /[\w-]+\/[\w./-]+/.test(v) && !v.startsWith('http') && !v.startsWith('data:');

const maskDoc = (d?: string) => {
  const digits = (d || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 5) return '•••';
  return `${digits.slice(0, 3)}.•••.•••-${digits.slice(-2)}`;
};

/** Extrai cards de apontamento/serviço (repeater) das respostas. */
export function extrairCards(answers: { valor: unknown }[]): { grupo: string; card: RpCard; fotoPaths: string[] }[] {
  const out: { grupo: string; card: RpCard; fotoPaths: string[] }[] = [];
  answers.forEach((a) => {
    if (!Array.isArray(a.valor)) return;
    (a.valor as unknown[]).forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const c = item as Record<string, unknown>;
        // Apontamento/serviço = achado real (tem descrição ou item). Linhas de
        // checklist de dispositivos (só 'dispositivo'+contagens) NÃO entram aqui;
        // suas não conformidades já viram pendências.
        if (c.descricao || c.item) {
          const fotoPaths = Array.isArray(c.foto) ? (c.foto as unknown[]).filter(isPath) as string[] : [];
          out.push({
            grupo: (c.grupo as string) || 'Geral',
            fotoPaths,
            card: {
              titulo: (c.item as string) || (c.descricao as string) || 'Item',
              descricao: (c.descricao as string) || undefined,
              local: (c.local as string) || undefined,
              acao: (c.acao_executada as string) || (c.acao_recomendada as string) || undefined,
              qtd: c.quantidade ? `${c.quantidade} ${(c.unidade as string) || ''}`.trim() : undefined,
              fotos: [],
            },
          });
        }
      }
    });
  });
  return out;
}

const textoValor = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) {
    const valores = value.filter((v) => typeof v === 'string' || typeof v === 'number').map(String);
    return valores.length ? valores.join(', ') : undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const campoPorKey = (templateCodigo: string, key: string): { field?: FieldSchema; secao?: string } => {
  const template = ALL_TEMPLATES.find((t) => t.codigo === templateCodigo);
  for (const secao of template?.secoes || []) {
    for (const field of secao.campos) {
      if (field.key === key) return { field, secao: secao.titulo };
    }
  }
  return {};
};

/** Respostas simples do formulário; fotos, assinaturas e campos internos não vão ao PDF. */
function extrairRespostasPorSecao(report: ReportInstance, answers: ReportAnswer[]): RpRespostaSecao[] {
  const porSecao = new Map<string, RpCampo[]>();
  for (const answer of answers) {
    const { field, secao } = campoPorKey(report.templateCodigo, answer.fieldKey);
    if (field && (field.tipo === 'foto' || field.tipo === 'assinatura' || field.tipo === 'select_interno')) continue;
    const valor = textoValor(answer.valor);
    if (!valor) continue;
    const titulo = secao || answer.secao || 'Informações técnicas';
    const campos = porSecao.get(titulo) || [];
    campos.push({
      // Relatórios antigos ou templates removidos continuam legíveis: quando o
      // schema não estiver mais disponível, exibe a chave humana sem inventar
      // qualquer dado técnico.
      label: field?.label || answer.fieldKey.replace(/_/g, ' '),
      valor,
      reprovado: /reprovado|\bnão\b|com falha|não testado/i.test(valor),
    });
    porSecao.set(titulo, campos);
  }
  return [...porSecao.entries()].map(([titulo, campos]) => ({ titulo, campos }));
}

/** Conta dispositivos avaliados (cards com chave 'dispositivo'). */
function contarDispositivos(answers: { valor: unknown }[]): number {
  let n = 0;
  answers.forEach((a) => {
    if (Array.isArray(a.valor)) (a.valor as unknown[]).forEach((it) => { if (it && typeof it === 'object' && (it as any).dispositivo) n += 1; });
  });
  return n;
}

/** Monta o objeto do PDF a partir dos dados já buscados (PURO — testável). */
export function assembleReportPdfData(input: {
  report: ReportInstance;
  answers: ReportAnswer[];
  media: ReportMedia[];
  signatures: ReportSignature[];
  pendencias: Pendencia[];
  cliente?: Client;
  companyProfile?: CompanyProfile;
  nivel: ReportNivel;
  urlOf: (path?: string) => string | undefined;
}): ReportPdfData {
  const { report, answers, media, signatures, pendencias, cliente, companyProfile, nivel, urlOf } = input;

  // Foto de exibição: prefere a versão marcada.
  const markedOf: Record<string, string> = {};
  media.forEach((m) => { if (m.storagePathMarcado) markedOf[m.storagePathOriginal] = m.storagePathMarcado; });
  const fotoDe = (p?: string, tipo?: ReportMedia['tipo'], contexto?: string): RpFoto | undefined => {
    if (!p) return undefined;
    const marcadaPath = markedOf[p];
    const originalUrl = urlOf(p);
    const marcadaUrl = urlOf(marcadaPath);
    const meta = legendaDe[p] || {};
    const url = marcadaUrl || originalUrl;
    return url ? { url, originalUrl, marcadaUrl, tipo, contexto, ...meta } : undefined;
  };
  const legendaDe: Record<string, { legenda?: string; nota?: string }> = {};
  media.forEach((m) => { legendaDe[m.storagePathOriginal] = { legenda: m.legenda, nota: m.notaRapida }; });

  // Cards agrupados.
  const cardsRaw = extrairCards(answers);
  const mediaPorPath = new Map(media.map((m) => [m.storagePathOriginal, m]));
  cardsRaw.forEach((cr) => {
    cr.card.fotos = cr.fotoPaths.map((p) => fotoDe(p, mediaPorPath.get(p)?.tipo)).filter(Boolean) as RpFoto[];
  });
  const classificadas = new Set<string>();
  cardsRaw.forEach((cr) => cr.fotoPaths.forEach((p) => classificadas.add(p)));

  const grupos = Array.from(new Set(cardsRaw.map((c) => c.grupo)));
  const secoes: RpSecao[] = grupos.map((g) => ({
    key: g,
    titulo: g,
    cards: cardsRaw.filter((c) => c.grupo === g).map((c) => c.card),
  }));

  // Registro fotográfico geral (bandeja: sem answer, não classificadas).
  const registroFotografico: RpFoto[] = media
    // Fotos de campos simples também entram no registro, com o contexto do
    // campo. Assim uma foto vinculada a uma resposta nunca desaparece do PDF.
    .filter((m) => !classificadas.has(m.storagePathOriginal))
    .map((m) => {
      const answer = answers.find((a) => a.id === m.answerId);
      const field = answer ? campoPorKey(report.templateCodigo, answer.fieldKey).field : undefined;
      return fotoDe(m.storagePathOriginal, m.tipo, field?.label);
    })
    .filter((f): f is RpFoto => !!f?.url);

  // Pendências.
  const pends: RpPend[] = pendencias.map((p) => {
    const mediaAssociada = media.find((m) => m.pendenciaId === p.id);
    return ({
    grupo: p.grupo || 'Pendência',
    descricao: p.descricao,
    acao: p.acaoRecomendada,
    norma: p.normaReferencia,
    status: p.status,
    // Criticidade é campo operacional interno: não é exportada para o cliente.
    fotoUrl: mediaAssociada ? fotoDe(mediaAssociada.storagePathOriginal, mediaAssociada.tipo)?.url : undefined,
  });
  });

  // Assinaturas.
  const assinaturas: RpSig[] = signatures.map((s) => ({
    nome: s.nome,
    cargo: s.cargo,
    papel: s.papel,
    documentoMasc: s.documento ? maskDoc(s.documento) : undefined,
    url: urlOf(s.storagePath),
  }));

  // Indicadores (só > 0).
  const nApont = cardsRaw.length;
  const nPend = pendencias.length;
  const nCorr = pendencias.filter((p) => p.status === 'corrigida').length;
  const nFotos = media.length;
  const nDisp = contarDispositivos(answers);
  const ind: RpIndicador[] = [];
  if (nApont > 0) ind.push({ label: 'Apontamentos', valor: String(nApont) });
  if (nDisp > 0) ind.push({ label: 'Dispositivos', valor: String(nDisp) });
  if (nPend > 0) ind.push({ label: 'Pendências', valor: String(nPend) });
  if (nCorr > 0) ind.push({ label: 'Corrigidos', valor: String(nCorr) });
  if (nFotos > 0) ind.push({ label: 'Fotos', valor: String(nFotos) });

  // Status (derivado das pendências).
  const nAbertas = pendencias.filter((p) => p.status !== 'corrigida' && p.status !== 'cancelada').length;
  const status: RpStatus[] = [];
  const nReprovados = answers.filter((a) => /reprovado|\bnão\b|com falha/i.test(textoValor(a.valor) || '')).length;
  if (nCorr > 0) status.push({ label: 'Corrigidos', valor: nCorr, tone: 'ok' });
  if (nReprovados > 0) status.push({ label: 'Não conformes', valor: nReprovados, tone: 'warn' });
  if (nAbertas > 0) status.push({ label: 'Pendências', valor: nAbertas, tone: 'warn' });

  const razao = companyProfile?.razaoSocial || 'Fireowl Controls';
  const contatoFireowl = [companyProfile?.telefone, companyProfile?.email].filter((x) => x && x.trim()).join('  •  ');
  const contatoCliente = [cliente?.contacts?.[0]?.phone, cliente?.contacts?.[0]?.email].filter((x) => x && x.trim()).join('  •  ');
  // Nome fantasia do cliente extraído do "Razão (Fantasia)".
  const fantCliente = nomeFantasiaCliente(cliente?.name);

  const resumoTexto = typeof report.resumoExecucao === 'string' ? (report.resumoExecucao as string) : (report.resumoExecucao && (report.resumoExecucao as any).texto) || undefined;

  return {
    tipo: report.tipo,
    tituloDoc: tituloRelatorio(report.tipo),
    tipoLabel: TIPO_LABEL_REL[report.tipo] || report.tipo,
    numero: report.numero || report.id,
    nivel,
    clienteNome: cliente?.name || report.clienteId || '',
    clienteFantasia: fantCliente && fantCliente !== cliente?.name ? fantCliente : undefined,
    clienteCnpj: cliente?.cnpj,
    clienteEndereco: cliente?.address,
    clienteContato: contatoCliente || undefined,
    clienteLogoUrl: urlOf(cliente?.logoPath),
    local: report.local,
    tecnicoNome: report.tecnicoNome,
    responsavelTecnico: signatures.find((s) => s.papel === 'responsavel_tecnico')?.nome,
    dataInicio: report.iniciadoEm ? new Date(report.iniciadoEm).toLocaleString('pt-BR') : undefined,
    dataFim: report.finalizadoEm ? new Date(report.finalizadoEm).toLocaleString('pt-BR') : undefined,
    geoResumo: report.geoInicio || report.geoFim ? `Início: ${formatGeo(report.geoInicio)} · Fim: ${formatGeo(report.geoFim)}` : undefined,
    geoRegistrada: !!(report.geoInicio || report.geoFim),
    resumoTexto: resumoTexto && String(resumoTexto).trim() ? String(resumoTexto).trim() : undefined,
    conclusaoTexto: report.observacoesGerais && report.observacoesGerais.trim() ? report.observacoesGerais.trim() : undefined,
    indicadores: ind,
    status,
    secoes,
    respostasPorSecao: extrairRespostasPorSecao(report, answers),
    registroFotografico,
    pendencias: pends,
    assinaturas,
    razaoSocial: razao,
    fantasiaFireowl: companyProfile?.nomeFantasia,
    cnpjFireowl: companyProfile?.cnpj,
    contatoFireowl: contatoFireowl || undefined,
    logoFireowlUrl: undefined,
    capaImagemUrl: undefined,
  };
}

/** Orquestrador assíncrono: busca tudo, resolve imagens e monta o objeto. */
export async function montarReportPdfData(
  report: ReportInstance,
  cliente: Client | undefined,
  companyProfile: CompanyProfile | undefined,
  userRole: UserRole,
  nivel: ReportNivel = 'tecnico'
): Promise<ReportPdfData> {
  const [answers, media, signatures, pendencias] = await Promise.all([
    fetchAnswers(report.id),
    fetchMedia(report.id),
    fetchSignatures(report.id),
    fetchPendencias(userRole, { reportOrigemId: report.id }),
  ]);

  // Coleta todos os paths de imagem para resolver em lote.
  const paths: string[] = [];
  media.forEach((m) => { paths.push(m.storagePathOriginal); if (m.storagePathMarcado) paths.push(m.storagePathMarcado); });
  signatures.forEach((s) => { if (s.storagePath) paths.push(s.storagePath); });
  const logoFireowlPath = companyProfile?.logoPrincipalPath || companyProfile?.logoEscuroPath || companyProfile?.logoClaroPath;
  if (logoFireowlPath) paths.push(logoFireowlPath);
  // Capa: fachada do cliente (foto principal). Logo do cliente (discreto).
  if (cliente?.fachadaPath) paths.push(cliente.fachadaPath);
  if (cliente?.logoPath) paths.push(cliente.logoPath);

  const map = await resolveLogoDataUrls(paths);
  const urlOf = (p?: string) => (p ? map[p] : undefined);

  const data = assembleReportPdfData({ report, answers, media, signatures, pendencias, cliente, companyProfile, nivel, urlOf });
  data.logoFireowlUrl = urlOf(logoFireowlPath);
  // Capa: prioriza uma evidência do próprio atendimento; na ausência, usa a
  // fachada já cadastrada do cliente. Nunca inventa ou busca imagem externa.
  const evidenciaCapa = media.find((m) => m.tipo === 'geral' || m.tipo === 'evidencia') || media[0];
  data.capaImagemUrl = evidenciaCapa
    ? urlOf(evidenciaCapa.storagePathMarcado || evidenciaCapa.storagePathOriginal)
    : urlOf(cliente?.fachadaPath);
  return data;
}
