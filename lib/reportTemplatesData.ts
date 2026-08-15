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

/** Card de apontamento (seção 3 do documento). `fotos` define a config por template. */
function apontamentosRepeater(fotos: number | Array<'antes' | 'depois'>): FieldSchema {
  return {
    key: 'apontamentos',
    tipo: 'repeater',
    label: 'Apontamentos',
    botao_adicionar: '+ Adicionar apontamento',
    gera_pendencia: true,
    card_schema: [
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
  nome: 'Levantamento Técnico (Orçamento)',
  tipo: 'LEVANTAMENTO',
  secoes: [
    {
      key: 'identificacao',
      titulo: 'Identificação do Sistema Existente',
      campos: [
        { key: 'possui_sdai', tipo: 'select', label: 'O local possui SDAI instalado?', opcoes: ['Sim, completo', 'Sim, parcial', 'Não possui'], obrigatorio: true },
        { key: 'central_modelo', tipo: 'autocomplete_catalogo', origem: 'marcas', label: 'Fabricante e modelo da central', permite_texto_livre: true },
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
  nome: 'Manutenção Corretiva',
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
  nome: 'Manutenção Preventiva',
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

export const ALL_TEMPLATES: TemplateSchema[] = [LEVANTAMENTO_SDAI, CORRETIVA_SDAI, PREVENTIVA_SDAI];

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
