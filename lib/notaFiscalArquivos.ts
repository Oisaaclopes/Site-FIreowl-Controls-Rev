import { getSupabaseClient } from './supabaseClient';
import type { NotaFiscalAnexo } from './types';
import type { NfAnexoTipo } from './notaFiscalXml';

export * from './notaFiscalXml';

/**
 * Anexos da nota fiscal (XML + PDF/DANFE) no bucket PRIVADO `notas-fiscais`
 * (migration 0121 — só ADMINISTRATIVO/FINANCEIRO/GESTOR).
 *
 * O XML é o documento fiscal com validade jurídica (guarda obrigatória); o PDF
 * é só a representação para leitura/envio ao cliente. Do XML lemos nº, data,
 * valor e chave de acesso para preencher o registro sem digitação.
 * Metadados ficam no JSONB do pedido (`proposal.notaFiscal.anexos`).
 */

export const NF_BUCKET = 'notas-fiscais';
const amigavel = (e: any): Error => {
  const msg = String(e?.message || e || '');
  if (/bucket not found/i.test(msg)) {
    return new Error('Armazenamento de notas fiscais ainda não habilitado (migration 0121 pendente).');
  }
  if (/row-level security|unauthorized|403/i.test(msg)) {
    return new Error('Seu perfil não tem permissão para anexar notas fiscais.');
  }
  return new Error(msg || 'Falha ao enviar o arquivo da nota.');
};

/** Envia o arquivo e devolve o metadado para gravar no pedido. */
export async function uploadNotaFiscalAnexo(pedidoId: string, file: File, tipo: NfAnexoTipo): Promise<NotaFiscalAnexo> {
  const sb = getSupabaseClient() as any;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100) || `nota.${tipo}`;
  const path = `${pedidoId.replace(/[^a-zA-Z0-9_-]+/g, '_')}/${Date.now()}_${safe}`;
  const contentType = tipo === 'xml' ? 'application/xml' : 'application/pdf';
  const { error } = await sb.storage.from(NF_BUCKET).upload(path, file, { upsert: false, contentType });
  if (error) throw amigavel(error);
  return { path, nome: file.name, tamanho: file.size, enviadoEm: new Date().toISOString() };
}

export async function signedNotaFiscalUrl(path: string, expiresSeconds = 120): Promise<string> {
  const sb = getSupabaseClient() as any;
  const { data, error } = await sb.storage.from(NF_BUCKET).createSignedUrl(path, expiresSeconds);
  if (error) throw amigavel(error);
  return data.signedUrl as string;
}

/** Remoção best-effort (troca de arquivo / falha ao salvar). */
export async function removerNotaFiscalAnexos(paths: string[]): Promise<void> {
  const validos = paths.filter(Boolean);
  if (!validos.length) return;
  try {
    const sb = getSupabaseClient() as any;
    await sb.storage.from(NF_BUCKET).remove(validos);
  } catch { /* best-effort */ }
}
