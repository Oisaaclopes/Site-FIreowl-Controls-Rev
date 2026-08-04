import { getSupabaseClient } from './supabaseClient';

const BUCKET = 'employee-docs';

export interface EmployeeDoc {
  name: string; // nome do arquivo (sem a pasta)
  path: string; // caminho completo: <user_id>/arquivo
}

// Lista os documentos de um funcionário (pasta = id do usuário)
export async function listEmployeeDocs(userId: string): Promise<EmployeeDoc[]> {
  const s = getSupabaseClient() as any;
  const { data, error } = await s.storage.from(BUCKET).list(userId, {
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;
  return (data || [])
    .filter((f: any) => f.id) // ignora entradas de pasta
    .map((f: any) => ({ name: f.name as string, path: `${userId}/${f.name}` }));
}

// Envia um documento para a pasta do funcionário
export async function uploadEmployeeDoc(userId: string, file: File): Promise<void> {
  const s = getSupabaseClient() as any;
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${userId}/${Date.now()}_${safe}`;
  const { error } = await s.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
}

// URL assinada temporária (padrão 2 min) para abrir/baixar o documento
export async function signedDocUrl(path: string, expiresSeconds = 120): Promise<string> {
  const s = getSupabaseClient() as any;
  const { data, error } = await s.storage.from(BUCKET).createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl as string;
}

export async function deleteEmployeeDoc(path: string): Promise<void> {
  const s = getSupabaseClient() as any;
  const { error } = await s.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
