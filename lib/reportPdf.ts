import { showToast } from '@/components/ui/Feedback';
import { ReportInstance, UserRole, Pendencia } from './types';
import { fetchAnswers, fetchBandeja } from './reports';
import { fetchSignatures } from './signatures';
import { fetchPendencias } from './pendencias';
import { signedReportUrls, isStoragePath } from './reportMedia';
import { formatGeo } from './geo';

/* Cores da spec (Parte 10.7) */
const NAVY = '#0B1E38';
const RED = '#C1272D';
const AMBER = '#F2A900';
const GREEN = '#2E7D5B';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const maskDoc = (d?: string) => {
  const s = (d || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length < 5) return '•••';
  return `${digits.slice(0, 3)}.•••.•••-${digits.slice(-2)}`;
};

/** Coleta caminhos de Storage referenciados num valor de resposta. */
function collectPaths(v: unknown, out: string[]) {
  if (!Array.isArray(v)) return;
  v.forEach((item) => {
    if (isStoragePath(item)) out.push(item);
    else if (item && typeof item === 'object') {
      Object.values(item as Record<string, unknown>).forEach((val) => {
        if (Array.isArray(val)) val.forEach((x) => { if (isStoragePath(x)) out.push(x); });
      });
    }
  });
}

interface CardLike {
  grupo?: string;
  descricao?: string;
  local?: string;
  acao?: string;
  item?: string;
  quantidade?: unknown;
  unidade?: string;
  foto?: string[];
}

/** Extrai os cards de apontamento/serviço das respostas repeater. */
function extractCards(answers: { valor: unknown }[]): CardLike[] {
  const cards: CardLike[] = [];
  answers.forEach((a) => {
    if (!Array.isArray(a.valor)) return;
    a.valor.forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const c = item as Record<string, unknown>;
        if (c.descricao || c.grupo || c.item) {
          cards.push({
            grupo: (c.grupo as string) || 'Geral',
            descricao: c.descricao as string,
            local: c.local as string,
            acao: (c.acao_executada as string) || (c.acao_recomendada as string),
            item: c.item as string,
            quantidade: c.quantidade,
            unidade: c.unidade as string,
            foto: Array.isArray(c.foto) ? (c.foto as unknown[]).filter(isStoragePath) as string[] : [],
          });
        }
      }
    });
  });
  return cards;
}

/**
 * Gera o PDF de execução (Parte 12): agrupado por grupo, antes/depois lado a
 * lado, SEM valor em R$ e SEM criticidade. Abre em janela nova para imprimir.
 */
export async function gerarPdfExecucao(
  report: ReportInstance,
  clienteNome: string,
  userRole: UserRole
): Promise<void> {
  const [answers, signatures, pendAll, bandeja] = await Promise.all([
    fetchAnswers(report.id),
    fetchSignatures(report.id),
    fetchPendencias(userRole, { reportOrigemId: report.id }),
    fetchBandeja(report.id),
  ]);
  const pendencias: Pendencia[] = pendAll;

  const paths: string[] = [];
  answers.forEach((a) => collectPaths(a.valor, paths));
  bandeja.forEach((m) => {
    paths.push(m.storagePathOriginal);
    if (m.storagePathMarcado) paths.push(m.storagePathMarcado);
  });
  signatures.forEach((s) => { if (s.storagePath) paths.push(s.storagePath); });
  const urlMap = await signedReportUrls(paths);
  // Mapa original -> versão marcada (setas/círculos). A foto do apontamento é
  // guardada pelo caminho original; na exibição preferimos a marcada.
  const markedOf: Record<string, string> = {};
  bandeja.forEach((m) => { if (m.storagePathMarcado) markedOf[m.storagePathOriginal] = m.storagePathMarcado; });
  const url = (p?: string) => (p && urlMap[p]) || '';
  // URL de exibição de uma foto: usa a marcada quando existir.
  const display = (p?: string) => url(p && markedOf[p] ? markedOf[p] : p);

  const cards = extractCards(answers);
  const grupos = Array.from(new Set(cards.map((c) => c.grupo || 'Geral')));

  // Fotos já exibidas nos cards de apontamento/serviço — não repetir no geral.
  const classifiedPaths = new Set<string>();
  cards.forEach((c) => (c.foto || []).forEach((p) => classifiedPaths.add(p)));
  const bandejaGeral = bandeja.filter((m) => !classifiedPaths.has(m.storagePathOriginal));

  const fotoGrid = (fotos: string[]) =>
    fotos.length === 0
      ? ''
      : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${fotos
          .map((p) => `<img src="${esc(display(p))}" style="width:150px;height:110px;object-fit:cover;border:1px solid #ddd;border-radius:4px" />`)
          .join('')}</div>`;

  const servicosHtml = grupos
    .map((g) => {
      const doGrupo = cards.filter((c) => (c.grupo || 'Geral') === g);
      const linhas = doGrupo
        .map((c) => {
          const antesDepois =
            c.foto && c.foto.length === 2
              ? `<div style="display:flex;gap:8px;margin-top:6px">
                   <div><div style="font-size:9px;color:#888">ANTES</div><img src="${esc(display(c.foto[0]))}" style="width:170px;height:120px;object-fit:cover;border:1px solid #ddd;border-radius:4px" /></div>
                   <div><div style="font-size:9px;color:#888">DEPOIS</div><img src="${esc(display(c.foto[1]))}" style="width:170px;height:120px;object-fit:cover;border:1px solid #ddd;border-radius:4px" /></div>
                 </div>`
              : fotoGrid(c.foto || []);
          const qtd = c.quantidade ? `${esc(c.quantidade)} ${esc(c.unidade || '')}` : '';
          return `<div style="border:1px solid #eee;border-radius:6px;padding:8px 10px;margin-bottom:8px;break-inside:avoid">
            <div style="font-weight:700;color:${NAVY}">${esc(c.item || c.descricao || 'Item')}</div>
            <div style="font-size:11px;color:#334">${esc(c.descricao || '')}</div>
            <div style="font-size:10px;color:#667;margin-top:2px">${c.local ? 'Local: ' + esc(c.local) + ' · ' : ''}${c.acao ? 'Ação: ' + esc(c.acao) + ' · ' : ''}${qtd}</div>
            ${antesDepois}
          </div>`;
        })
        .join('');
      return `<h3 style="color:${NAVY};border-bottom:2px solid ${AMBER};padding-bottom:3px;margin:14px 0 8px">${esc(g)}</h3>${linhas}`;
    })
    .join('');

  const pendHtml =
    pendencias.length === 0
      ? '<p style="font-size:11px;color:#888">Sem pendências identificadas.</p>'
      : pendencias
          .map(
            (p) => `<div style="border-left:3px solid ${RED};padding:4px 10px;margin-bottom:8px;break-inside:avoid">
              <div style="font-weight:700;color:${NAVY}">${esc(p.grupo || 'Pendência')}${p.local ? ' — ' + esc(p.local) : ''}</div>
              <div style="font-size:11px;color:#334">${esc(p.descricao || '')}</div>
              ${p.normaReferencia ? `<div style="font-size:10px;color:${GREEN}">Fundamentação: ${esc(p.normaReferencia)}</div>` : ''}
            </div>`
          )
          .join('');

  const bandejaHtml =
    bandejaGeral.length === 0
      ? ''
      : `<h2 style="color:${NAVY};margin-top:18px">Registro Fotográfico Geral</h2>
         <div style="display:flex;flex-wrap:wrap;gap:6px">${bandejaGeral
           .map((m) => `<img src="${esc(display(m.storagePathOriginal))}" style="width:150px;height:110px;object-fit:cover;border:1px solid #ddd;border-radius:4px" />`)
           .join('')}</div>`;

  const assinaturasHtml =
    signatures.length === 0
      ? '<p style="font-size:11px;color:#888">Sem assinaturas.</p>'
      : `<div style="display:flex;flex-wrap:wrap;gap:16px">${signatures
          .map(
            (s) => `<div style="text-align:center;break-inside:avoid">
              ${s.storagePath ? `<img src="${esc(url(s.storagePath))}" style="width:200px;height:80px;object-fit:contain;border-bottom:1px solid #333" />` : '<div style="width:200px;height:80px;border-bottom:1px solid #333"></div>'}
              <div style="font-size:11px;font-weight:700;margin-top:4px">${esc(s.nome)}</div>
              <div style="font-size:10px;color:#667">${esc(s.cargo || '')}${s.documento ? ' · ' + esc(maskDoc(s.documento)) : ''}</div>
              <div style="font-size:9px;color:#999;text-transform:uppercase">${esc(s.papel)}</div>
            </div>`
          )
          .join('')}</div>`;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fontFace = `
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
    @font-face{font-family:'Carlito';src:url('${origin}/fonts/Carlito-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:'Carlito';src:url('${origin}/fonts/Carlito-Bold.woff2') format('woff2');font-weight:700;font-display:swap}`;

  const dataFim = report.finalizadoEm ? new Date(report.finalizadoEm).toLocaleString('pt-BR') : '—';

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${esc(report.numero || report.id)} — Relatório de Execução</title>
    <style>
      ${fontFace}
      @page { size: A4; margin: 16mm 12mm; }
      body{font-family:'Carlito',Calibri,system-ui,Arial,sans-serif;color:#0f172a;margin:0}
      h1,h2,h3{font-family:'Poppins',system-ui,Arial,sans-serif;margin:0}
      thead{display:table-header-group}
      .cab{border-bottom:4px solid ${RED};padding-bottom:8px;margin-bottom:14px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:11px;margin-top:6px}
      .sig{break-inside:avoid}
    </style></head>
    <body onload="setTimeout(function(){window.print()},600)">
      <div class="cab">
        <div style="font-family:'Poppins';font-size:11px;color:${RED};font-weight:700">${esc(report.numero || report.id)}</div>
        <h1 style="color:${NAVY};text-transform:uppercase;font-size:20px">${esc(clienteNome || '')}</h1>
        <p style="font-size:12px;color:#556;margin:2px 0 0">Relatório de Execução — ${esc(report.tipo)}</p>
        <div class="grid">
          <div><b>Técnico:</b> ${esc(report.tecnicoNome || '—')}</div>
          <div><b>Data:</b> ${esc(dataFim)}</div>
          ${report.local ? `<div><b>Local:</b> ${esc(report.local)}</div>` : ''}
          ${report.numero ? `<div><b>Nº do relatório:</b> ${esc(report.numero)}</div>` : ''}
        </div>
      </div>

      <h2 style="color:${NAVY}">Serviços Executados / Apontamentos</h2>
      ${servicosHtml || '<p style="font-size:11px;color:#888">Sem itens registrados.</p>'}

      <h2 style="color:${NAVY};margin-top:18px">Pendências Identificadas</h2>
      ${pendHtml}

      ${bandejaHtml}

      <h2 style="color:${NAVY};margin-top:18px">Encerramento</h2>
      <div class="grid" style="margin-bottom:12px">
        <div><b>Geo abertura:</b> ${esc(formatGeo(report.geoInicio))}</div>
        <div><b>Geo fechamento:</b> ${esc(formatGeo(report.geoFim))}</div>
      </div>
      <p style="font-size:9px;color:#999;margin:0 0 10px">Coordenadas com precisão declarada, como evidência indiciária — não constituem prova categórica de presença.</p>
      <div class="sig">${assinaturasHtml}</div>

      <p style="font-size:9px;color:#aaa;margin-top:18px;text-align:center">Fireowl Controls Systems · Documento gerado em ${esc(new Date().toLocaleString('pt-BR'))}</p>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    showToast('Permita pop-ups para gerar o PDF.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
}
