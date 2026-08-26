export interface CnpjData {
  razaoSocial: string;
  nomeFantasia: string;
  logradouro: string;
  cidadeUf: string;
  cep: string;
  email: string;
  telefone: string;
  cnaeDescricao?: string;
}

/**
 * Realiza busca de dados cadastrais de empresa pelo CNPJ usando BrasilAPI
 * com fallback automático para Minha Receita.
 */
export async function fetchCnpjData(cnpj: string): Promise<CnpjData> {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) {
    throw new Error('CNPJ deve conter 14 dígitos válidos.');
  }

  // 1. Tenta BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (res.ok) {
      const data = await res.json();
      const addrParts = [
        data.logradouro,
        data.numero && data.numero !== 'SN' ? `nº ${data.numero}` : '',
        data.complemento,
        data.bairro ? `Bairro ${data.bairro}` : '',
      ].filter(Boolean);

      const cityState = [data.municipio, data.uf].filter(Boolean).join('/');

      return {
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        logradouro: addrParts.join(', '),
        cidadeUf: cityState,
        cep: data.cep || '',
        email: data.email || '',
        telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
        cnaeDescricao: data.cnae_fiscal_descricao || '',
      };
    }
  } catch {
    // Segue para fallback em caso de erro de rede ou servidor
  }

  // 2. Fallback: Minha Receita
  try {
    const res2 = await fetch(`https://minhareceita.org/${clean}`);
    if (res2.ok) {
      const data = await res2.json();
      const addrParts = [
        data.logradouro,
        data.numero && data.numero !== 'SN' ? `nº ${data.numero}` : '',
        data.complemento,
        data.bairro ? `Bairro ${data.bairro}` : '',
      ].filter(Boolean);

      const cityState = [data.municipio, data.uf].filter(Boolean).join('/');

      return {
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        logradouro: addrParts.join(', '),
        cidadeUf: cityState,
        cep: data.cep || '',
        email: data.email || '',
        telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
        cnaeDescricao: data.cnae_fiscal_descricao || '',
      };
    }
  } catch {
    // Ambas falharam
  }

  throw new Error('Não foi possível localizar os dados deste CNPJ na Receita Federal.');
}
