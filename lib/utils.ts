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
