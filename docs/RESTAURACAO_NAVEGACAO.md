# Restauração de navegação após reload — 09/09/2026

## Auditoria e causa

`FuncionariosGate` autentica antes de montar `CrmApp`. O CRM já usa caminhos
estáticos `/funcionarios/<modulo>/`, RBAC e `pushState`/`popstate`. As entidades
e telas internas, porém, eram controladas por `useState`, perdidas na montagem.
O Client360 tinha restauração parcial de `?cliente=`, executada uma única vez,
sem acompanhar Voltar. A normalização inicial de caminhos também podia remover
a query, e a Home Mobile podia esconder o módulo operacional restaurado.

| Área | Estado anterior | Cobertura desta entrega |
| --- | --- | --- |
| Módulos principais | `CrmApp.currentTab`, URL e Home Mobile | Caminho validado por RBAC; preservação da query na normalização; contexto afasta Home Mobile |
| Clientes/Client360 | Objeto selecionado em memória; query parcial | ID consultado por `fetchClientById`, abas na URL, Voltar/Avançar |
| Base Técnica | Área, drawer, filtros e importação em memória | Área e equipamento aberto; levantamento; filtros/paginação ficam para P2 |
| Levantamento Técnico | `phase`, survey, modo, draft e previews em memória | Cabeçalho, etapa, modo canônico, ID de equipamento/draft, sessão/fotos e scroll recuperáveis |
| Equipamentos salvos offline | Jobs `TECH_ASSET` no IndexedDB | Leitura dos jobs do mesmo usuário e levantamento, combinados por ID |
| Atendimento | Registro aberto por diferentes callers; etapa em memória | Host de restauração por leitura; etapas de execução/SDAI e etapas recuperáveis de fechamento |
| Pedido/proposta | Modal, objeto e sanfonas em memória | Pedido existente, aba Pedidos, sanfonas e scroll do editor |
| OS | Objeto de detalhe em memória | Detalhe existente via consulta autenticada; nenhuma ação de início |
| Relatórios | View/wizard em memória; `ReportForm` tem draft local com `currentIdx` | Módulo e aba do Client360; formulário SDAI usa seu draft existente. Wizard genérico fica para próxima etapa |
| Estoque | Módulo e filtros/edições locais | Módulo preservado; filtros e paginação ficam para P2 |
| Agenda | Modo, mês, filtros e editor em memória | Módulo preservado; contexto interno fica para P2 |
| Fotos | Abas/filtros/visualizador em memória; outbox de blobs existente | Módulo, aba Fotos do Client360 e fotos do levantamento; visualizador global fica para P2 |
| Contratos/financeiro/catálogo/ponto/conta | Caminho de módulo e estados locais | Caminho de módulo; subestados administrativos fora do P0 |

Não havia draft persistente dos campos ainda não salvos de
`TechnicalSurveyFlow`. Seu `Draft` é `useState`; `persistSurveyAsset` salva no
banco ou na outbox somente ao acionar Salvar. As fotos já possuem persistência
própria. `ReportForm` tem outro mecanismo existente, usado por relatórios, que
não deve ser confundido com um draft de levantamento.

## Arquitetura

`NavigationSession` concentra a leitura/escrita do contexto, fornece hooks para
valores e entidades e acompanha o histórico. Os componentes continuam usando
os mesmos serviços de dados. Não há cópias de entidades no storage de navegação.

URL: `cliente`, `aba`, `area`, `levantamento`, `etapa`, `rascunho`, `sessaoFoto`,
`equipamento`, `pedido`, `pedidosAba`, `secoes`, `os`, `atendimento`,
`atendimentoEtapa`. `secoes` guarda somente os nomes das sanfonas abertas.
IDs/textos fora da lista permitida, caracteres inválidos e valores excessivos
são ignorados pelo parser.

Session storage: uma chave versionada, `fireowl.navigation.v1`, contém usuário,
token da sessão de navegação, última URL interna e até 60 posições de scroll.
Não usamos localStorage novo. A URL é a identidade navegável; a última URL é
apenas um ponto de retorno para a entrada raiz do PWA na mesma sessão de aba.
Não há promessa de recuperação após o navegador descartar sessionStorage.

O provider só libera a árvore depois de conferir o usuário. Outra conta,
logout ou perda da sessão removem o contexto. Entradas antigas do histórico
são marcadas com um token e não transferem entidades para uma nova sessão,
inclusive após sair e entrar com a mesma conta. Consultas normais continuam
sujeitas ao acesso do usuário. Uma URL numa aba nova sem marcador de proprietário
é tratada conservadoramente: o contexto interno é descartado.

Entradas de cliente, aba Client360, levantamento e entidade detalhada podem
gerar histórico. Etapas pequenas, draft ID e sanfonas substituem a entrada atual.
Voltar de um levantamento aberto na Base Técnica retorna ao contexto anterior
da Base, sem inventar um dashboard intermediário.

## Comportamento operacional

**Levantamento:** `restoreSurveyNavigation` verifica que o levantamento existe
e está EM_ANDAMENTO. Recupera modo, escopo e contagem do registro, equipamentos,
verificações e jobs existentes do usuário. Combina equipamentos por ID,
reutiliza a sessão de fotos e gera novos previews a partir das fontes existentes.
Não cria levantamento, equipamento, verificação, sessão de fotos nem job.
Se um equipamento já foi salvo, o formulário recupera os valores persistidos.
Se só o ID/fotos do draft sobreviveram, mantém esses vínculos e avisa que campos
ainda não salvos precisam ser preenchidos. Observações e outras alterações
somente em memória não são recuperadas. Sem acesso online suficiente para
validar o cabeçalho, retorna à Base; os jobs offline não são apagados.

**Atendimento:** consulta atendimentos do técnico autenticado e reabre apenas o
ID existente EM_EXECUCAO/PAUSADO. Não chama iniciar, retomar, finalizar, registrar
STARTED ou mudar status. Reabre o formulário SDAI quando estava aberto; o próprio
`ReportForm` recupera o draft e sua etapa. Diagnóstico/execução vêm do autosave já
existente. Assinatura/atualização da Base só são reabertas quando o resultado
necessário está persistido; caso contrário, volta à execução para nova seleção.
Não recupera traços de assinatura ou escolhas que existiam apenas em memória.
A restauração automática do atendimento é restrita ao próprio técnico.

**Pedido:** busca o pedido existente pelo serviço autenticado, reabre o editor,
preserva aba e sanfonas, e recupera a posição do painel. Não salva conteúdo por
restaurar. Proposta nova ainda não persistida e campos comerciais não salvos
não são transformados em um novo draft por esta entrega. Detalhes de fornecimento
e compra/recebimento não fazem parte desta primeira etapa.

**Scroll:** hook reutilizável por painel e entidade. Espera o painel correto e
altura de conteúdo suficiente; observa renderização e redimensionamento antes
de aplicar a posição. Não grava zero enquanto aguarda. Interação de toque/roda
cancela a espera para respeitar a navegação manual. Cobre os painéis de pedido,
levantamento e atendimento. Scroll de listas administrativas fica para P2.

**Fallback:** registro inexistente/inacessível, levantamento encerrado ou falha
na consulta retornam à tela válida anterior com aviso. Pedido/OS voltam à lista;
cliente indisponível volta a Clientes; atendimento indisponível fecha a execução.
As entidades nunca são recriadas para satisfazer a navegação.

## Validação automatizada

Testes novos:

- `navigationContext.test.ts`: 21 casos de URL, contexto, isolamento, valores
  corrompidos, fechamento/histórico lógico, acesso negado e condição de scroll.
- `surveyNavigation.test.ts`: 7 casos com serviços simulados, incluindo mesmo
  levantamento/modo, equipamento offline sem duplicação, isolamento de usuário,
  finalização/remoção e recuperação de sessão/fotos sem escrita.
- `attendanceNavigation.test.ts`: 5 casos de reabertura sem iniciar/retomar/eventos,
  usuário correto, entidade finalizada/ausente e ausência de autenticação.

São testes Node de lógica e integração dos serviços, não execução real de F5 ou
DOM. A confirmação visual e do histórico real depende do checklist abaixo.
Nenhum teste Playwright, browser ou screenshot foi executado.

Resultados finais: direcionados 72/72; suíte completa 1.188/1.188 em 107 arquivos;
`tsc --noEmit` aprovado; ESLint sem erros; build/export estático aprovado.
O build do projeto pula tsc/lint internamente; ambos são executados separadamente.

Arquivos desta entrega: `components/NavigationSession.tsx`,
`components/AttendanceNavigationRestore.tsx`, `components/CrmApp.tsx`,
`components/FuncionariosGate.tsx`, `components/views/CrmView.tsx`,
`components/views/PedidosView.tsx`, `components/clients/ClientDossie.tsx`,
`components/clients/ClientTechnicalBase.tsx`, `components/clients/TechnicalSurveyFlow.tsx`,
`components/operacoes/ServiceAttendanceFlow.tsx`, `components/operacoes/SdaiMaintenancePanel.tsx`,
`components/proposta/CommercialProposalModal.tsx`, `lib/navigationContext.ts`,
`lib/navigationContext.test.ts`, `lib/useNavigationScroll.ts`,
`lib/surveyNavigation.ts`, `lib/surveyNavigation.test.ts`,
`lib/attendanceNavigation.ts`, `lib/attendanceNavigation.test.ts` e este documento.

## Checklist manual para Isaac

- [ ] Clientes → cliente → Base Técnica → iniciar levantamento PONTUAL. Salvar
  equipamento e tirar fotos; editar esse equipamento; F5. Confirmar mesmo ID,
  modo, valores salvos e fotos. Confirmar que não surgiu outro levantamento/ativo.
- [ ] Repetir em PARCIAL e COMPLETO; conferir escopo, verificados e etapa Concluir.
- [ ] Tirar foto antes de salvar um equipamento; F5. Confirmar vínculo da foto e
  aviso sobre campos não salvos. Preencher e salvar, sem duplicar ativo/foto.
- [ ] Salvar equipamento offline; recuperar conexão e recarregar. Conferir que
  outbox/banco resultam em um equipamento. Em reload totalmente offline, conferir
  fallback seguro sem apagar os dados pendentes.
- [ ] Abrir atendimento em execução por OS e por card. Aguardar autosave; F5.
  Confirmar mesmo ID, diagnóstico/execução e horário inicial. Conferir histórico:
  nenhum STARTED/RESUMED adicional provocado pelo reload.
- [ ] Abrir manutenção SDAI, preencher uma etapa e recarregar. Confirmar que o
  formulário existente recupera seu draft e etapa; não inicia atendimento novo.
- [ ] Recarregar em fechamento/assinatura. Se resultado não foi persistido,
  confirmar retorno seguro à execução, sem finalizar automaticamente.
- [ ] Abrir pedido salvo, mudar sanfonas e rolar o painel; F5. Confirmar mesmo
  pedido, aba, sanfonas e posição depois do carregamento.
- [ ] Abrir OS existente e recarregar. Confirmar detalhe, sem iniciar visita.
- [ ] Cliente → Base Técnica → equipamento; F5. Confirmar cliente, aba, área e drawer.
- [ ] Cliente → Fotos; F5. Confirmar aba e carregamento normal da galeria.
- [ ] Remover/perder acesso a uma entidade em outra sessão; F5. Confirmar aviso
  e fallback, sem erro de tela ou loop.
- [ ] Finalizar levantamento/atendimento em outra sessão; F5. Confirmar fallback.
- [ ] Usuário A sair; usuário B entrar; usar Voltar e F5. Nenhum contexto interno
  do usuário A deve reaparecer. Repetir saindo/entrando com o próprio usuário A.
- [ ] Alterar query/storage para valores inválidos. Confirmar que a aplicação abre
  com fallback e continua utilizável.
- [ ] Clientes → cliente → Base → levantamento → Voltar. Confirmar Base Técnica;
  depois Avançar. Repetir com pedido e trocar de módulo após usar Voltar.
- [ ] Atualizar o PWA na mesma aba/sessão. Confirmar retorno operacional. Abrir
  nova sessão de navegador e confirmar entrada segura quando não houver contexto.
- [ ] Testar rede lenta: scroll só deve ser aplicado quando o painel tiver conteúdo.

## Restrições preservadas

Nenhuma migration, RLS, pipeline de fotos/outbox, PDF, deploy.yml, configuração
Hostinger, regra comercial ou ação de lifecycle foi alterada. Nenhum schema novo.
A próxima migration continua reservada: esta entrega não precisa da 0110.
