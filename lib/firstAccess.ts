import { checkPassword } from './password';

export function validateFirstAccessPasswords(password: string, confirmation: string): string | null {
  if (!checkPassword(password).ok) return 'A senha ainda não atende a todos os requisitos.';
  if (password !== confirmation) return 'As senhas não coincidem.';
  return null;
}
