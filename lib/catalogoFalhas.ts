import { AcaoRecomendada } from './types';

/* =====================================================================
 * Catálogo de falhas padrão — alimenta o auto-preenchimento rápido do
 * apontamento em campo. O técnico escolhe a falha e o formulário sugere
 * grupo, descrição, ação recomendada e criticidade (todos editáveis).
 * Organizado por ÁREA (SDAI, CFTV, ...); o seletor filtra pela área do
 * relatório. Reference data versionada em código (não precisa de migração).
 * ===================================================================== */

export type AreaFalha = 'SDAI' | 'CFTV';

export interface FalhaPadrao {
  area: AreaFalha;
  grupo: string; // categoria do dispositivo
  titulo: string; // rótulo curto exibido no seletor
  descricao: string; // detalhamento técnico padrão
  acao: AcaoRecomendada; // ação recomendada sugerida
  criticidade: 1 | 2 | 3; // sugestão de criticidade operacional (interno)
}

type FalhaBase = Omit<FalhaPadrao, 'area'>;

/* --------------------------------- SDAI --------------------------------- */
const SDAI: FalhaBase[] = [
  // Central de Alarme (Painel)
  { grupo: 'SDAI > Central', titulo: 'Baterias viciadas / descarregadas', descricao: 'Tensão abaixo do limite operacional ou falha no teste de carga.', acao: 'substituir', criticidade: 3 },
  { grupo: 'SDAI > Central', titulo: 'Fuga para o terra', descricao: 'Contato indevido do cabeamento do laço com a infraestrutura metálica.', acao: 'reparar', criticidade: 2 },
  { grupo: 'SDAI > Central', titulo: 'Placa de laço queimada', descricao: 'Falha de comunicação completa com a respectiva rota de dispositivos.', acao: 'substituir', criticidade: 3 },
  { grupo: 'SDAI > Central', titulo: 'Falha de carregador / fonte', descricao: 'Painel operando apenas por bateria e sem alimentação de rede (AC).', acao: 'reparar', criticidade: 3 },
  { grupo: 'SDAI > Central', titulo: 'Display / teclado danificado', descricao: 'Dificuldade ou impossibilidade de ler eventos ou interagir com o painel.', acao: 'substituir', criticidade: 2 },
  { grupo: 'SDAI > Central', titulo: 'Falta de aterramento', descricao: 'Central não conectada à malha de aterramento do local.', acao: 'instalar', criticidade: 2 },
  // Detectores (Fumaça, Temperatura e Linear)
  { grupo: 'SDAI > Detecção', titulo: 'Necessidade de limpeza (câmara óptica suja)', descricao: 'Dispositivo gerando alarmes falsos frequentes devido a poeira ou insetos.', acao: 'limpar', criticidade: 2 },
  { grupo: 'SDAI > Detecção', titulo: 'Dispositivo ausente / removido', descricao: 'Base instalada, mas o cabeçote do detector foi retirado do local.', acao: 'instalar', criticidade: 3 },
  { grupo: 'SDAI > Detecção', titulo: 'Falha de comunicação', descricao: 'Dispositivo não responde ao painel (defeito no equipamento ou oxidação nos contatos).', acao: 'investigar', criticidade: 3 },
  { grupo: 'SDAI > Detecção', titulo: 'Base quebrada / oxidada', descricao: 'Danos físicos que impedem o encaixe correto ou o contato elétrico do detector.', acao: 'substituir', criticidade: 2 },
  { grupo: 'SDAI > Detecção', titulo: 'Obstrução física', descricao: 'Detector bloqueado por novas paredes, prateleiras, forros ou empilhamento de materiais.', acao: 'desobstruir', criticidade: 3 },
  { grupo: 'SDAI > Detecção', titulo: 'Lente desalinhada / suja (linear)', descricao: 'Emissor e receptor perderam o alinhamento óptico ou estão com o prisma sujo.', acao: 'reposicionar', criticidade: 3 },
  // Acionadores Manuais (Botoeiras)
  { grupo: 'SDAI > Acionamento', titulo: 'Acrílico / vidro rompido', descricao: 'Equipamento permanece em estado de alarme e necessita reposição do elemento quebrável.', acao: 'substituir', criticidade: 2 },
  { grupo: 'SDAI > Acionamento', titulo: 'Mecanismo travado', descricao: 'Mola ou chave de rearme com defeito mecânico, impedindo o reset do dispositivo.', acao: 'reparar', criticidade: 2 },
  { grupo: 'SDAI > Acionamento', titulo: 'Falta de sinalização', descricao: 'Ausência de placa indicativa fotoluminescente acima do acionador.', acao: 'instalar', criticidade: 1 },
  { grupo: 'SDAI > Acionamento', titulo: 'Instalação fora de padrão', descricao: 'Equipamento instalado em altura incorreta ou oculto por móveis / portas.', acao: 'reposicionar', criticidade: 2 },
  // Sinalizadores (Sirenes Audiovisuais)
  { grupo: 'SDAI > Sinalização', titulo: 'Módulo sonoro queimado', descricao: 'Sirene recebe comando, mas não emite som.', acao: 'substituir', criticidade: 3 },
  { grupo: 'SDAI > Sinalização', titulo: 'Strobe (luz) inoperante', descricao: 'Flash visual não pisca durante o acionamento.', acao: 'substituir', criticidade: 2 },
  { grupo: 'SDAI > Sinalização', titulo: 'Volume abaixo da norma', descricao: 'Som abafado ou insuficiente para sobrepor o ruído ambiente da área instalada.', acao: 'reposicionar', criticidade: 2 },
  { grupo: 'SDAI > Sinalização', titulo: 'Curto-circuito na linha', descricao: 'Sirene fechando curto na saída auxiliar da central, desarmando o fusível.', acao: 'reparar', criticidade: 3 },
  // Módulos (Monitoramento, Comando e Isoladores)
  { grupo: 'SDAI > Módulos', titulo: 'Módulo isolador atuado', descricao: 'Proteção acionada devido a curto-circuito no trecho subsequente do laço.', acao: 'investigar', criticidade: 3 },
  { grupo: 'SDAI > Módulos', titulo: 'Falha no módulo de relé', descricao: 'Dispositivo não atraca para comandos integrados (desligar ar-condicionado, abrir catracas, descer elevadores).', acao: 'substituir', criticidade: 3 },
  { grupo: 'SDAI > Módulos', titulo: 'Resistor de fim de linha (RFL) ausente', descricao: 'Zona convencional com falha de supervisão por falta ou valor incorreto do resistor.', acao: 'instalar', criticidade: 2 },
  { grupo: 'SDAI > Módulos', titulo: 'Falta de tensão auxiliar (24V)', descricao: 'Módulos que exigem alimentação externa estão sem energia chegando aos bornes.', acao: 'reparar', criticidade: 3 },
  // Infraestrutura e Cabeamento
  { grupo: 'SDAI > Infraestrutura', titulo: 'Cabeamento rompido', descricao: 'Fio partido dentro da tubulação ou no forro, causando queda de parte do laço.', acao: 'reparar', criticidade: 3 },
  { grupo: 'SDAI > Infraestrutura', titulo: 'Curto-circuito no laço', descricao: 'Cabos positivo e negativo em contato direto.', acao: 'reparar', criticidade: 3 },
  { grupo: 'SDAI > Infraestrutura', titulo: 'Uso de cabo fora de norma', descricao: 'Fiação paralela comum em vez de cabo blindado antichama específico para alarme.', acao: 'substituir', criticidade: 2 },
  { grupo: 'SDAI > Infraestrutura', titulo: 'Infraestrutura exposta / danificada', descricao: 'Eletrodutos quebrados, sem tampa ou caixas de passagem penduradas.', acao: 'reparar', criticidade: 1 },
  { grupo: 'SDAI > Infraestrutura', titulo: 'Emendas incorretas', descricao: 'Fios emendados sem solda / conector Wago ou isolamento inadequado gerando perda de dados.', acao: 'reparar', criticidade: 2 },
];

/* --------------------------------- CFTV --------------------------------- */
const CFTV: FalhaBase[] = [
  // Câmeras (Analógicas, HD e IP)
  { grupo: 'CFTV > Câmeras', titulo: 'Perda de sinal (sem vídeo)', descricao: 'Câmera apagada ou sistema informando "Perda de Vídeo" no canal.', acao: 'investigar', criticidade: 3 },
  { grupo: 'CFTV > Câmeras', titulo: 'Falha no infravermelho (IR inoperante)', descricao: 'Imagem perfeita de dia, mas totalmente escura à noite (LEDs não acendem).', acao: 'substituir', criticidade: 2 },
  { grupo: 'CFTV > Câmeras', titulo: 'Imagem desfocada ou embaçada', descricao: 'Lente desajustada, suja, ou condensação / infiltração de água dentro do canhão / dome.', acao: 'limpar', criticidade: 2 },
  { grupo: 'CFTV > Câmeras', titulo: 'Interferência / ruído na imagem', descricao: 'Linhas horizontais, chuvisco ou distorção de cor (frequente em analógico / HD).', acao: 'investigar', criticidade: 2 },
  { grupo: 'CFTV > Câmeras', titulo: 'Posicionamento alterado / ponto cego', descricao: 'Câmera virada, cobrindo a parede ou fora do campo de visão original (vandalismo ou esbarrão).', acao: 'reposicionar', criticidade: 2 },
  { grupo: 'CFTV > Câmeras', titulo: 'Cúpula / acrílico riscado', descricao: 'Redução drástica da nitidez devido ao desgaste do acrílico de proteção (câmeras dome).', acao: 'substituir', criticidade: 1 },
  // Gravadores e Armazenamento (DVR / NVR / Servidores)
  { grupo: 'CFTV > Gravação', titulo: 'Falha no disco rígido (HD)', descricao: 'HD não reconhecido, com bad blocks ou status de erro no armazenamento.', acao: 'substituir', criticidade: 3 },
  { grupo: 'CFTV > Gravação', titulo: 'Não está gravando', descricao: 'Sistema operando ao vivo, mas sem histórico de reprodução disponível.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CFTV > Gravação', titulo: 'Aviso sonoro contínuo (bip de erro)', descricao: 'DVR emitindo apito de alerta físico indicando falha de HD, rede ou conflito.', acao: 'investigar', criticidade: 2 },
  { grupo: 'CFTV > Gravação', titulo: 'Equipamento reiniciando em loop', descricao: 'Gravador desliga e liga sozinho, geralmente por falha na fonte própria ou superaquecimento.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CFTV > Gravação', titulo: 'Canal queimado', descricao: 'Entrada específica do gravador não reconhece nenhuma câmera conectada.', acao: 'reparar', criticidade: 2 },
  { grupo: 'CFTV > Gravação', titulo: 'Cooler travado / superaquecimento', descricao: 'Ausência de ventilação interna, travando o sistema ou reduzindo a vida útil do equipamento.', acao: 'substituir', criticidade: 2 },
  // Conectividade e Infraestrutura (Cabos e Conectores)
  { grupo: 'CFTV > Infraestrutura', titulo: 'Balun queimado / oxidado', descricao: 'Conversor de par trançado danificado, interrompendo o sinal de vídeo.', acao: 'substituir', criticidade: 2 },
  { grupo: 'CFTV > Infraestrutura', titulo: 'Conector BNC / P4 com mau contato', descricao: 'Solda fria ou oxidação causando perda de sinal intermitente (pisca-pisca).', acao: 'reparar', criticidade: 2 },
  { grupo: 'CFTV > Infraestrutura', titulo: 'Conector RJ45 danificado', descricao: 'Trava quebrada ou fios oxidados no ponto de rede da câmera IP.', acao: 'reparar', criticidade: 2 },
  { grupo: 'CFTV > Infraestrutura', titulo: 'Cabo rompido / esmagado', descricao: 'Ruptura física do cabo coaxial ou UTP na tubulação ou forro.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CFTV > Infraestrutura', titulo: 'Distância excedida', descricao: 'Perda de pacotes (câmera IP) ou imagem fraca por ultrapassar o limite de distância do cabo sem repetidor.', acao: 'instalar', criticidade: 2 },
  // Alimentação e Energia
  { grupo: 'CFTV > Alimentação', titulo: 'Fonte central queimada / desarmando', descricao: 'Colmeia ou fonte individual sem saída de tensão (12V ou 24V).', acao: 'substituir', criticidade: 3 },
  { grupo: 'CFTV > Alimentação', titulo: 'Queda de tensão na linha', descricao: 'Tensão insuficiente chegando à câmera, fazendo com que ela desligue apenas quando o infravermelho liga.', acao: 'reparar', criticidade: 2 },
  { grupo: 'CFTV > Alimentação', titulo: 'Falha no switch PoE / injetor', descricao: 'Porta do switch queimada ou sem entregar a alimentação necessária para a câmera IP.', acao: 'substituir', criticidade: 3 },
  { grupo: 'CFTV > Alimentação', titulo: 'Nobreak sem autonomia', descricao: 'Sistema desliga imediatamente após queda de energia por falha ou desgaste das baterias do UPS.', acao: 'substituir', criticidade: 2 },
  // Rede e Software
  { grupo: 'CFTV > Rede', titulo: 'Sistema offline no aplicativo', descricao: 'Cliente não consegue acessar as imagens pelo celular (falha de P2P ou DDNS).', acao: 'reprogramar', criticidade: 2 },
  { grupo: 'CFTV > Rede', titulo: 'Conflito de IP', descricao: 'Duas câmeras IP ou o DVR disputando o mesmo endereço na rede, causando quedas intermitentes.', acao: 'reprogramar', criticidade: 2 },
  { grupo: 'CFTV > Rede', titulo: 'Firmware desatualizado', descricao: 'Equipamento apresentando bugs de software ou vulnerabilidade de segurança.', acao: 'reprogramar', criticidade: 1 },
  { grupo: 'CFTV > Rede', titulo: 'Bloqueio de senha', descricao: 'Acesso ao gravador bloqueado por tentativas incorretas ou perda da senha de administrador.', acao: 'reprogramar', criticidade: 2 },
];

export const CATALOGO_FALHAS: FalhaPadrao[] = [
  ...SDAI.map((f): FalhaPadrao => ({ ...f, area: 'SDAI' })),
  ...CFTV.map((f): FalhaPadrao => ({ ...f, area: 'CFTV' })),
];

/** Falhas de uma área (ou todas, se área não informada). */
export const falhasPorArea = (area?: AreaFalha): FalhaPadrao[] =>
  area ? CATALOGO_FALHAS.filter((f) => f.area === area) : CATALOGO_FALHAS;

/** Grupos na ordem de exibição (todas as áreas — usado no catálogo de categorias). */
export const GRUPOS_FALHA = Array.from(new Set(CATALOGO_FALHAS.map((f) => f.grupo)));

/** Rótulo exibido no seletor: "Grupo curto — Título". */
export const falhaLabel = (f: FalhaPadrao): string => `${f.grupo.split('> ').pop()} — ${f.titulo}`;

/** Busca uma falha pelo rótulo (usado ao aplicar a seleção no card). */
export const findFalhaByLabel = (label: string): FalhaPadrao | undefined =>
  CATALOGO_FALHAS.find((f) => falhaLabel(f) === label);
