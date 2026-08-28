import { getSupabaseClient } from './supabaseClient';

export type VerificationDocumentType = 'relatorio' | 'proposta' | 'ordem_servico';

export interface DocumentVerificationInput {
  type: VerificationDocumentType;
  sourceId: string;
  number: string;
  clientName: string;
  issuedAt?: string;
  status?: string;
  version?: string;
}

export interface PublicDocumentVerification extends DocumentVerificationInput {
  code: string;
}

const normalizar = (value: string) => (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-24) || 'SEMID';

/** Código estável: o mesmo relatório sempre aponta para a mesma validação. */
export const verificationCode = (type: VerificationDocumentType, sourceId: string) => `FOWL-${type.slice(0, 3).toUpperCase()}-${normalizar(sourceId)}`;

export const verificationUrl = (type: VerificationDocumentType, sourceId: string) => {
  const code = verificationCode(type, sourceId);
  const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
  return `${base}/verificar?codigo=${encodeURIComponent(code)}`;
};

/** Publica somente metadados mínimos para a página pública de autenticidade. */
export async function publishDocumentVerification(input: DocumentVerificationInput): Promise<PublicDocumentVerification> {
  const record: PublicDocumentVerification = { ...input, code: verificationCode(input.type, input.sourceId) };
  const supabase = getSupabaseClient() as any;
  const { error } = await supabase.from('document_verifications').upsert({
    code: record.code,
    document_type: record.type,
    source_id: record.sourceId,
    document_number: record.number,
    client_name: record.clientName,
    issued_at: record.issuedAt || null,
    status: record.status || null,
    version: record.version || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'code' });
  if (error) throw error;
  return record;
}

export async function findPublicDocumentVerification(code: string): Promise<PublicDocumentVerification | null> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase
    .from('document_verifications')
    .select('code,document_type,source_id,document_number,client_name,issued_at,status,version')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    code: data.code,
    type: data.document_type,
    sourceId: data.source_id,
    number: data.document_number,
    clientName: data.client_name,
    issuedAt: data.issued_at || undefined,
    status: data.status || undefined,
    version: data.version || undefined,
  } as PublicDocumentVerification;
}
