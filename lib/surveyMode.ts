import { SectionSchema, TemplateSchema } from './reportSchema';

export type SurveyMode = 'pontual' | 'parcial' | 'completo';

export const SURVEY_MODE_KEY = 'tipo_levantamento';
export const SURVEY_BLOCKS_KEY = 'blocos_levantamento';

export const surveyBlockSections = (template: TemplateSchema): SectionSchema[] =>
  template.secoes.filter((section) => !['apontamentos', 'necessidades', 'encerramento'].includes(section.key));

const supportingSections = (template: TemplateSchema): SectionSchema[] =>
  template.secoes.filter((section) => ['apontamentos', 'necessidades', 'encerramento'].includes(section.key));

const withoutHiddenRequirements = (section: SectionSchema): SectionSchema => ({
  ...section,
  campos: section.campos.map((field) => ({ ...field, obrigatorio: false })),
});

const pointSection = (): SectionSchema => ({
  key: 'registro_pontual',
  titulo: 'Registro pontual',
  descricao: 'Registre somente o que foi observado. Marque como não verificado quando não houver evidência suficiente.',
  campos: [
    { key: 'fotos_pontuais', tipo: 'foto', label: 'Evidências do local', fotos: 6 },
    {
      key: 'constatacoes_pontuais',
      tipo: 'multiselect',
      label: 'Constatações',
      opcoes: ['Falha ativa', 'Equipamento danificado', 'Infraestrutura inadequada', 'Cobertura insuficiente', 'Necessita medição', 'Necessita orçamento', 'Sem anomalia aparente'],
    },
    { key: 'observacao_pontual', tipo: 'texto', label: 'Observação técnica', multilinha: true },
    { key: 'verificacao_pontual', tipo: 'select', label: 'Nível de verificação', opcoes: ['Verificado no local', 'Verificação parcial', 'Não verificado'] },
  ],
});

export function buildSurveyTemplate(
  template: TemplateSchema,
  mode: SurveyMode,
  selectedBlocks: string[] = []
): TemplateSchema {
  if (mode === 'completo') return template;

  const support = supportingSections(template).map(withoutHiddenRequirements);
  if (mode === 'pontual') return { ...template, secoes: [pointSection(), ...support] };

  const selected = new Set(selectedBlocks);
  return {
    ...template,
    secoes: [
      ...surveyBlockSections(template).filter((section) => selected.has(section.key)).map(withoutHiddenRequirements),
      ...support,
    ],
  };
}

