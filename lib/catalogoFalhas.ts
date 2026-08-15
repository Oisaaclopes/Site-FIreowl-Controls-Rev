import { AcaoRecomendada } from './types';

/* =====================================================================
 * Catálogo de falhas padrão — alimenta o auto-preenchimento rápido do
 * apontamento em campo. O técnico escolhe a falha e o formulário sugere
 * grupo, descrição, ação recomendada e criticidade (todos editáveis).
 * Organizado por ÁREA (SDAI, CFTV, ...); o seletor filtra pela área do
 * relatório. Reference data versionada em código (não precisa de migração).
 * ===================================================================== */

export type AreaFalha = 'SDAI' | 'CFTV' | 'CONTROLE_ACESSO' | 'BMS' | 'ALARME';

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

/* --------------------------- Controle de Acesso --------------------------- */
const CONTROLE_ACESSO: FalhaBase[] = [
  // Leitoras e Reconhecimento
  { grupo: 'CA > Leitoras', titulo: 'Leitor biométrico sujo / riscado', descricao: 'Dificuldade em reconhecer digitais, gerando lentidão no acesso.', acao: 'limpar', criticidade: 2 },
  { grupo: 'CA > Leitoras', titulo: 'Falha de leitura RFID', descricao: 'Dispositivo não emite bip nem lê cartões / TAGs de proximidade.', acao: 'substituir', criticidade: 3 },
  { grupo: 'CA > Leitoras', titulo: 'Teclado com desgaste', descricao: 'Botões numéricos falhando ou com contato intermitente.', acao: 'substituir', criticidade: 2 },
  { grupo: 'CA > Leitoras', titulo: 'Leitor facial ofuscado', descricao: 'Câmera do leitor não reconhece faces devido a reflexos de sol direto ou sujeira na lente.', acao: 'reposicionar', criticidade: 2 },
  // Fechaduras e Ferragens
  { grupo: 'CA > Fechaduras', titulo: 'Eletroímã sem força', descricao: 'Atraque fraco devido a queda de tensão na fonte ou superfície oxidada.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CA > Fechaduras', titulo: 'Pino da fechadura solenoide travado', descricao: 'Mecanismo não recua, mantendo a porta trancada mesmo após liberação pelo sistema.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CA > Fechaduras', titulo: 'Suporte / cantoneira frouxa', descricao: 'Fixação do eletroímã cedendo, gerando desalinhamento entre o ímã e a chapa "blanque".', acao: 'reparar', criticidade: 2 },
  { grupo: 'CA > Fechaduras', titulo: 'Mola aérea desregulada', descricao: 'Porta batendo com força ou não fechando totalmente, impedindo o travamento magnético.', acao: 'reparar', criticidade: 2 },
  { grupo: 'CA > Fechaduras', titulo: 'Botoeira de saída (RTE) com mau contato', descricao: 'Botão afundado ou microswitch interno quebrado.', acao: 'substituir', criticidade: 2 },
  // Bloqueios Físicos (Catracas, Cancelas e Torniquetes)
  { grupo: 'CA > Bloqueios', titulo: 'Mecanismo de catraca travado', descricao: 'Solenoide ou sistema de amortecimento mecânico danificado, impedindo o giro do braço.', acao: 'reparar', criticidade: 3 },
  { grupo: 'CA > Bloqueios', titulo: 'Braço de catraca com folga', descricao: 'Eixo desgastado, permitindo giro parcial sem liberação.', acao: 'reparar', criticidade: 2 },
  { grupo: 'CA > Bloqueios', titulo: 'Sensor de passagem (fotocélula) obstruído', descricao: 'Poeira ou desalinhamento da barreira infravermelha, impedindo o fechamento automático da cancela ou porta.', acao: 'desobstruir', criticidade: 2 },
  { grupo: 'CA > Bloqueios', titulo: 'Haste de cancela quebrada / torta', descricao: 'Dano físico geralmente causado por colisão de veículos.', acao: 'substituir', criticidade: 2 },
  // Controladoras, Fontes e Rede
  { grupo: 'CA > Controladoras', titulo: 'Placa controladora offline', descricao: 'Perda de comunicação TCP/IP com o servidor principal.', acao: 'investigar', criticidade: 3 },
  { grupo: 'CA > Controladoras', titulo: 'Relé da controladora colado', descricao: 'Contato metálico grudado, mantendo a porta permanentemente aberta.', acao: 'substituir', criticidade: 3 },
  { grupo: 'CA > Controladoras', titulo: 'Bateria do nobreak / fonte viciada', descricao: 'Sistema desliga e as portas se abrem (ou trancam) imediatamente em caso de queda de energia.', acao: 'substituir', criticidade: 2 },
  { grupo: 'CA > Controladoras', titulo: 'Erro de sincronização de software', descricao: 'Níveis de acesso e usuários não estão sendo enviados do servidor para o hardware local.', acao: 'reprogramar', criticidade: 2 },
];

/* ------------------------- Automação Predial (BMS) ------------------------ */
const BMS: FalhaBase[] = [
  // Controladores Lógicos (CLPs) e Módulos (I/O)
  { grupo: 'BMS > Controladores', titulo: 'Módulo de expansão em falha', descricao: 'LED de diagnóstico indicando erro interno na placa de entrada / saída.', acao: 'substituir', criticidade: 3 },
  { grupo: 'BMS > Controladores', titulo: 'Porta de comunicação queimada', descricao: 'Falha no barramento RS-485, BACnet ou Modbus (geralmente por surto de tensão).', acao: 'reparar', criticidade: 3 },
  { grupo: 'BMS > Controladores', titulo: 'Perda de memória / programa', descricao: 'Controlador em estado de "falha de inicialização" após pico de energia.', acao: 'reprogramar', criticidade: 3 },
  { grupo: 'BMS > Controladores', titulo: 'Fonte chaveada oscilando', descricao: 'Alimentação de 24VDC flutuando, fazendo os painéis de automação reiniciarem sozinhos.', acao: 'substituir', criticidade: 3 },
  // Sensores e Instrumentação
  { grupo: 'BMS > Sensores', titulo: 'Sensor de temperatura / umidade descalibrado', descricao: 'Leitura divergente da realidade do ambiente, forçando o ar-condicionado a trabalhar incorretamente.', acao: 'reparar', criticidade: 2 },
  { grupo: 'BMS > Sensores', titulo: 'Leitura oscilante ("sujeira" no sinal)', descricao: 'Interferência eletromagnética (ruído) no cabo de instrumentação.', acao: 'investigar', criticidade: 2 },
  { grupo: 'BMS > Sensores', titulo: 'Pressostato ou transdutor vazando', descricao: 'Conexão mecânica do sensor de pressão com vazamento de água ou ar.', acao: 'reparar', criticidade: 2 },
  { grupo: 'BMS > Sensores', titulo: 'Sensor de nível (boia) travado', descricao: 'Falha mecânica no reservatório, enviando sinal falso de "caixa d\'água cheia".', acao: 'reparar', criticidade: 2 },
  // Atuadores e Comandos de Painel
  { grupo: 'BMS > Atuadores', titulo: 'Válvula proporcional travada', descricao: 'Atuador do ar-condicionado (Chiller / Fancoil) não obedece ao comando de abertura / fechamento.', acao: 'reparar', criticidade: 3 },
  { grupo: 'BMS > Atuadores', titulo: 'Contator não atraca', descricao: 'Bobina do painel elétrico queimada, impedindo o acionamento de bombas ou ventiladores.', acao: 'substituir', criticidade: 3 },
  { grupo: 'BMS > Atuadores', titulo: 'Inversor de frequência em falha', descricao: 'Equipamento desarmado exibindo código de erro (sobrecarga, falta de fase) no painel de bombas.', acao: 'investigar', criticidade: 3 },
  { grupo: 'BMS > Atuadores', titulo: 'Damper mecânico emperrado', descricao: 'Aletas de ventilação presas por sujeira ou falta de lubrificação, forçando o motor.', acao: 'limpar', criticidade: 2 },
  // Interface e Software Supervisório (SCADA / IHM)
  { grupo: 'BMS > Supervisório', titulo: 'Variável (tag) offline no gráfico', descricao: 'Animação da bomba ou ventilador não atualiza na tela de operação.', acao: 'investigar', criticidade: 2 },
  { grupo: 'BMS > Supervisório', titulo: 'Touchscreen da IHM quebrado / descalibrado', descricao: 'Tela do painel local da máquina não responde aos toques do operador.', acao: 'substituir', criticidade: 2 },
  { grupo: 'BMS > Supervisório', titulo: 'Falha no banco de histórico', descricao: 'Sistema não está arquivando os gráficos de tendência de temperatura ou consumo de energia.', acao: 'reparar', criticidade: 1 },
];

/* ---------------------- Alarme (Intrusão e Pânico) ---------------------- */
const ALARME: FalhaBase[] = [
  // Central de Alarme (Painel e Placa Principal)
  { grupo: 'Alarme > Central', titulo: 'Bateria selada (12V) viciada ou descarregada', descricao: 'Perda de autonomia do painel em caso de falta de energia elétrica.', acao: 'substituir', criticidade: 3 },
  { grupo: 'Alarme > Central', titulo: 'Falha na alimentação AC (rede elétrica)', descricao: 'Central operando exclusivamente via bateria por disjuntor desligado ou fonte danificada.', acao: 'reparar', criticidade: 3 },
  { grupo: 'Alarme > Central', titulo: 'Teclado de operação inoperante ou travado', descricao: 'Teclas sem resposta, falha de backlight ou display danificado.', acao: 'substituir', criticidade: 2 },
  { grupo: 'Alarme > Central', titulo: 'Memória ou parâmetros corrompidos', descricao: 'Perda de programação de zonas, senhas ou configurações de fábrica após pico de tensão.', acao: 'reprogramar', criticidade: 3 },
  { grupo: 'Alarme > Central', titulo: 'Falha no circuito de sirene', descricao: 'Saída de áudio queimada ou em curto-circuito, impedindo o disparo sonoro.', acao: 'reparar', criticidade: 3 },
  // Dispositivos Sem Fio e Controles (RF)
  { grupo: 'Alarme > Sem Fio', titulo: 'Bateria fraca em periférico wireless', descricao: 'Nível de carga crítico em controles remotos, sensores sem fio ou botoeiras de pânico.', acao: 'substituir', criticidade: 2 },
  { grupo: 'Alarme > Sem Fio', titulo: 'Perda de sincronismo (desprogramação)', descricao: 'Dispositivo sem fio que deixou de responder à central ou ao receptor dedicado.', acao: 'reprogramar', criticidade: 2 },
  { grupo: 'Alarme > Sem Fio', titulo: 'Interferência de radiofrequência (RF)', descricao: 'Ruído ambiental ou obstrução física impedindo a recepção correta do sinal sem fio.', acao: 'investigar', criticidade: 2 },
  { grupo: 'Alarme > Sem Fio', titulo: 'Dano físico ou mecânico', descricao: 'Carcaça quebrada, botões travados ou infiltração de umidade em controles e botoeiras.', acao: 'substituir', criticidade: 2 },
  { grupo: 'Alarme > Sem Fio', titulo: 'Nomenclatura ou cadastro incorreto', descricao: 'Identificação trocada do dispositivo no software de monitoramento ou no painel.', acao: 'reprogramar', criticidade: 1 },
  // Sensores de Intrusão e Perimetrais
  { grupo: 'Alarme > Sensores', titulo: 'Disparo falso recorrente (IVP)', descricao: 'Sensor de movimento ativado indevidamente por correntes de ar, insetos, reflexos ou luz solar direta.', acao: 'reposicionar', criticidade: 2 },
  { grupo: 'Alarme > Sensores', titulo: 'Magnético desalinhado ou frouxo', descricao: 'Ímã de porta/janela fora de posição, mantendo a zona aberta permanentemente.', acao: 'reposicionar', criticidade: 2 },
  { grupo: 'Alarme > Sensores', titulo: 'Obstrução do campo de visão', descricao: 'Presença de móveis, estoques ou divisórias bloqueando a detecção do sensor.', acao: 'desobstruir', criticidade: 2 },
  { grupo: 'Alarme > Sensores', titulo: 'Lente ou cobertura danificada', descricao: 'Rachaduras ou sujeira excessiva na lente Fresnel alterando a sensibilidade do dispositivo.', acao: 'substituir', criticidade: 2 },
  { grupo: 'Alarme > Sensores', titulo: 'Falha de violação (tamper aberto)', descricao: 'Chave antissabotagem acionada por mau fechamento da tampa do sensor.', acao: 'reparar', criticidade: 2 },
  // Dispositivos Sonoros e Visuais
  { grupo: 'Alarme > Sinalização', titulo: 'Sirene danificada ou queimada', descricao: 'Bobina interna rompida ou falha no elemento piezoelétrico, impedindo emissão de som.', acao: 'substituir', criticidade: 3 },
  { grupo: 'Alarme > Sinalização', titulo: 'Volume acústico insuficiente', descricao: 'Som abafado por instalação incorreta ou obstrução física ao redor da sirene.', acao: 'reposicionar', criticidade: 2 },
  { grupo: 'Alarme > Sinalização', titulo: 'Strobe (flash visual) inoperante', descricao: 'Lâmpada estroboscópica sem acionamento visual durante o evento de alarme.', acao: 'substituir', criticidade: 2 },
  { grupo: 'Alarme > Sinalização', titulo: 'Curto-circuito na fiação externa', descricao: 'Cabos da sirene rompidos, oxidados ou em curto na tubulação.', acao: 'reparar', criticidade: 3 },
  // Módulos de Comunicação e Transmissão
  { grupo: 'Alarme > Comunicação', titulo: 'Falha no módulo GPRS/4G (chip SIM)', descricao: 'Sem sinal de operadora ou falha de comunicação de dados com a central de monitoramento.', acao: 'investigar', criticidade: 3 },
  { grupo: 'Alarme > Comunicação', titulo: 'Cabo de rede (Ethernet) desconectado', descricao: 'Perda de conectividade IP principal do painel.', acao: 'reparar', criticidade: 3 },
  { grupo: 'Alarme > Comunicação', titulo: 'Falha de handshake / protocolo', descricao: 'Central dispara localmente, mas os eventos não são entregues ao software receptor da base.', acao: 'reprogramar', criticidade: 3 },
  { grupo: 'Alarme > Comunicação', titulo: 'Linha telefônica muda ou ocupada', descricao: 'Queda de sinal na comunicação analógica tradicional (quando aplicável).', acao: 'investigar', criticidade: 2 },
  // Infraestrutura, Fiação e Alimentação Auxiliar
  { grupo: 'Alarme > Infraestrutura', titulo: 'Curto-circuito em laço de zona', descricao: 'Condutores positivo e negativo em contato direto, gerando pane no setor.', acao: 'reparar', criticidade: 3 },
  { grupo: 'Alarme > Infraestrutura', titulo: 'Fuga para o terra', descricao: 'Isolamento do cabeamento rompido em contato com estruturas metálicas ou umidade.', acao: 'reparar', criticidade: 2 },
  { grupo: 'Alarme > Infraestrutura', titulo: 'Fonte auxiliar (colmeia) desarmada', descricao: 'Falha na entrega de 12V/24V para alimentação de sensores de alto consumo.', acao: 'substituir', criticidade: 3 },
  { grupo: 'Alarme > Infraestrutura', titulo: 'Conexões oxidadas ou soldas frias', descricao: 'Pontos de interligação nos bornes gerando resistência elétrica e quedas intermitentes.', acao: 'reparar', criticidade: 2 },
];

export const CATALOGO_FALHAS: FalhaPadrao[] = [
  ...SDAI.map((f): FalhaPadrao => ({ ...f, area: 'SDAI' })),
  ...CFTV.map((f): FalhaPadrao => ({ ...f, area: 'CFTV' })),
  ...CONTROLE_ACESSO.map((f): FalhaPadrao => ({ ...f, area: 'CONTROLE_ACESSO' })),
  ...BMS.map((f): FalhaPadrao => ({ ...f, area: 'BMS' })),
  ...ALARME.map((f): FalhaPadrao => ({ ...f, area: 'ALARME' })),
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
