import { AcaoRecomendada, ReportTipo } from './types';

/* =====================================================================
 * Contrato de schema do motor de formulários (Fase 2).
 * Define o que é um template, uma seção e um campo. Tanto o renderer
 * (FormEngine) quanto os templates semeados obedecem a este contrato.
 * ===================================================================== */

export type FieldType =
  | 'texto'
  | 'numero'
  | 'data'
  | 'hora'
  | 'select'
  | 'multiselect'
  | 'select_catalogo' // grupos vêm da taxonomia Categoria > Subcategoria
  | 'autocomplete_catalogo' // busca em Estoque/Serviços, permite texto livre
  | 'select_interno' // ex.: criticidade — visível só a admin/gestor
  | 'passfail' // Aprovado/Reprovado (ou OK/Falha)
  | 'foto'
  | 'assinatura'
  | 'repeater'
  | 'checklist_dispositivos' // repeater gerado a partir do inventário devices
  | 'checklist_pendencias' // repeater gerado a partir das pendências aprovadas
  | 'select_falha'; // seletor do catálogo de falhas — preenche o card (grupo/descrição/ação/criticidade)

/** Sugestão para pré-abertura automática de pendência a partir da resposta. */
export interface PendenciaSugerida {
  grupo?: string;
  acao?: AcaoRecomendada;
  descricao?: string;
  norma?: string;
}

export interface FieldSchema {
  key: string;
  tipo: FieldType;
  label?: string;
  obrigatorio?: boolean;
  multilinha?: boolean;
  default?: unknown;
  /** Opções para select/multiselect/passfail. */
  opcoes?: string[];
  /** Origem do catálogo: 'categorias' | 'estoque_servicos' | 'marcas' ... */
  origem?: string;
  /** autocomplete_catalogo: permite gravar texto livre (marca precisa_cadastro_catalogo). */
  permite_texto_livre?: boolean;
  /** autocomplete_catalogo origem='modelos': filtra os modelos pela marca escolhida
   * em outro campo (irmão). Ex.: central_modelo.filtro_por = 'central_fabricante'. */
  filtro_por?: string;
  /** select_interno: perfis que enxergam o campo. Ex.: ['admin','gestor']. */
  visivel_para?: string[];
  /** Referência normativa fica no help text, nunca no corpo da pergunta. */
  help?: string;

  /* --- foto --- */
  /** foto: a quantidade/rotulagem é definida pelo template, nunca por toggle em tela. */
  config_por_template?: boolean;
  /** foto: número de fotos exigidas, ou rótulos ('antes','depois'). */
  fotos?: number | Array<'antes' | 'depois'>;

  /* --- repeater --- */
  botao_adicionar?: string;
  gera_pendencia?: boolean;
  card_schema?: FieldSchema[];

  /* --- pré-abertura de pendência --- */
  /** Valores desta resposta que disparam pendência (ex.: ['Não','Reprovado']). */
  abre_pendencia_se?: string[];
  pendencia_sugerida?: PendenciaSugerida;
}

export interface SectionSchema {
  key: string;
  titulo: string;
  descricao?: string;
  campos: FieldSchema[];
  /** Salto condicional: pula a seção quando `campo` == `igual` (ex.: "Não possui SDAI"). */
  pula_se?: { campo: string; igual: string };
}

export interface TemplateSchema {
  codigo: string;
  nome: string;
  tipo: ReportTipo;
  /** Disciplina: SDAI | CFTV | CONTROLE_ACESSO | BMS | ALARME. Default SDAI. */
  area?: string;
  secoes: SectionSchema[];
}

/** Valores do formulário. Campo repeater guarda um array de cards. */
export type FieldValue = unknown;
export type RepeaterCard = Record<string, FieldValue>;
export type FormValues = Record<string, FieldValue | RepeaterCard[]>;

/* ------------------------------- Regras ------------------------------- */

/** Uma resposta é "negativa" (dispara pendência) se estiver em abre_pendencia_se. */
export function isNegativeAnswer(field: FieldSchema, value: FieldValue): boolean {
  if (!field.abre_pendencia_se || field.abre_pendencia_se.length === 0) return false;
  if (Array.isArray(value)) return value.some((v) => field.abre_pendencia_se!.includes(String(v)));
  return field.abre_pendencia_se.includes(String(value));
}

/** Rótulos de foto exigidos por um campo/repeater (default: 1 foto sem rótulo). */
export function fotoLabels(field: FieldSchema): Array<'antes' | 'depois' | 'foto'> {
  if (Array.isArray(field.fotos)) return field.fotos;
  const n = typeof field.fotos === 'number' ? field.fotos : 1;
  return Array.from({ length: Math.max(1, n) }, () => 'foto' as const);
}

/** Campo interno visível apenas a certos perfis (criticidade_operacional). */
export function isFieldVisibleForRole(field: FieldSchema, role: string): boolean {
  if (field.tipo !== 'select_interno' && !field.visivel_para) return true;
  if (!field.visivel_para) return true;
  const r = role.toLowerCase();
  return field.visivel_para.some((p) => r.includes(p.toLowerCase()));
}

export interface FinalizeIssue {
  secao: string;
  campo: string;
  motivo: string;
}

/**
 * Valida a finalização. Regra transversal 2: todo apontamento que gera
 * pendência precisa de ao menos uma foto; campos obrigatórios preenchidos.
 * `hasPhoto(cardKey, cardIndex)` informa se o card do repeater tem foto.
 */
export function validateFinalize(
  template: TemplateSchema,
  values: FormValues,
  hasPhoto: (fieldKey: string, cardIndex?: number) => boolean
): FinalizeIssue[] {
  const issues: FinalizeIssue[] = [];
  for (const secao of template.secoes) {
    if (secao.pula_se && String(values[secao.pula_se.campo]) === secao.pula_se.igual) {
      continue;
    }
    for (const field of secao.campos) {
      const v = values[field.key];
      if (field.obrigatorio && (v === undefined || v === null || v === '')) {
        issues.push({ secao: secao.titulo, campo: field.label || field.key, motivo: 'Campo obrigatório não preenchido.' });
      }
      if (field.tipo === 'foto' && field.obrigatorio) {
        if (!hasPhoto(field.key)) {
          issues.push({
            secao: secao.titulo,
            campo: field.label || field.key,
            motivo: 'Foto obrigatória não anexada.',
          });
        }
      }
      if (field.tipo === 'repeater') {
        const cards = Array.isArray(v) ? (v as RepeaterCard[]) : [];
        // Foto exigida por card quando: gera pendência (apontamento) OU o card
        // tem um campo foto marcado obrigatório (ex.: Corretiva antes/depois).
        const fotoObrigatoria =
          !!field.gera_pendencia ||
          (field.card_schema || []).some((cf) => cf.tipo === 'foto' && cf.obrigatorio);
        if (fotoObrigatoria) {
          cards.forEach((_, i) => {
            if (!hasPhoto(field.key, i)) {
              issues.push({
                secao: secao.titulo,
                campo: `${field.label || field.key} #${i + 1}`,
                motivo: field.gera_pendencia
                  ? 'Apontamento sem foto — foto é obrigatória para sustentar a pendência.'
                  : 'Foto obrigatória não anexada neste item.',
              });
            }
          });
        }
      }
      if (field.tipo === 'checklist_dispositivos' || field.tipo === 'checklist_pendencias') {
        // No checklist a foto só é exigida no card que reprovou (qualquer campo
        // com abre_pendencia_se disparado) — evita travar o relatório inteiro.
        const cards = Array.isArray(v) ? (v as RepeaterCard[]) : [];
        const schema = field.card_schema || [];
        cards.forEach((c, i) => {
          const reprovou = schema.some((cf) => isNegativeAnswer(cf, c[cf.key]));
          if (reprovou && !hasPhoto(field.key, i)) {
            issues.push({
              secao: secao.titulo,
              campo: `${(c.dispositivo as string) || (c.pendencia as string) || field.label || field.key} #${i + 1}`,
              motivo: 'Item reprovado/não corrigido sem foto — foto é obrigatória para sustentar a evidência.',
            });
          }
        });
      }
    }
  }
  return issues;
}

