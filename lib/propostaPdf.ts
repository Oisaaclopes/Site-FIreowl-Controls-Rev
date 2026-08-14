import { PropostaPublica, assertSemVazamento } from './proposta';

/* Cores da spec (10.7) */
const NAVY = '#0B1E38';
const RED = '#C1272D';
const AMBER = '#F2A900';
const GREEN = '#2E7D5B';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

/** Monta o HTML da proposta a partir SOMENTE do objeto público (sem custo/margem). */
export function montarHtmlProposta(p: PropostaPublica, opts?: { mascararValor?: boolean }): string {
  const mascarar = !!opts?.mascararValor;
  const mostraQtd = p.regime === 'unitario';

  // 02 Escopo — agrupado por grupo, voz de ação
  const grupos = Array.from(new Set(p.escopo.map((l) => l.grupo)));
  const escopoHtml = grupos
    .map((g) => {
      const linhas = p.escopo
        .filter((l) => l.grupo === g)
        .map(
          (l) => `<tr>
            <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(l.descricao)}${l.local ? ` — ${esc(l.local)}` : ''}</td>
            ${mostraQtd ? `<td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;white-space:nowrap">${l.quantidade ?? ''} ${esc(l.unidade || '')}</td>` : ''}
            <td style="padding:5px 8px;border:1px solid #e2e8f0;color:${GREEN};font-size:10px">${esc(l.norma || '')}</td>
          </tr>`
        )
        .join('');
      return `<h4 style="color:${NAVY};margin:12px 0 4px">${esc(g)}</h4>
        <table style="border-collapse:collapse;width:100%;font-size:11px">
          <thead><tr>
            <th style="padding:5px 8px;border:1px solid #e2e8f0;background:${NAVY};color:#fff;text-align:left">Escopo</th>
            ${mostraQtd ? `<th style="padding:5px 8px;border:1px solid #e2e8f0;background:${NAVY};color:#fff">Qtd.</th>` : ''}
            <th style="padding:5px 8px;border:1px solid #e2e8f0;background:${NAVY};color:#fff;text-align:left">Referência</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>`;
    })
    .join('');

  const listHtml = (arr: string[]) =>
    `<ul style="margin:4px 0 0;padding-left:18px">${arr.map((x) => `<li style="font-size:11px;margin-bottom:2px">${esc(x)}</li>`).join('')}</ul>`;

  const matrizHtml = `<table style="border-collapse:collapse;width:100%;font-size:11px">
    <thead><tr>
      <th style="padding:5px 8px;border:1px solid #e2e8f0;background:${NAVY};color:#fff;text-align:left">Item</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0;background:${NAVY};color:#fff">Responsável</th>
    </tr></thead>
    <tbody>${p.matriz
      .map(
        (m) => `<tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(m.item)}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;color:${m.responsavel === 'Contratante' ? GREEN : NAVY};font-weight:700">${esc(m.responsavel)}</td>
        </tr>`
      )
      .join('')}</tbody></table>`;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fontFace = `
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
    @font-face{font-family:'Poppins';src:url('${origin}/fonts/Poppins-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
    @font-face{font-family:'Carlito';src:url('${origin}/fonts/Carlito-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
    @font-face{font-family:'Carlito';src:url('${origin}/fonts/Carlito-Bold.woff2') format('woff2');font-weight:700;font-display:swap}`;

  const sec = (n: string, titulo: string, corpo: string) =>
    `<section style="margin-top:16px;break-inside:avoid"><h3 style="color:${NAVY};border-bottom:2px solid ${AMBER};padding-bottom:3px">${n} ${esc(titulo)}</h3>${corpo}</section>`;

  // Ordem deliberada (10.6): escopo → exclusões → premissas → matriz → prazo → preço
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Proposta ${esc(p.numero)}</title>
    <style>
      ${fontFace}
      @page{size:A4;margin:16mm 12mm}
      body{font-family:'Carlito',Calibri,system-ui,Arial,sans-serif;color:#0f172a;margin:0}
      h1,h2,h3,h4,.num{font-family:'Poppins',system-ui,Arial,sans-serif;margin:0}
      thead{display:table-header-group}
      .aceite{break-inside:avoid}
    </style></head>
    <body onload="setTimeout(function(){window.print()},400)">
      <div style="border-bottom:4px solid ${RED};padding-bottom:8px;margin-bottom:6px">
        <div class="num" style="font-size:11px;color:${RED};font-weight:700">${esc(p.numero)}</div>
        <h1 style="color:${NAVY};text-transform:uppercase;font-size:20px">${esc(p.cliente)}</h1>
        <p style="font-size:12px;color:#556;margin:2px 0 0">Proposta Comercial · ${esc(p.data)} · Regime: ${esc(p.regime)}</p>
      </div>

      ${sec('01', 'Contexto', `<p style="font-size:11px">${esc(p.contexto || 'Proposta elaborada a partir de levantamento técnico em campo.')}</p>`)}
      ${sec('02', 'Escopo', escopoHtml || '<p style="font-size:11px;color:#888">Sem itens.</p>')}
      ${p.materiais.length ? sec('03', 'Materiais', `<ul style="margin:4px 0 0;padding-left:18px">${p.materiais.map((m) => `<li style="font-size:11px">${esc(m.descricao)}${mostraQtd && m.quantidade ? ` — ${m.quantidade} ${esc(m.unidade || '')}` : ''}</li>`).join('')}</ul>`) : ''}
      ${sec('04', 'Não incluído', listHtml(p.naoIncluido))}
      ${sec('05', 'Premissas', listHtml(p.premissas))}
      ${sec('06', 'Matriz de responsabilidades', matrizHtml)}
      ${sec('07', 'Prazo', `<p style="font-size:11px">Execução estimada em <b>${p.prazoDias ?? '—'}</b> dia(s)${p.tecnicos ? `, com equipe de <b>${p.tecnicos}</b> técnico(s)` : ''}.</p>`)}
      ${sec('08', 'Condições comerciais', `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:right">
          <span style="font-size:11px;color:#556">Valor total da proposta</span>
          <div class="num" style="font-size:24px;font-weight:700;color:${NAVY}">${mascarar ? 'R$ •••••••' : brl(p.precoVenda)}</div>
        </div>
        ${p.regime !== 'unitario' ? `<p style="font-size:10px;color:#888;margin-top:4px">Preço fechado por resultado. Quantitativos${p.regime === 'fechado_com_anexo' ? ' em anexo separado' : ''} não integram este documento; a delimitação de escopo e as premissas prevalecem.</p>` : ''}`)}
      ${sec('09', 'Garantia', `<p style="font-size:11px">${esc(p.garantia)}</p>`)}
      ${sec('10', 'Responsabilidade técnica', `<p style="font-size:11px">${esc(p.responsabilidadeTecnica)}</p>`)}
      <section class="aceite" style="margin-top:24px">
        <h3 style="color:${NAVY};border-bottom:2px solid ${AMBER};padding-bottom:3px">12 Aceite</h3>
        <p style="font-size:11px">Declaro ciência e aceite das condições desta proposta.</p>
        <div style="display:flex;gap:40px;margin-top:40px">
          <div style="flex:1;border-top:1px solid #333;text-align:center;font-size:10px;padding-top:4px">Contratante</div>
          <div style="flex:1;border-top:1px solid #333;text-align:center;font-size:10px;padding-top:4px">Fireowl Controls</div>
        </div>
      </section>
      <p style="font-size:9px;color:#aaa;margin-top:18px;text-align:center">Fireowl Controls Systems · ${esc(p.data)}</p>
    </body></html>`;
}

/** Gera e abre a proposta. GUARDA anti-vazamento: recusa abrir se detectar termo interno. */
export function gerarPdfProposta(p: PropostaPublica, opts?: { mascararValor?: boolean }): void {
  const html = montarHtmlProposta(p, opts);
  // Extrai o texto visível e barra qualquer vazamento antes de abrir (10.4).
  const texto = html.replace(/<[^>]+>/g, ' ');
  assertSemVazamento(texto); // lança se contingência/margem/custo unitário/criticidade/bdi aparecerem

  const w = window.open('', '_blank');
  if (!w) {
    alert('Permita pop-ups para gerar a proposta.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
}
