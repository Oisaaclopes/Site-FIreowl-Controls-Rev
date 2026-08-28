import { TemplateSchema, FieldSchema } from './reportSchema';
import { upsertTemplate } from './reportTemplates';

/* =====================================================================
 * Templates dos Relatórios Técnicos (seções 4, 5 e 6 do documento),
 * codificados conforme o contrato de reportSchema.ts.
 * ===================================================================== */

const ACOES = [
  'substituir', 'instalar', 'reposicionar', 'reparar',
  'limpar', 'desobstruir', 'reprogramar', 'investigar',
];

const CRITICIDADE_FIELD: FieldSchema = {
  key: 'criticidade_operacional',
  tipo: 'select_interno',
  label: 'Criticidade (interno)',
  visivel_para: ['admin', 'gestor'],
  opcoes: ['1 - pode aguardar', '2 - programar', '3 - executar com urgência'],
  help: 'Uso interno para ordenar escopo e dimensionar a visita. Nunca aparece no PDF do cliente.',
};

/** Card de apontamento (seção 3 do documento). `fotos` define a config por template;
 * `area` liga o seletor de falhas padrão à disciplina (SDAI, CFTV, ...). */
function apontamentosRepeater(fotos: number | Array<'antes' | 'depois'>, area = 'SDAI'): FieldSchema {
  return {
    key: 'apontamentos',
    tipo: 'repeater',
    label: 'Apontamentos',
    botao_adicionar: '+ Adicionar apontamento',
    gera_pendencia: true,
    card_schema: [
      { key: 'falha_padrao', tipo: 'select_falha', origem: area, label: 'Falha padrão (preenchimento rápido)' },
      { key: 'grupo', tipo: 'select_catalogo', origem: 'categorias', label: 'Grupo', obrigatorio: true },
      { key: 'item', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Item / material', permite_texto_livre: true },
      { key: 'local', tipo: 'texto', label: 'Local', obrigatorio: true },
      { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 },
      { key: 'descricao', tipo: 'texto', label: 'Descrição', multilinha: true, obrigatorio: true },
      { key: 'acao_recomendada', tipo: 'select', label: 'Ação recomendada', opcoes: ACOES, obrigatorio: true },
      CRITICIDADE_FIELD,
      { key: 'foto', tipo: 'foto', label: 'Foto', config_por_template: true, fotos },
    ],
  };
}

/* ----------------------- LEVANTAMENTO TÉCNICO ----------------------- */

export const LEVANTAMENTO_SDAI: TemplateSchema = {
  codigo: 'LEVANTAMENTO_SDAI',
  nome: 'Levantamento SDAI (Orçamento)',
  area: 'SDAI',
  tipo: 'LEVANTAMENTO',
  secoes: [
    {
      key: 'identificacao',
      titulo: 'Identificação do Sistema Existente',
      campos: [
        { key: 'possui_sdai', tipo: 'select', label: 'O local possui SDAI instalado?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
        { key: 'central_fabricante', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Fabricante da central', permite_texto_livre: true },
        { key: 'central_modelo', tipo: 'autocomplete_catalogo', origem: 'modelos', label: 'Modelo da central', permite_texto_livre: true, filtro_por: 'central_fabricante' },
        { key: 'tipo_central', tipo: 'select', label: 'Tipo de central', opcoes: ['Convencional', 'Endereçável', 'Não identificado'] },
        { key: 'qtd_lacos', tipo: 'numero', label: 'Quantidade de laços/zonas' },
        { key: 'central_operante', tipo: 'select', label: 'A central está operante no momento da visita?', opcoes: ['Sim', 'Sim, com falhas ativas', 'Não', 'Não foi possível acessar'], abre_pendencia_se: ['Não', 'Sim, com falhas ativas'], pendencia_sugerida: { grupo: 'SDAI > Central', acao: 'reparar', descricao: 'Central com falha ativa / inoperante na visita.' } },
        { key: 'projeto_disponivel', tipo: 'select', label: 'Existe projeto ou as-built disponível?', opcoes: ['Sim, atualizado', 'Sim, desatualizado', 'Não existe'] },
        { key: 'foto_painel', tipo: 'foto', label: 'Foto do painel e etiqueta de identificação', obrigatorio: true },
      ],
    },
    {
      key: 'quantitativo',
      titulo: 'Levantamento Quantitativo do Existente',
      descricao: 'Alimenta o BOM da proposta e o dimensionamento de horas técnicas.',
      pula_se: { campo: 'possui_sdai', igual: 'Não possui' },
      campos: [
        {
          key: 'dispositivos',
          tipo: 'repeater',
          label: 'Dispositivos',
          botao_adicionar: '+ Adicionar dispositivo',
          card_schema: [
            { key: 'dispositivo', tipo: 'select', label: 'Dispositivo', obrigatorio: true, opcoes: ['Detector óptico de fumaça', 'Detector de temperatura / termovelocimétrico', 'Detector linear (barreira)', 'Acionador manual', 'Sirene audiovisual', 'Módulo isolador', 'Módulo de comando / relé', 'Repetidor'] },
            { key: 'existente', tipo: 'numero', label: 'Qtd. existente' },
            { key: 'operante', tipo: 'numero', label: 'Qtd. operante' },
            { key: 'substituir', tipo: 'numero', label: 'Qtd. a substituir' },
            { key: 'observacao', tipo: 'texto', label: 'Observação' },
            { key: 'foto', tipo: 'foto', label: 'Foto', fotos: 1 },
          ],
        },
      ],
    },
    {
      key: 'cobertura',
      titulo: 'Cobertura',
      pula_se: { campo: 'possui_sdai', igual: 'Não possui' },
      campos: [
        { key: 'ambiente_sem_deteccao', tipo: 'select', label: 'Existe ambiente sem nenhum dispositivo de detecção?', opcoes: ['Sim', 'Não'], abre_pendencia_se: ['Sim'], pendencia_sugerida: { grupo: 'SDAI > Cobertura', acao: 'instalar', descricao: 'Ambiente sem cobertura de detecção.', norma: 'NBR 17240' } },
        {
          key: 'ambientes_sem_deteccao', tipo: 'repeater', label: 'Quais ambientes', botao_adicionar: '+ Adicionar ambiente',
          card_schema: [
            { key: 'ambiente', tipo: 'texto', label: 'Ambiente' },
            { key: 'area_m2', tipo: 'numero', label: 'Área aprox. (m²)' },
            { key: 'pe_direito', tipo: 'numero', label: 'Pé-direito (m)' },
            { key: 'tipo_detector', tipo: 'texto', label: 'Detector indicado' },
          ],
        },
        { key: 'qtd_insuficiente', tipo: 'select', label: 'Há ambiente com quantidade insuficiente de detectores?', opcoes: ['Sim', 'Não'], abre_pendencia_se: ['Sim'], pendencia_sugerida: { grupo: 'SDAI > Cobertura', acao: 'instalar' } },
        { key: 'motivo_insuficiente', tipo: 'multiselect', label: 'Motivo', opcoes: ['Área por detector acima do limite', 'Vigas profundas', 'Pé-direito elevado', 'Layout alterado após instalação', 'Outro'] },
        { key: 'acionador_acessivel', tipo: 'select', label: 'Todos os pavimentos possuem acionador manual acessível?', opcoes: ['Sim', 'Não', 'Pavimento único'], abre_pendencia_se: ['Não'], pendencia_sugerida: { grupo: 'SDAI > Acionamento', acao: 'instalar' } },
        { key: 'audiovisual_cobre', tipo: 'select', label: 'A sinalização audiovisual cobre toda a área ocupada?', opcoes: ['Sim', 'Não', 'Não avaliado'], abre_pendencia_se: ['Não'], pendencia_sugerida: { grupo: 'SDAI > Sinalização', acao: 'instalar' } },
      ],
    },
    {
      key: 'infraestrutura',
      titulo: 'Infraestrutura',
      pula_se: { campo: 'possui_sdai', igual: 'Não possui' },
      campos: [
        { key: 'infra_aproveitavel', tipo: 'select', label: 'Existe infraestrutura de eletrodutos aproveitável?', opcoes: ['Sim, integralmente', 'Sim, parcialmente', 'Não', 'Não avaliável'] },
        { key: 'material_eletroduto', tipo: 'multiselect', label: 'Material do eletroduto', opcoes: ['Aço galvanizado', 'PVC antichama vermelho', 'PVC comum', 'Eletrocalha', 'Aparente sem proteção', 'Misto'] },
        { key: 'uso_exclusivo', tipo: 'select', label: 'A tubulação é de uso exclusivo do SDAI?', opcoes: ['Sim', 'Não', 'Não identificado'], abre_pendencia_se: ['Não'] },
        { key: 'identificacao_vermelho', tipo: 'select', label: 'Identificação em vermelho presente?', opcoes: ['Sim', 'Parcial', 'Não'], abre_pendencia_se: ['Não', 'Parcial'] },
        { key: 'situacoes_cabeamento', tipo: 'multiselect', label: 'Situações identificadas no cabeamento', opcoes: ['Emenda fora de caixa', 'Cabo junto com força', 'Cabo exposto sem fixação', 'Cabo danificado', 'Bitola inadequada', 'Nenhuma'] },
        { key: 'disjuntor_exclusivo', tipo: 'select', label: 'Existe disjuntor exclusivo e identificado para o SDAI?', opcoes: ['Sim', 'Existe, sem identificação', 'Não existe', 'Não localizado'], abre_pendencia_se: ['Não existe', 'Existe, sem identificação'], pendencia_sugerida: { grupo: 'SDAI > Alimentação', acao: 'instalar', norma: 'NBR 17240 item 6.10.3' } },
        { key: 'metragem_infra_nova', tipo: 'numero', label: 'Metragem estimada de infraestrutura nova (m)' },
        { key: 'fotos_infra', tipo: 'foto', label: 'Fotos da infraestrutura', fotos: 4 },
      ],
    },
    {
      key: 'logistica',
      titulo: 'Condições de Execução e Logística',
      descricao: 'Alimenta a calculadora de custo. O técnico informa quantidade, nunca valor.',
      campos: [
        { key: 'distancia_km', tipo: 'numero', label: 'Distância da base até o local (km)' },
        { key: 'pedagio', tipo: 'select', label: 'Há pedágio na rota?', opcoes: ['Sim', 'Não'] },
        { key: 'hospedagem', tipo: 'select', label: 'Necessita hospedagem?', opcoes: ['Sim', 'Não'] },
        { key: 'dias_execucao', tipo: 'numero', label: 'Dias estimados de execução' },
        { key: 'qtd_tecnicos', tipo: 'numero', label: 'Quantidade de técnicos necessária' },
        { key: 'horario_permitido', tipo: 'multiselect', label: 'Horário permitido para execução', opcoes: ['Comercial', 'Noturno', 'Madrugada', 'Fim de semana', 'Sem restrição'] },
        { key: 'acesso_altura', tipo: 'multiselect', label: 'Necessita equipamento de acesso em altura?', opcoes: ['Escada', 'Andaime', 'Plataforma elevatória', 'Não necessita'] },
        { key: 'pe_direito', tipo: 'numero', label: 'Pé-direito predominante (m)' },
        { key: 'restricoes_acesso', tipo: 'multiselect', label: 'Restrições de acesso', opcoes: ['Área com operação contínua', 'Necessita liberação prévia', 'Câmara fria', 'Área classificada', 'Nenhuma'] },
        { key: 'desligamento_programado', tipo: 'select', label: 'Necessita desligamento programado?', opcoes: ['Sim', 'Não'] },
        { key: 'obs_logistica', tipo: 'texto', label: 'Observações de logística', multilinha: true },
      ],
    },
    {
      key: 'apontamentos',
      titulo: 'Apontamentos',
      descricao: 'Itens negativos das seções anteriores pré-abrem apontamentos automaticamente.',
      campos: [apontamentosRepeater(1)],
    },
    {
      key: 'necessidades', titulo: 'Necessidades para Orçamento', descricao: 'Registre quantidades técnicas. Isto não baixa nem reserva estoque.', campos: [
        { key: 'materiais_necessarios', tipo: 'repeater', label: 'Materiais necessários', botao_adicionar: '+ Adicionar material', card_schema: [
          { key: 'item', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Material', permite_texto_livre: true }, { key: 'marca', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Marca' }, { key: 'modelo', tipo: 'texto', label: 'Modelo' }, { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 }, { key: 'unidade', tipo: 'texto', label: 'Unidade' }, { key: 'source_label', tipo: 'texto', label: 'Origem técnica' }, { key: 'observacao', tipo: 'texto', label: 'Observação' },
        ] },
        { key: 'servicos_necessarios', tipo: 'repeater', label: 'Serviços necessários', botao_adicionar: '+ Adicionar serviço', card_schema: [
          { key: 'servico', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Serviço', permite_texto_livre: true }, { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 }, { key: 'unidade', tipo: 'texto', label: 'Unidade' }, { key: 'source_label', tipo: 'texto', label: 'Origem técnica' }, { key: 'observacao', tipo: 'texto', label: 'Observação' },
        ] },
        { key: 'medicoes', tipo: 'repeater', label: 'Medições', botao_adicionar: '+ Adicionar medição', card_schema: [
          { key: 'categoria', tipo: 'select', label: 'Tipo', opcoes: ['Cabo', 'Eletroduto', 'Canaleta', 'Fibra', 'UTP', 'Percurso', 'Altura', 'Distância', 'Outro'] }, { key: 'descricao', tipo: 'texto', label: 'Descrição' }, { key: 'quantidade', tipo: 'numero', label: 'Quantidade' }, { key: 'unidade', tipo: 'texto', label: 'Unidade' }, { key: 'local', tipo: 'texto', label: 'Local' }, { key: 'incluir_no_pedido', tipo: 'select', label: 'Incluir no pedido?', opcoes: ['Sim', 'Não'] },
        ] },
      ]
    },
    {
      key: 'encerramento',
      titulo: 'Encerramento',
      campos: [
        { key: 'escopo_cliente', tipo: 'texto', label: 'Escopo pretendido pelo cliente', multilinha: true },
        { key: 'prazo_cliente', tipo: 'data', label: 'Prazo desejado pelo cliente' },
        { key: 'contato_local', tipo: 'texto', label: 'Contato técnico no local (nome, cargo, telefone)' },
        { key: 'fotos_gerais', tipo: 'foto', label: 'Fotos gerais do ambiente', fotos: 6 },
        { key: 'assinatura', tipo: 'assinatura', label: 'Assinatura do responsável no local (opcional)' },
      ],
    },
  ],
};

/* ------------------------- MANUTENÇÃO CORRETIVA ------------------------- */

export const CORRETIVA_SDAI: TemplateSchema = {
  codigo: 'CORRETIVA_SDAI',
  nome: 'Corretiva SDAI',
  area: 'SDAI',
  tipo: 'CORRETIVA',
  secoes: [
    {
      key: 'chamado',
      titulo: 'Chamado',
      campos: [
        { key: 'origem_chamado', tipo: 'select', label: 'Origem do chamado', opcoes: ['Solicitação do cliente', 'Pendência de preventiva', 'Pendência de levantamento', 'Falha detectada em monitoramento'] },
        {
          key: 'pendencias_aprovadas', tipo: 'checklist_pendencias', label: 'Pendências aprovadas (verificar cada uma)', botao_adicionar: '+ Adicionar pendência',
          card_schema: [
            { key: 'pendencia', tipo: 'texto', label: 'Pendência' },
            { key: 'situacao', tipo: 'select', label: 'Situação', opcoes: ['Corrigida', 'Corrigida parcialmente', 'Não corrigida', 'Não localizada'], obrigatorio: true, abre_pendencia_se: ['Corrigida parcialmente', 'Não corrigida'] },
            { key: 'observacao', tipo: 'texto', label: 'Observação' },
            { key: 'foto', tipo: 'foto', label: 'Foto (depois)', fotos: ['depois'] },
          ],
        },
        { key: 'problema_relatado', tipo: 'texto', label: 'Problema relatado pelo cliente', multilinha: true },
        { key: 'evento_central', tipo: 'texto', label: 'Evento apresentado na central' },
        { key: 'foto_central_antes', tipo: 'foto', label: 'Foto da tela da central antes da intervenção', obrigatorio: true },
      ],
    },
    {
      key: 'diagnostico',
      titulo: 'Diagnóstico',
      campos: [
        { key: 'causa', tipo: 'select', label: 'Causa identificada', opcoes: ['Fim de vida útil do componente', 'Dano físico', 'Falha de instalação original', 'Infiltração ou umidade', 'Surto elétrico', 'Falha de programação', 'Obstrução ou sujeira', 'Interferência de terceiros', 'Não identificada'] },
        { key: 'descricao_diagnostico', tipo: 'texto', label: 'Descrição técnica do diagnóstico', multilinha: true },
        {
          key: 'dispositivos_afetados', tipo: 'repeater', label: 'Dispositivos afetados', botao_adicionar: '+ Adicionar dispositivo',
          card_schema: [
            { key: 'device_id', tipo: 'select_catalogo', origem: 'devices', label: 'Dispositivo' },
            { key: 'observacao', tipo: 'texto', label: 'Observação' },
          ],
        },
      ],
    },
    {
      key: 'servico_executado',
      titulo: 'Serviço Executado',
      descricao: 'Foto antes e depois obrigatórias por intervenção.',
      campos: [
        {
          key: 'intervencoes', tipo: 'repeater', label: 'Intervenções', botao_adicionar: '+ Adicionar intervenção',
          card_schema: [
            { key: 'grupo', tipo: 'select_catalogo', origem: 'categorias', label: 'Grupo' },
            { key: 'item', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Item / material aplicado', permite_texto_livre: true },
            { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 },
            { key: 'local', tipo: 'texto', label: 'Local' },
            { key: 'acao_executada', tipo: 'select', label: 'Ação executada', opcoes: ['Substituição', 'Reparo', 'Limpeza', 'Reposicionamento', 'Reprogramação', 'Instalação', 'Ajuste'] },
            { key: 'descricao', tipo: 'texto', label: 'Descrição', multilinha: true },
            { key: 'foto', tipo: 'foto', label: 'Fotos', fotos: ['antes', 'depois'], obrigatorio: true },
          ],
        },
      ],
    },
    {
      key: 'materiais',
      titulo: 'Materiais Aplicados',
      descricao: 'Baixa automática no Estoque ao finalizar. Não previstos exigem aprovação do gestor.',
      campos: [
        {
          key: 'materiais_aplicados', tipo: 'repeater', label: 'Materiais', botao_adicionar: '+ Adicionar material',
          card_schema: [
            { key: 'item', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Material', permite_texto_livre: true },
            { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 },
          ],
        },
      ],
    },
    {
      key: 'testes',
      titulo: 'Testes Pós-Intervenção',
      campos: [
        { key: 'dispositivo_respondeu', tipo: 'select', label: 'Dispositivo intervencionado respondeu no teste funcional', opcoes: ['Sim', 'Não', 'Não aplicável'], abre_pendencia_se: ['Não'] },
        { key: 'endereco_reconhecido', tipo: 'select', label: 'Endereço reconhecido corretamente na central', opcoes: ['Sim', 'Não', 'Sistema convencional'], abre_pendencia_se: ['Não'] },
        { key: 'central_normal', tipo: 'select', label: 'Central retornou à condição normal, sem falhas ativas', opcoes: ['Sim', 'Não'], abre_pendencia_se: ['Não'] },
        { key: 'falhas_remanescentes', tipo: 'texto', label: 'Falhas remanescentes', multilinha: true },
        { key: 'intertravamentos', tipo: 'multiselect', label: 'Intertravamentos testados', opcoes: ['Ar-condicionado', 'Controle de acesso', 'Elevadores', 'Pressurização', 'Exaustão', 'Som ambiente', 'Não aplicável'] },
        { key: 'sistema_operante', tipo: 'select', label: 'Sistema entregue operante', opcoes: ['Sim', 'Sim, com ressalvas', 'Não'], obrigatorio: true, abre_pendencia_se: ['Não'] },
        { key: 'foto_central_depois', tipo: 'foto', label: 'Foto da tela da central após a intervenção', obrigatorio: true },
      ],
    },
    {
      key: 'pendencias_residuais',
      titulo: 'Pendências Residuais',
      descricao: 'Detectado durante a corretiva e fora do escopo aprovado. Gera pendência nova (aberta).',
      campos: [apontamentosRepeater(1)],
    },
    {
      key: 'encerramento',
      titulo: 'Encerramento',
      campos: [
        { key: 'hora_chegada', tipo: 'hora', label: 'Horário de chegada' },
        { key: 'hora_saida', tipo: 'hora', label: 'Horário de saída' },
        { key: 'operacao_normal', tipo: 'select', label: 'Sistema deixado em operação normal', opcoes: ['Sim', 'Não'], obrigatorio: true },
        { key: 'orientacoes', tipo: 'texto', label: 'Orientações repassadas ao cliente', multilinha: true },
        { key: 'assinatura', tipo: 'assinatura', label: 'Assinatura do responsável no local', obrigatorio: true },
      ],
    },
  ],
};

/* ------------------------ MANUTENÇÃO PREVENTIVA ------------------------ */

export const PREVENTIVA_SDAI: TemplateSchema = {
  codigo: 'PREVENTIVA_SDAI',
  nome: 'Preventiva SDAI',
  area: 'SDAI',
  tipo: 'PREVENTIVA',
  secoes: [
    {
      key: 'identificacao',
      titulo: 'Identificação',
      campos: [
        { key: 'periodicidade', tipo: 'select', label: 'Periodicidade', opcoes: ['Mensal', 'Trimestral', 'Semestral', 'Anual'] },
        { key: 'contrato_id', tipo: 'select_catalogo', origem: 'contratos', label: 'Contrato vinculado' },
        { key: 'pendencias_abertas_ref', tipo: 'select_catalogo', origem: 'pendencias_abertas', label: 'Pendências em aberto deste cliente (somente leitura)' },
      ],
    },
    {
      key: 'central',
      titulo: 'Central',
      campos: [
        { key: 'central_normal', tipo: 'passfail', label: 'Central energizada e em condição normal', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'eventos_falha', tipo: 'select', label: 'Eventos de falha ativos no painel', opcoes: ['Nenhum', 'Sim'], abre_pendencia_se: ['Sim'] },
        { key: 'eventos_descricao', tipo: 'texto', label: 'Descrição dos eventos', multilinha: true },
        { key: 'dispositivos_bypass', tipo: 'select', label: 'Dispositivos desabilitados/bypass na central', opcoes: ['Nenhum', 'Sim'], abre_pendencia_se: ['Sim'] },
        { key: 'bypass_quais', tipo: 'texto', label: 'Quais e por quê', multilinha: true },
        { key: 'tensao_bateria', tipo: 'numero', label: 'Tensão da bateria medida (V)' },
        { key: 'data_fabricacao_baterias', tipo: 'data', label: 'Data de fabricação das baterias' },
        { key: 'teste_autonomia', tipo: 'passfail', label: 'Teste de autonomia realizado', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'alimentacao_carregador', tipo: 'passfail', label: 'Alimentação principal e carregador', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'limpeza_painel', tipo: 'select', label: 'Limpeza interna do painel', opcoes: ['Executado', 'Não executado'] },
        { key: 'backup_programacao', tipo: 'select', label: 'Backup da programação', opcoes: ['Executado', 'Não executado'] },
        { key: 'foto_painel', tipo: 'foto', label: 'Foto do painel', obrigatorio: true },
      ],
    },
    {
      key: 'dispositivos',
      titulo: 'Dispositivos',
      descricao: 'Uma linha por dispositivo (gerada a partir do inventário) ou adicionada manualmente. Teste reprovado/não realizado abre pendência.',
      campos: [
        {
          key: 'dispositivos', tipo: 'checklist_dispositivos', label: 'Dispositivos', botao_adicionar: '+ Adicionar dispositivo', gera_pendencia: true,
          card_schema: [
            { key: 'dispositivo', tipo: 'texto', label: 'Dispositivo' },
            { key: 'limpeza', tipo: 'select', label: 'Limpeza executada', opcoes: ['Sim', 'Não'] },
            { key: 'teste_funcional', tipo: 'select', label: 'Teste funcional', opcoes: ['Aprovado', 'Reprovado', 'Não testado'], abre_pendencia_se: ['Reprovado', 'Não testado'] },
            { key: 'motivo_nao_testado', tipo: 'select', label: 'Motivo se não testado', opcoes: ['Área inacessível', 'Operação em andamento', 'Autorização negada', 'Dispositivo obstruído', 'Fora da amostra do ciclo'] },
            { key: 'endereco_reconhecido', tipo: 'select', label: 'Endereço reconhecido na central', opcoes: ['Sim', 'Não', 'Convencional'] },
            { key: 'fixacao', tipo: 'passfail', label: 'Fixação e integridade física', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
            { key: 'obstruido', tipo: 'select', label: 'Obstruído por mercadoria/mobiliário', opcoes: ['Sim', 'Não'], abre_pendencia_se: ['Sim'] },
            { key: 'observacao', tipo: 'texto', label: 'Observação' },
            { key: 'foto', tipo: 'foto', label: 'Foto (obrigatória se reprovado)', fotos: 1 },
          ],
        },
      ],
    },
    {
      key: 'sinalizacao',
      titulo: 'Sinalização e Intertravamentos',
      campos: [
        { key: 'sirenes', tipo: 'passfail', label: 'Sirenes acionadas e audíveis', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'sinalizador_visual', tipo: 'passfail', label: 'Sinalizador visual operante', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'corte_ar', tipo: 'select', label: 'Corte de ar-condicionado', opcoes: ['Testado OK', 'Testado com falha', 'Não testado', 'Não possui'], abre_pendencia_se: ['Testado com falha'] },
        { key: 'liberacao_acesso', tipo: 'select', label: 'Liberação de controle de acesso', opcoes: ['Testado OK', 'Testado com falha', 'Não testado', 'Não possui'], abre_pendencia_se: ['Testado com falha'] },
        { key: 'chamada_elevadores', tipo: 'select', label: 'Chamada de elevadores', opcoes: ['Testado OK', 'Testado com falha', 'Não testado', 'Não possui'], abre_pendencia_se: ['Testado com falha'] },
        { key: 'pressurizacao', tipo: 'select', label: 'Pressurização de escada', opcoes: ['Testado OK', 'Testado com falha', 'Não testado', 'Não possui'], abre_pendencia_se: ['Testado com falha'] },
        { key: 'comunicacao_supervisoria', tipo: 'select', label: 'Comunicação com central supervisória', opcoes: ['Testado OK', 'Testado com falha', 'Não possui'], abre_pendencia_se: ['Testado com falha'] },
      ],
    },
    {
      key: 'infraestrutura',
      titulo: 'Infraestrutura (verificação visual)',
      campos: [
        { key: 'cabeamento_laco', tipo: 'passfail', label: 'Cabeamento do laço íntegro', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'modulos_isoladores', tipo: 'passfail', label: 'Módulos isoladores operantes', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'eletrodutos_caixas', tipo: 'passfail', label: 'Eletrodutos e caixas íntegros', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
        { key: 'identificacao_circuitos', tipo: 'passfail', label: 'Identificação dos circuitos legível', opcoes: ['Aprovado', 'Reprovado'], abre_pendencia_se: ['Reprovado'] },
      ],
    },
    {
      key: 'pendencias',
      titulo: 'Pendências',
      descricao: 'Consolidação do que precisa de correção. Alimenta orçamento.',
      campos: [apontamentosRepeater(1)],
    },
    {
      key: 'encerramento',
      titulo: 'Encerramento',
      campos: [
        // Decisão 10: cobertura transparente — três números. O percentual principal
        // considera testados sobre o total; o impedimento aparece destacado ao lado.
        { key: 'disp_testados', tipo: 'numero', label: 'Dispositivos testados', help: 'Numerador do percentual de cobertura.' },
        { key: 'disp_nao_testados_impedimento', tipo: 'numero', label: 'Não testados por impedimento', help: 'Operação em andamento, autorização negada, área inacessível — motivo alheio à Fireowl. Registrar o motivo em cada dispositivo.' },
        { key: 'disp_nao_testados_falha', tipo: 'numero', label: 'Não testados por falha de execução' },
        { key: 'operacao_normal', tipo: 'select', label: 'Sistema entregue em operação normal', opcoes: ['Sim', 'Não'], obrigatorio: true },
        { key: 'disjuntor_rearmado', tipo: 'select', label: 'Disjuntor rearmado após teste de bateria', opcoes: ['Sim', 'Não', 'Não se aplica'] },
        { key: 'foto_disjuntor', tipo: 'foto', label: 'Foto do disjuntor (obrigatória em Sim e Não)', obrigatorio: true },
        { key: 'foto_final_painel', tipo: 'foto', label: 'Foto final do painel', obrigatorio: true },
        { key: 'recomendacoes', tipo: 'texto', label: 'Recomendações ao cliente', multilinha: true },
        { key: 'assinatura', tipo: 'assinatura', label: 'Assinatura do responsável', obrigatorio: true },
      ],
    },
  ],
};

/* =====================================================================
 * Templates das demais disciplinas (CFTV, Controle de Acesso, BMS, Alarme).
 * Reaproveitam o motor: identificação enxuta + apontamento com o catálogo de
 * falhas da área (auto-preenchimento). A Corretiva usa o checklist de
 * pendências aprovadas (comum a todas as disciplinas).
 * ===================================================================== */

// Checklist de pendências aprovadas — comum às corretivas (semeado do Supabase).
const CHECKLIST_PENDENCIAS_FIELD: FieldSchema = {
  key: 'pendencias_aprovadas',
  tipo: 'checklist_pendencias',
  label: 'Pendências aprovadas (verificar cada uma)',
  botao_adicionar: '+ Adicionar pendência',
  card_schema: [
    { key: 'pendencia', tipo: 'texto', label: 'Pendência' },
    { key: 'situacao', tipo: 'select', label: 'Situação', opcoes: ['Corrigida', 'Corrigida parcialmente', 'Não corrigida', 'Não localizada'], obrigatorio: true, abre_pendencia_se: ['Corrigida parcialmente', 'Não corrigida'] },
    { key: 'observacao', tipo: 'texto', label: 'Observação' },
    { key: 'foto', tipo: 'foto', label: 'Foto (depois)', fotos: ['depois'] },
  ],
};

// Intervenções executadas — comum às corretivas.
const INTERVENCOES_FIELD: FieldSchema = {
  key: 'intervencoes',
  tipo: 'repeater',
  label: 'Intervenções',
  botao_adicionar: '+ Adicionar intervenção',
  card_schema: [
    { key: 'grupo', tipo: 'select_catalogo', origem: 'categorias', label: 'Grupo' },
    { key: 'item', tipo: 'autocomplete_catalogo', origem: 'estoque_servicos', label: 'Item / material aplicado', permite_texto_livre: true },
    { key: 'quantidade', tipo: 'numero', label: 'Quantidade', default: 1 },
    { key: 'local', tipo: 'texto', label: 'Local' },
    { key: 'acao_executada', tipo: 'select', label: 'Ação executada', opcoes: ['Substituição', 'Reparo', 'Limpeza', 'Reposicionamento', 'Reprogramação', 'Instalação', 'Ajuste'] },
    { key: 'descricao', tipo: 'texto', label: 'Descrição', multilinha: true },
    { key: 'foto', tipo: 'foto', label: 'Fotos', fotos: ['antes', 'depois'], obrigatorio: true },
  ],
};

function levantamentoDisciplina(area: string, codigo: string, nome: string, identificacao: FieldSchema[]): TemplateSchema {
  return {
    codigo,
    nome,
    tipo: 'LEVANTAMENTO',
    area,
    secoes: [
      { key: 'identificacao', titulo: 'Identificação do sistema', campos: identificacao },
      {
        key: 'apontamentos',
        titulo: 'Apontamentos',
        descricao: 'Cada apontamento vira uma pendência para a proposta. Use a "Falha padrão" para preencher rápido.',
        campos: [apontamentosRepeater(1, area)],
      },
    ],
  };
}

function corretivaDisciplina(area: string, codigo: string, nome: string): TemplateSchema {
  return {
    codigo,
    nome,
    tipo: 'CORRETIVA',
    area,
    secoes: [
      {
        key: 'chamado',
        titulo: 'Chamado',
        campos: [
          { key: 'origem_chamado', tipo: 'select', label: 'Origem do chamado', opcoes: ['Solicitação do cliente', 'Falha detectada em monitoramento', 'Pendência de levantamento', 'Pendência de preventiva'] },
          CHECKLIST_PENDENCIAS_FIELD,
          { key: 'problema_relatado', tipo: 'texto', label: 'Problema relatado pelo cliente', multilinha: true },
          { key: 'foto_antes', tipo: 'foto', label: 'Foto do estado inicial', obrigatorio: true },
        ],
      },
      {
        key: 'servico_executado',
        titulo: 'Serviço executado',
        descricao: 'Foto antes e depois obrigatórias por intervenção.',
        campos: [INTERVENCOES_FIELD],
      },
      {
        key: 'encerramento',
        titulo: 'Encerramento',
        campos: [
          { key: 'sistema_operante', tipo: 'select', label: 'Sistema entregue operante', opcoes: ['Sim', 'Sim, com ressalvas', 'Não'], obrigatorio: true, abre_pendencia_se: ['Não'] },
          { key: 'observacoes', tipo: 'texto', label: 'Observações / pendências remanescentes', multilinha: true },
          { key: 'foto_depois', tipo: 'foto', label: 'Foto final do sistema', obrigatorio: true },
        ],
      },
    ],
  };
}

/* ---- Identificação por disciplina ---- */
const ID_CFTV: FieldSchema[] = [
  { key: 'possui', tipo: 'select', label: 'O local possui CFTV instalado?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
  { key: 'tecnologia', tipo: 'select', label: 'Tecnologia', opcoes: ['Analógico / HD (HDCVI/AHD/TVI)', 'IP', 'Híbrido', 'Não identificado'] },
  { key: 'gravador', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Gravador (marca/modelo DVR/NVR)', permite_texto_livre: true },
  { key: 'qtd_canais', tipo: 'numero', label: 'Nº de canais do gravador' },
  { key: 'qtd_cameras', tipo: 'numero', label: 'Nº de câmeras ativas' },
  { key: 'armazenamento', tipo: 'texto', label: 'Armazenamento (HDs / capacidade)' },
  { key: 'acesso_remoto', tipo: 'select', label: 'Acesso remoto', opcoes: ['Funciona (P2P/DDNS)', 'Instável', 'Não configurado', 'Não avaliado'] },
  { key: 'foto_rack', tipo: 'foto', label: 'Foto do gravador / rack', obrigatorio: true },
];
const ID_CA: FieldSchema[] = [
  { key: 'possui', tipo: 'select', label: 'O local possui controle de acesso?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
  { key: 'controladora', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Controladora (marca/modelo)', permite_texto_livre: true },
  { key: 'qtd_portas', tipo: 'numero', label: 'Nº de portas / acessos controlados' },
  { key: 'tipo_leitor', tipo: 'multiselect', label: 'Tipo de leitor', opcoes: ['Biométrico', 'RFID / proximidade', 'Facial', 'Teclado / senha'] },
  { key: 'bloqueios', tipo: 'multiselect', label: 'Ferragens / bloqueios', opcoes: ['Eletroímã', 'Fechadura solenoide', 'Catraca', 'Cancela', 'Torniquete'] },
  { key: 'software', tipo: 'texto', label: 'Software de gestão (marca/versão)' },
  { key: 'foto', tipo: 'foto', label: 'Foto da controladora / ponto', obrigatorio: true },
];
const ID_BMS: FieldSchema[] = [
  { key: 'possui', tipo: 'select', label: 'O local possui automação predial (BMS)?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
  { key: 'controlador', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Controlador / CLP (marca/modelo)', permite_texto_livre: true },
  { key: 'protocolo', tipo: 'multiselect', label: 'Protocolo de comunicação', opcoes: ['BACnet', 'Modbus', 'RS-485', 'KNX', 'Proprietário', 'Não identificado'] },
  { key: 'supervisorio', tipo: 'texto', label: 'Supervisório / IHM (SCADA)' },
  { key: 'sistemas', tipo: 'texto', label: 'Sistemas monitorados (HVAC, bombas, iluminação...)' },
  { key: 'foto', tipo: 'foto', label: 'Foto do painel / controlador', obrigatorio: true },
];
const ID_ALARME: FieldSchema[] = [
  { key: 'possui', tipo: 'select', label: 'O local possui alarme de intrusão?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
  { key: 'central', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Central (marca/modelo)', permite_texto_livre: true },
  { key: 'qtd_zonas', tipo: 'numero', label: 'Nº de zonas / partições' },
  { key: 'tecnologia', tipo: 'multiselect', label: 'Tecnologia', opcoes: ['Com fio', 'Sem fio (RF)', 'Híbrido'] },
  { key: 'comunicacao', tipo: 'multiselect', label: 'Comunicação com monitoramento', opcoes: ['GPRS / 4G', 'Ethernet / IP', 'Linha telefônica', 'Sem monitoramento'] },
  { key: 'monitoramento', tipo: 'texto', label: 'Empresa de monitoramento (se houver)' },
  { key: 'foto', tipo: 'foto', label: 'Foto da central', obrigatorio: true },
];

export const LEVANTAMENTO_CFTV = levantamentoDisciplina('CFTV', 'LEVANTAMENTO_CFTV', 'Levantamento CFTV (Orçamento)', ID_CFTV);
export const CORRETIVA_CFTV = corretivaDisciplina('CFTV', 'CORRETIVA_CFTV', 'Corretiva CFTV');
export const LEVANTAMENTO_CA = levantamentoDisciplina('CONTROLE_ACESSO', 'LEVANTAMENTO_CA', 'Levantamento Controle de Acesso (Orçamento)', ID_CA);
export const CORRETIVA_CA = corretivaDisciplina('CONTROLE_ACESSO', 'CORRETIVA_CA', 'Corretiva Controle de Acesso');
export const LEVANTAMENTO_BMS = levantamentoDisciplina('BMS', 'LEVANTAMENTO_BMS', 'Levantamento Automação/BMS (Orçamento)', ID_BMS);
export const CORRETIVA_BMS = corretivaDisciplina('BMS', 'CORRETIVA_BMS', 'Corretiva Automação/BMS');
export const LEVANTAMENTO_ALARME = levantamentoDisciplina('ALARME', 'LEVANTAMENTO_ALARME', 'Levantamento Alarme (Orçamento)', ID_ALARME);
export const CORRETIVA_ALARME = corretivaDisciplina('ALARME', 'CORRETIVA_ALARME', 'Corretiva Alarme');

// Helper: check pass/fail que abre pendência quando reprovado.
const pf = (key: string, label: string, grupo?: string, acao?: string, extraOpcoes: string[] = []): FieldSchema => ({
  key,
  tipo: 'passfail',
  label,
  opcoes: ['Aprovado', 'Reprovado', ...extraOpcoes],
  abre_pendencia_se: ['Reprovado'],
  ...(grupo ? { pendencia_sugerida: { grupo, acao: acao as never } } : {}),
});
const SISTEMA_OPERANTE: FieldSchema = {
  key: 'sistema_operante',
  tipo: 'select',
  label: 'Sistema entregue operante',
  opcoes: ['Sim', 'Sim, com ressalvas', 'Não'],
  obrigatorio: true,
  abre_pendencia_se: ['Não'],
};

/* ------------------------------ Preventiva CFTV ------------------------------ */
export const PREVENTIVA_CFTV: TemplateSchema = {
  codigo: 'PREVENTIVA_CFTV', nome: 'Preventiva CFTV', tipo: 'PREVENTIVA', area: 'CFTV',
  secoes: [
    { key: 'gravador', titulo: 'Gravador (DVR/NVR)', campos: [
      pf('energizado', 'Gravador energizado e operante', 'CFTV > Gravação', 'reparar'),
      pf('hd_saude', 'HD reconhecido e sem erro (SMART)', 'CFTV > Gravação', 'substituir'),
      pf('gravacao_continua', 'Gravação contínua com histórico disponível', 'CFTV > Gravação', 'reparar'),
      pf('data_hora', 'Data e hora corretas'),
      { key: 'retencao_dias', tipo: 'numero', label: 'Dias de retenção disponíveis' },
      pf('ventilacao', 'Ventilação / cooler sem superaquecimento', 'CFTV > Gravação', 'limpar'),
      { key: 'foto_tela', tipo: 'foto', label: 'Foto do mosaico / tela do gravador', obrigatorio: true },
    ]},
    { key: 'cameras', titulo: 'Câmeras', campos: [
      pf('todas_com_imagem', 'Todas as câmeras com imagem (sem perda de vídeo)', 'CFTV > Câmeras', 'investigar'),
      { key: 'qtd_com_defeito', tipo: 'numero', label: 'Nº de câmeras com defeito' },
      pf('ir_noturno', 'Infravermelho noturno testado', 'CFTV > Câmeras', 'substituir', ['Não aplicável']),
      pf('foco_nitidez', 'Foco e nitidez adequados', 'CFTV > Câmeras', 'limpar'),
      pf('posicionamento', 'Posicionamento correto (sem ponto cego)', 'CFTV > Câmeras', 'reposicionar'),
      { key: 'limpeza_domos', tipo: 'select', label: 'Limpeza de domos / lentes', opcoes: ['Executada', 'Não executada', 'Não aplicável'] },
    ]},
    { key: 'rede', titulo: 'Rede e acesso remoto', campos: [
      pf('acesso_remoto', 'Acesso remoto testado (P2P/DDNS)', 'CFTV > Rede', 'reprogramar'),
      pf('switch_poe', 'Switch PoE / injetores operantes', 'CFTV > Alimentação', 'substituir', ['Não aplicável']),
    ]},
    { key: 'energia', titulo: 'Alimentação e infraestrutura', campos: [
      pf('fontes', 'Fontes / nobreak operantes', 'CFTV > Alimentação', 'substituir'),
      pf('conectores', 'Conectores / baluns sem oxidação', 'CFTV > Infraestrutura', 'reparar'),
      SISTEMA_OPERANTE,
    ]},
  ],
};

/* -------------------------- Preventiva Controle de Acesso -------------------------- */
export const PREVENTIVA_CA: TemplateSchema = {
  codigo: 'PREVENTIVA_CA', nome: 'Preventiva Controle de Acesso', tipo: 'PREVENTIVA', area: 'CONTROLE_ACESSO',
  secoes: [
    { key: 'controladora', titulo: 'Controladora e servidor', campos: [
      pf('online', 'Controladora online com o servidor', 'CA > Controladoras', 'investigar'),
      pf('sincronizacao', 'Sincronização de usuários e níveis de acesso', 'CA > Controladoras', 'reprogramar'),
      { key: 'backup', tipo: 'select', label: 'Backup da base executado', opcoes: ['Executado', 'Não executado'] },
      pf('bateria', 'Bateria / nobreak testada', 'CA > Controladoras', 'substituir'),
      { key: 'foto', tipo: 'foto', label: 'Foto da controladora', obrigatorio: true },
    ]},
    { key: 'leitoras', titulo: 'Leitoras e reconhecimento', campos: [
      pf('leitura', 'Teste de leitura (RFID / biometria / facial)', 'CA > Leitoras', 'reparar'),
      pf('teclados', 'Teclados de senha operantes', 'CA > Leitoras', 'substituir', ['Não aplicável']),
      { key: 'limpeza', tipo: 'select', label: 'Limpeza de leitores executada', opcoes: ['Executada', 'Não executada'] },
    ]},
    { key: 'ferragens', titulo: 'Fechaduras e ferragens', campos: [
      pf('eletroima', 'Eletroímãs com força de atraque', 'CA > Fechaduras', 'reparar'),
      pf('mola_aerea', 'Molas aéreas reguladas (porta fecha e trava)', 'CA > Fechaduras', 'reparar'),
      pf('botoeira_rte', 'Botoeiras de saída (RTE) operantes', 'CA > Fechaduras', 'substituir'),
      pf('tamper', 'Tampas / tamper fechados corretamente', 'CA > Fechaduras', 'reparar'),
    ]},
    { key: 'bloqueios', titulo: 'Bloqueios físicos', campos: [
      pf('catracas', 'Catracas / torniquetes: giro e travamento', 'CA > Bloqueios', 'reparar', ['Não aplicável']),
      pf('fotocelulas', 'Fotocélulas / sensores de passagem', 'CA > Bloqueios', 'desobstruir', ['Não aplicável']),
      SISTEMA_OPERANTE,
    ]},
  ],
};

/* ------------------------------ Preventiva BMS ------------------------------ */
export const PREVENTIVA_BMS: TemplateSchema = {
  codigo: 'PREVENTIVA_BMS', nome: 'Preventiva Automação/BMS', tipo: 'PREVENTIVA', area: 'BMS',
  secoes: [
    { key: 'controladores', titulo: 'Controladores (CLP) e I/O', campos: [
      pf('energizado', 'Controladores energizados e sem falha de inicialização', 'BMS > Controladores', 'reparar'),
      pf('io_ok', 'Módulos de I/O sem erro de diagnóstico', 'BMS > Controladores', 'substituir'),
      pf('fonte_24v', 'Fonte 24VDC estável (sem oscilação)', 'BMS > Controladores', 'substituir'),
      pf('comunicacao', 'Comunicação de campo íntegra (BACnet/Modbus/RS-485)', 'BMS > Controladores', 'reparar'),
      { key: 'foto', tipo: 'foto', label: 'Foto do painel / controlador', obrigatorio: true },
    ]},
    { key: 'sensores', titulo: 'Sensores e instrumentação', campos: [
      pf('leituras_coerentes', 'Leituras coerentes com o ambiente (calibração)', 'BMS > Sensores', 'reparar'),
      pf('sinal_limpo', 'Sinal sem ruído / oscilação', 'BMS > Sensores', 'investigar'),
      pf('mecanica', 'Conexões mecânicas sem vazamento (pressostatos/boias)', 'BMS > Sensores', 'reparar', ['Não aplicável']),
    ]},
    { key: 'atuadores', titulo: 'Atuadores e comandos', campos: [
      pf('valvulas_dampers', 'Válvulas / dampers respondem ao comando', 'BMS > Atuadores', 'reparar'),
      pf('contatores', 'Contatores atracam (bombas / ventiladores)', 'BMS > Atuadores', 'substituir'),
      pf('inversores', 'Inversores de frequência sem falha', 'BMS > Atuadores', 'investigar', ['Não aplicável']),
    ]},
    { key: 'supervisorio', titulo: 'Supervisório e IHM', campos: [
      pf('tags_online', 'Variáveis (tags) atualizando no supervisório', 'BMS > Supervisório', 'investigar'),
      pf('ihm', 'IHM responsiva e calibrada', 'BMS > Supervisório', 'substituir', ['Não aplicável']),
      pf('historico', 'Banco de histórico / tendências arquivando', 'BMS > Supervisório', 'reparar'),
      SISTEMA_OPERANTE,
    ]},
  ],
};

/* ------------------------------ Preventiva Alarme ------------------------------ */
export const PREVENTIVA_ALARME: TemplateSchema = {
  codigo: 'PREVENTIVA_ALARME', nome: 'Preventiva Alarme', tipo: 'PREVENTIVA', area: 'ALARME',
  secoes: [
    { key: 'central', titulo: 'Central', campos: [
      pf('energizada', 'Central energizada e em condição normal', 'Alarme > Central', 'reparar'),
      pf('alimentacao_ac', 'Alimentação AC presente (não só bateria)', 'Alarme > Central', 'reparar'),
      pf('bateria', 'Bateria selada testada (autonomia)', 'Alarme > Central', 'substituir'),
      pf('teclado', 'Teclado de operação respondendo', 'Alarme > Central', 'substituir'),
      { key: 'programacao', tipo: 'select', label: 'Backup da programação', opcoes: ['Executado', 'Não executado'] },
      { key: 'foto', tipo: 'foto', label: 'Foto da central', obrigatorio: true },
    ]},
    { key: 'sensores', titulo: 'Sensores (walk test)', campos: [
      pf('walk_test', 'Teste de caminhada (walk test) em todas as zonas', 'Alarme > Sensores', 'reparar'),
      pf('magneticos', 'Magnéticos de porta/janela alinhados', 'Alarme > Sensores', 'reposicionar'),
      pf('tamper', 'Tamper (antissabotagem) fechado', 'Alarme > Sensores', 'reparar'),
      { key: 'disparos_falsos', tipo: 'texto', label: 'Zonas com histórico de disparo falso' },
    ]},
    { key: 'sinalizacao', titulo: 'Sinalização', campos: [
      pf('sirene', 'Sirene acionada e audível', 'Alarme > Sinalização', 'substituir'),
      pf('strobe', 'Strobe (flash visual) operante', 'Alarme > Sinalização', 'substituir', ['Não aplicável']),
    ]},
    { key: 'semfio_comunicacao', titulo: 'Sem fio e comunicação', campos: [
      pf('baterias_perifericos', 'Baterias de periféricos sem fio ok', 'Alarme > Sem Fio', 'substituir', ['Não aplicável']),
      pf('comunicacao_base', 'Teste de comunicação com a central de monitoramento', 'Alarme > Comunicação', 'investigar', ['Não aplicável']),
      SISTEMA_OPERANTE,
    ]},
  ],
};

export const ALL_TEMPLATES: TemplateSchema[] = [
  LEVANTAMENTO_SDAI, CORRETIVA_SDAI, PREVENTIVA_SDAI,
  LEVANTAMENTO_CFTV, CORRETIVA_CFTV, PREVENTIVA_CFTV,
  LEVANTAMENTO_CA, CORRETIVA_CA, PREVENTIVA_CA,
  LEVANTAMENTO_BMS, CORRETIVA_BMS, PREVENTIVA_BMS,
  LEVANTAMENTO_ALARME, CORRETIVA_ALARME, PREVENTIVA_ALARME,
];

/**
 * Grava/atualiza os três templates na tabela report_templates (schema em jsonb).
 * Requer perfil ADMINISTRATIVO (RLS de report_templates). Idempotente por código.
 */
export async function seedReportTemplates(): Promise<void> {
  for (const t of ALL_TEMPLATES) {
    await upsertTemplate({
      id: '',
      codigo: t.codigo,
      nome: t.nome,
      tipo: t.tipo,
      schema: t as unknown as Record<string, unknown>,
      ativo: true,
      versao: 1,
    });
  }
}
