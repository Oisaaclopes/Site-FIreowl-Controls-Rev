import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// LGPD: mascara o CPF na exibição, revelando apenas os 2 dígitos verificadores
// (não identificam a pessoa). Ex.: "123.456.789-09" -> "***.***.***-09".
export function maskCpf(cpf?: string | null): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length < 11) return '***.***.***-**'; // parcial/ inválido: mascara tudo
  return `***.***.***-${d.slice(9, 11)}`;
}
