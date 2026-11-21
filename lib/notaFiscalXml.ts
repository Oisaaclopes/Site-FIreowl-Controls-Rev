/**
 * Parte PURA dos anexos de NF: validação de arquivo e leitura do XML
 * (NF-e SEFAZ, NFS-e Padrão Nacional e NFS-e ABRASF). Ver [[lib/notaFiscalArquivos]].
 */

export const NF_MAX_BYTES = 10 * 1024 * 1024;
export type NfAnexoTipo = 'xml' | 'pdf';

/** Valida tipo/tamanho antes do upload. Retorna mensagem de erro ou null. */
export function validarArquivoNf(file: { name: string; type?: string; size: number }, tipo: NfAnexoTipo): string | null {
  const nome = file.name.toLowerCase();
  const ok = tipo === 'xml'
    ? nome.endsWith('.xml') || /xml/.test(file.type || '')
    : nome.endsWith('.pdf') || file.type === 'application/pdf';
  if (!ok) return tipo === 'xml' ? 'Selecione o arquivo .xml da nota.' : 'Selecione o arquivo .pdf (DANFE) da nota.';
  if (file.size > NF_MAX_BYTES) return 'Arquivo maior que 10 MB.';
  if (file.size === 0) return 'Arquivo vazio.';
  return null;
}

export interface DadosXmlNf {
  tipo: 'NFE' | 'NFSE';
  numero?: string;
  /** YYYY-MM-DD */
  dataEmissao?: string;
  chaveAcesso?: string;
  valor?: number;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

/** Primeiro conteúdo de uma das tags (aceita prefixo de namespace). */
function tag(xml: string, ...nomes: string[]): string | undefined {
  for (const n of nomes) {
    const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${n}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${n}>`));
    if (m && m[1].trim()) return decode(m[1]);
  }
  return undefined;
}

/** Bloco interno de uma tag (para restringir a busca, ex.: InfNfse). */
function bloco(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${nome}[\\s>][\\s\\S]*?</(?:[\\w-]+:)?${nome}>`));
  return m?.[0];
}

const dataIso = (v?: string): string | undefined => {
  if (!v) return undefined;
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : undefined;
};

const numeroLimpo = (v?: string) => (v ? v.replace(/^0+(?=\d)/, '') : undefined);
const valorNum = (v?: string) => {
  if (!v) return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Lê NF-e (modelo 55, SEFAZ), NFS-e Padrão Nacional e NFS-e ABRASF (municipal)
 * — best-effort, sem validar assinatura. Retorna null se não reconhecer.
 */
export function lerXmlNotaFiscal(xml: string): DadosXmlNf | null {
  if (!xml || !/<\?xml|<[\w:]*(NFe|nfeProc|NFSe|Nfse|CompNfse)/i.test(xml)) return null;

  // NF-e (produto) — infNFe Id="NFe<44 dígitos>"
  if (/<(?:[\w-]+:)?infNFe[\s>]/.test(xml)) {
    const chave = tag(xml, 'chNFe') || xml.match(/Id="NFe(\d{44})"/)?.[1];
    return {
      tipo: 'NFE',
      numero: numeroLimpo(tag(xml, 'nNF')),
      dataEmissao: dataIso(tag(xml, 'dhEmi', 'dEmi')),
      chaveAcesso: chave,
      valor: valorNum(tag(bloco(xml, 'ICMSTot') || xml, 'vNF')),
    };
  }

  // NFS-e Padrão Nacional — infNFSe Id="NFS<50 dígitos>"
  if (/<(?:[\w-]+:)?infNFSe[\s>]/.test(xml)) {
    const chave = tag(xml, 'chNFSe') || xml.match(/Id="NFS(\d{50})"/)?.[1];
    return {
      tipo: 'NFSE',
      numero: numeroLimpo(tag(xml, 'nNFSe')),
      dataEmissao: dataIso(tag(xml, 'dhEmi', 'dhProc', 'dCompet')),
      chaveAcesso: chave,
      valor: valorNum(tag(xml, 'vServ', 'vLiq')),
    };
  }

  // NFS-e ABRASF (municipal) — InfNfse > Numero (o RPS também tem <Numero>)
  const inf = bloco(xml, 'InfNfse');
  if (inf) {
    const semRps = inf.replace(/<(?:[\w-]+:)?IdentificacaoRps[\s>][\s\S]*?<\/(?:[\w-]+:)?IdentificacaoRps>/g, '');
    return {
      tipo: 'NFSE',
      numero: numeroLimpo(tag(semRps, 'Numero')),
      dataEmissao: dataIso(tag(semRps, 'DataEmissao')),
      chaveAcesso: tag(semRps, 'CodigoVerificacao'),
      valor: valorNum(tag(semRps, 'ValorServicos', 'ValorLiquidoNfse')),
    };
  }
  return null;
}
