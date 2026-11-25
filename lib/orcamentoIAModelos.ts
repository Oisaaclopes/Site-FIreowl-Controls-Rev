/* =====================================================================
 * Orçamento com IA — modelos .txt para baixar/preencher (economia de tokens).
 *
 * Convenções (aplicadas por limparTextoParaIA ANTES de enviar à IA):
 *  - linha começando com "#" = instrução para quem preenche (não é enviada);
 *  - "Campo:" sem valor depois dos dois-pontos = campo não usado (não enviado);
 *  - item de lista vazio ("- ") = removido;
 *  - linhas em branco repetidas = compactadas.
 * Assim o modelo pode ser bem explicado sem custar tokens na geração.
 * ===================================================================== */

export interface ModeloIA {
  id: string;
  arquivo: string;
  titulo: string;
  descricao: string;
  conteudo: string;
}

const CABECALHO_CLIENTE = `# CLIENTE — use o nome como está no cadastro.
# Cliente NOVO: preencha também o CNPJ; o sistema cadastra com os dados da Receita.
Cliente:
CNPJ:`;

const CONDICOES = `# CONDIÇÕES — deixe em branco o que não se aplica.
Data:
Validade (dias): 15
Prazo de execução:
Garantia: serviços 90 dias; equipamentos conforme garantia do fabricante
Forma de pagamento:`;

const TEXTOS = `# TEXTOS — só entra no documento o que você escrever (a IA não inventa).
# Carta de apresentação, impostos, multas, confidencialidade e condições
# gerais NÃO precisam ser escritos: vêm dos textos-padrão da empresa.
Objetivo:
Solução / escopo:
Responsabilidades da Fireowl:
-
Responsabilidades do cliente:
-
Não inclusos:
-
Premissas técnicas:
- `;

export const MODELOS_IA: ModeloIA[] = [
  {
    id: 'orcamento',
    arquivo: 'modelo-orcamento.txt',
    titulo: 'Orçamento (equipamentos + serviços)',
    descricao: 'O mais usado: materiais do estoque ou novos, mão de obra, opcionais e condições.',
    conteudo: `# MODELO — ORÇAMENTO (equipamentos + serviços)
# Preencha, apague o que não usar e cole/carregue na aba "Orçamento com IA".
Tipo: Orçamento
Título:
Local:
${CABECALHO_CLIENTE}

# EQUIPAMENTOS — uma linha por produto: MODELO | descrição | cód. fornecedor | custo | qtd
# Produto já cadastrado sem mudança de preço: basta "MODELO | qtd N".
# Regra de preço (opcional): ex. "margem 30% sobre o custo" — a IA calcula a venda.
Marca:
Categoria:
Regra de preço: margem 30% sobre o custo
-
-

# SERVIÇOS — uma linha por serviço com o valor.
-
-

# OPCIONAIS — aparecem no documento, mas NÃO somam no total.
Opcional (não somar):
-

${CONDICOES}

${TEXTOS}
`,
  },
  {
    id: 'proposta',
    arquivo: 'modelo-proposta-comercial.txt',
    titulo: 'Proposta comercial',
    descricao: 'Documento mais completo (técnico-comercial) para projetos e implantações.',
    conteudo: `# MODELO — PROPOSTA COMERCIAL (técnico-comercial)
# Igual ao orçamento, com mais ênfase nos textos técnicos.
Tipo: Proposta
Título:
Local:
${CABECALHO_CLIENTE}

# ÁREA E SERVIÇO — ex.: SDAI, CFTV, Controle de acesso, Alarme, BMS / Instalação, Retrofit, Manutenção.
Área:
Tipo de serviço:

# EQUIPAMENTOS — MODELO | descrição | cód. fornecedor | custo | qtd
Marca:
Regra de preço: margem 30% sobre o custo
-
-

# SERVIÇOS — descrição — valor
-
-

Opcional (não somar):
-

${CONDICOES}

${TEXTOS}

# DESCRIÇÃO DOS SERVIÇOS (opcional) — grupos "Título: itens"; se vazio, a IA agrupa os serviços acima.
Descrição dos serviços:
-
`,
  },
  {
    id: 'servico',
    arquivo: 'modelo-servico-manutencao.txt',
    titulo: 'Serviço / Manutenção',
    descricao: 'Manutenção corretiva/preventiva: mão de obra e, se houver, peças do estoque.',
    conteudo: `# MODELO — SERVIÇO / MANUTENÇÃO
Tipo: Serviço
Título:
Local:
${CABECALHO_CLIENTE}

# Área e tipo — ex.: SDAI / Manutenção corretiva.
Área:
Tipo de serviço: Manutenção corretiva

# SERVIÇOS — descrição — valor
-
-

# PEÇAS (opcional) — MODELO | qtd (preço do cadastro) ou MODELO | custo | qtd
-

Opcional (não somar):
-

${CONDICOES}

# TEXTOS (opcionais)
Objetivo:
Escopo:
Responsabilidades do cliente:
-
Não inclusos:
-
`,
  },
  {
    id: 'fornecimento',
    arquivo: 'modelo-fornecimento-materiais.txt',
    titulo: 'Fornecimento de materiais',
    descricao: 'Só venda de materiais, sem mão de obra (documento enxuto de fornecimento).',
    conteudo: `# MODELO — FORNECIMENTO DE MATERIAIS (sem mão de obra)
Tipo: Fornecimento
Título:
${CABECALHO_CLIENTE}

# MATERIAIS — MODELO | descrição | cód. fornecedor | custo | qtd
# Produto já cadastrado: "MODELO | qtd N" usa o preço do cadastro.
Marca:
Regra de preço: margem 30% sobre o custo
-
-

Data:
Validade (dias): 15
Prazo de entrega:
Garantia: conforme garantia do fabricante
Forma de pagamento:
`,
  },
];

export const GUIA_IA = {
  arquivo: 'LEIA-ME-orcamento-com-ia.txt',
  conteudo: `ORÇAMENTO COM IA — GUIA RÁPIDO (Fireowl Controls)

COMO USAR
1. Baixe o modelo do tipo de documento, preencha no Bloco de Notas e salve.
2. Na aba Pedidos > Orçamento com IA, clique em "Carregar .txt" (ou cole o texto).
3. Clique em "Gerar plano com IA", revise o plano e aprove.
4. O rascunho abre no editor de Pedidos. Emitir/enviar continua manual.

O QUE A IA FAZ
- Acha o cliente no cadastro pelo nome, nome fantasia ou CNPJ.
- Cadastra CLIENTE NOVO se você informar nome + CNPJ (puxa razão social e
  endereço da Receita). Se o CNPJ já existir, usa o cadastro existente.
- Acha produtos pelo modelo ou código do fornecedor; atualiza custo/venda de
  produtos existentes e cria os que não existem (estoque inicial 0).
- Calcula a venda por regra ("margem 30% sobre o custo" = custo x 1,30).
- Monta itens de equipamento (ligados ao estoque) e de serviço.
- Separa itens OPCIONAIS (aparecem no documento, fora do total).
- Preenche tipo de documento: Orçamento, Proposta, Serviço ou Fornecimento.
- Preenche título, local, data, validade, prazo, garantia e pagamento.
- Copia seus textos: objetivo, solução, responsabilidades, não inclusos,
  premissas e descrição dos serviços.
- Confere os totais (o sistema recalcula) e avisa inconsistências.

O QUE A IA NÃO FAZ (de propósito)
- Não envia orçamento ao cliente, não gera cobrança, OS, contrato ou laudo.
- Não lança entrada de estoque.
- Não inventa preços, clientes, CNPJ, cláusulas ou responsabilidades.
- Nada é gravado antes de você aprovar o plano.

DICAS PARA GASTAR MENOS (e acertar mais)
- Linhas que começam com "#" e campos vazios ("Campo:") NÃO são enviados.
- Use o MODELO exato do produto (ex.: IVP 8000 MW PET).
- Produto já cadastrado sem mudança de preço: "MODELO | qtd N" basta.
- Escreva "opcional (não somar)" nos itens que não entram no total.
- Não escreva carta, impostos, multas, confidencialidade: são padrão.
- Pedido simples = poucas linhas. Ex.:
    Tipo: Serviço
    Cliente: Cacau Show Catuaí
    Título: Manutenção corretiva SDAI
    - DFC 421 | qtd 2
    - Mão de obra de substituição e testes — 350,00

IA RÁPIDA x AVANÇADA
- Toda geração começa na IA rápida (custo muito baixo).
- Se o plano vier com defeito, o sistema refaz sozinho na IA avançada.
- Botão "Refazer com IA avançada" para quando o resultado vier fraco.
`,
};

/**
 * Remove do texto o que não precisa ir para a IA (economia de tokens):
 * comentários "#", campos vazios "Campo:", itens vazios "- ", títulos de seção
 * que ficaram sem conteúdo e linhas em branco repetidas.
 */
export function limparTextoParaIA(texto: string): string {
  const ehItem = (t: string) => /^[-•*]\s*\S/.test(t);
  const linhas = texto
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('#') && !/^[-•*]\s*$/.test(t);
    });
  // "Campo:" sem valor só fica se for cabeçalho de uma lista preenchida logo abaixo.
  const uteis = linhas.filter((l, i) => {
    if (!/^[^:]{1,60}:\s*$/.test(l.trim())) return true;
    const prox = linhas.slice(i + 1).find((x) => x.trim() !== '');
    return !!prox && ehItem(prox.trim());
  });
  return uteis.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Baixa um texto como arquivo .txt (UTF-8 com BOM para o Bloco de Notas). */
export function baixarTxt(arquivo: string, conteudo: string): void {
  const blob = new Blob(['﻿' + conteudo.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
