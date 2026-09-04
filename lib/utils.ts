import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Extrai o nome fantasia de um nome no formato "Razão (Fantasia)"; senão, usa o nome todo. */
export function nomeFantasiaCliente(clienteNome?: string): string {
  if (!clienteNome) return '';
  const m = clienteNome.match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : clienteNome).trim();
}

/** Remove o parêntese "(Fantasia)" do fim, devolvendo a razão social/nome cadastral. */
export function razaoSocialCliente(clienteNome?: string): string {
  return (clienteNome || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * ETAPA 3B.1 (correção) — FONTE CANÔNICA do nome do cliente em INTERFACES
 * OPERACIONAIS (cards, listas, OS, atendimento, agenda…). Convenção de dados
 * confirmada: `clients.name` é gravado como "Razão Social (Nome Fantasia)"
 * (ver CrmView). Aqui devolvemos o NOME FANTASIA; sem fantasia, cai para a
 * razão/nome cadastral (nunca vazio). Aceita a entidade Client, um objeto
 * com `name`, ou a própria string — para telas que só recebem o nome.
 *
 * Para documentos FORMAIS/FISCAIS/CADASTRAIS use `getClientLegalName`.
 */
export function getClientOperationalName(
  client: { name?: string } | string | null | undefined,
  fallback = 'Cliente'
): string {
  const name = typeof client === 'string' ? client : client?.name;
  return nomeFantasiaCliente(name || undefined) || fallback;
}

/** Nome FORMAL do cliente (razão social) para documentos/cadastro. */
export function getClientLegalName(
  client: { name?: string } | string | null | undefined,
  fallback = ''
): string {
  const name = typeof client === 'string' ? client : client?.name;
  return razaoSocialCliente(name || undefined) || fallback;
}

/** Slug seguro para nome de arquivo (sem acentos, espaços viram "_"). */
export function slugArquivo(s?: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Nome de arquivo PDF padronizado: Tipo-NUMERO-NomeFantasia.pdf */
export function nomeArquivoPdf(tipo: string, numero: string, clienteNome?: string): string {
  const fant = slugArquivo(nomeFantasiaCliente(clienteNome));
  return `${tipo}-${numero}${fant ? `-${fant}` : ''}.pdf`;
}

// LGPD: mascara o CPF na exibição, revelando apenas os 2 dígitos verificadores
// (não identificam a pessoa). Ex.: "123.456.789-09" -> "***.***.***-09".
export function maskCpf(cpf?: string | null): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length < 11) return '***.***.***-**'; // parcial/ inválido: mascara tudo
  return `***.***.***-${d.slice(9, 11)}`;
}
