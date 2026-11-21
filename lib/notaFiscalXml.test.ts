import { describe, it, expect } from 'vitest';
import { lerXmlNotaFiscal, validarArquivoNf } from './notaFiscalXml';

const CHAVE_NFE = '41261112345678000190550010000045211000045210';
const CHAVE_NFSE = '41123452212345678000190000000000004521261112345678';

const nfe = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CHAVE_NFE}" versao="4.00">
<ide><cUF>41</cUF><nNF>0004521</nNF><dhEmi>2026-11-18T10:32:00-03:00</dhEmi></ide>
<total><ICMSTot><vProd>1500.00</vProd><vNF>1520.50</vNF></ICMSTot></total>
</infNFe></NFe><protNFe><infProt><chNFe>${CHAVE_NFE}</chNFe></infProt></protNFe></nfeProc>`;

const nfseNacional = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infNFSe Id="NFS${CHAVE_NFSE}">
<nNFSe>4521</nNFSe><dhProc>2026-11-19T08:00:00-03:00</dhProc>
<DPS><infDPS><dhEmi>2026-11-18T17:10:00-03:00</dhEmi><valores><vServPrest><vServ>3200.00</vServ></vServPrest></valores></infDPS></DPS>
<valores><vLiq>3040.00</vLiq></valores></infNFSe></NFSe>`;

const abrasf = `<?xml version="1.0" encoding="utf-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd"><Nfse><InfNfse>
<Numero>202600000000087</Numero><CodigoVerificacao>AB12-CD34</CodigoVerificacao><DataEmissao>2026-11-17T09:00:00</DataEmissao>
<IdentificacaoRps><Numero>999</Numero><Serie>A</Serie></IdentificacaoRps>
<Servico><Valores><ValorServicos>850.00</ValorServicos></Valores></Servico>
</InfNfse></Nfse></CompNfse>`;

describe('lerXmlNotaFiscal', () => {
  it('NF-e (SEFAZ): nº sem zeros à esquerda, data, chave 44 e vNF', () => {
    expect(lerXmlNotaFiscal(nfe)).toEqual({
      tipo: 'NFE', numero: '4521', dataEmissao: '2026-11-18', chaveAcesso: CHAVE_NFE, valor: 1520.5,
    });
  });

  it('NFS-e Padrão Nacional: nNFSe, dhEmi da DPS, chave 50 e vServ', () => {
    expect(lerXmlNotaFiscal(nfseNacional)).toEqual({
      tipo: 'NFSE', numero: '4521', dataEmissao: '2026-11-18', chaveAcesso: CHAVE_NFSE, valor: 3200,
    });
  });

  it('NFS-e ABRASF: ignora o Numero do RPS e usa código de verificação', () => {
    expect(lerXmlNotaFiscal(abrasf)).toEqual({
      tipo: 'NFSE', numero: '202600000000087', dataEmissao: '2026-11-17', chaveAcesso: 'AB12-CD34', valor: 850,
    });
  });

  it('aceita prefixo de namespace nas tags', () => {
    const r = lerXmlNotaFiscal(nfe.replace(/<(\/?)(\w)/g, '<$1nfe:$2').replace('<nfe:?xml', '<?xml'));
    expect(r?.numero).toBe('4521');
  });

  it('não reconhece arquivo que não é nota', () => {
    expect(lerXmlNotaFiscal('')).toBeNull();
    expect(lerXmlNotaFiscal('<?xml version="1.0"?><pedido><n>1</n></pedido>')).toBeNull();
    expect(lerXmlNotaFiscal('%PDF-1.7 ...')).toBeNull();
  });
});

describe('validarArquivoNf', () => {
  it('confere extensão por tipo e tamanho', () => {
    expect(validarArquivoNf({ name: 'nota.XML', size: 10 }, 'xml')).toBeNull();
    expect(validarArquivoNf({ name: 'danfe.pdf', size: 10 }, 'pdf')).toBeNull();
    expect(validarArquivoNf({ name: 'danfe.pdf', size: 10 }, 'xml')).toMatch(/xml/);
    expect(validarArquivoNf({ name: 'nota.xml', size: 10 }, 'pdf')).toMatch(/pdf/);
    expect(validarArquivoNf({ name: 'g.pdf', size: 11 * 1024 * 1024 }, 'pdf')).toMatch(/10 MB/);
    expect(validarArquivoNf({ name: 'v.pdf', size: 0 }, 'pdf')).toMatch(/vazio/);
  });
});
