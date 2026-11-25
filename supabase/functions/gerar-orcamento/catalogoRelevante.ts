// Filtro do cadastro de produtos ANTES de chamar a IA (Fase 1.1 — custo).
// Em vez de mandar o estoque inteiro, manda só o que o texto cita (modelo ou
// código do fornecedor) mais as variantes da mesma família (ex.: citar
// "IVP 8000 EX" traz também IVP 8000 PET, MW PET…), para a IA não confundir
// modelos parecidos. Módulo PURO: usado pela Edge Function e testado no Vitest.
// A tela ainda confere cada produto contra o estoque COMPLETO antes de gravar
// (resolverAcoesProdutos), então um produto fora do recorte nunca é duplicado.

export interface ProdutoCatalogo {
  id: string;
  model?: string | null;
  name?: string | null;
  notes?: string | null;
}

const normalizar = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const compacto = (s?: string | null) => normalizar(s).replace(/[^A-Z0-9]/g, '');

/** Prefixo de família: as duas primeiras "palavras" do modelo (ex.: IVP 8000 EX → IVP8000). */
function familia(model?: string | null): string {
  const partes = normalizar(model).split(/[^A-Z0-9]+/).filter(Boolean);
  const f = partes.slice(0, 2).join('');
  return f.length >= 4 ? f : '';
}

export interface RecorteCatalogo<T> {
  produtos: T[];
  /** true = nenhum produto citado foi reconhecido; mandou o cadastro inteiro. */
  completo: boolean;
}

export function catalogoRelevante<T extends ProdutoCatalogo>(produtos: T[], texto: string, limite = 120): RecorteCatalogo<T> {
  const textoCompacto = compacto(texto);
  const codigos = new Set((texto.match(/\d{5,}/g) || []));
  const citados = produtos.filter((p) => {
    const k = compacto(p.model);
    if (k.length >= 4 && textoCompacto.includes(k)) return true;
    const notas = p.notes || '';
    for (const c of codigos) if (notas.includes(c)) return true;
    return false;
  });
  if (!citados.length) return { produtos, completo: true };

  const familias = new Set(citados.map((p) => familia(p.model)).filter(Boolean));
  const ids = new Set(citados.map((p) => p.id));
  const recorte = [...citados];
  for (const p of produtos) {
    if (recorte.length >= limite) break;
    if (ids.has(p.id)) continue;
    const f = familia(p.model);
    if (f && familias.has(f)) { recorte.push(p); ids.add(p.id); }
  }
  return { produtos: recorte, completo: false };
}
