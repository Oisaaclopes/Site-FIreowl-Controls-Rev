// Chamada da Edge Function `gerar-orcamento` (Orçamento com IA — Fase 1).
// O JWT do usuário vai automaticamente no functions.invoke; a função valida o
// perfil (ADMINISTRATIVO/GESTOR) e lê os cadastros respeitando o RLS.
import { getSupabaseClient } from './supabaseClient';

const MENSAGENS: Record<string, string> = {
  unauthorized: 'Sessão expirada. Entre novamente no sistema.',
  forbidden: 'Seu perfil não tem acesso ao Orçamento com IA (apenas Administrativo e Gestor).',
  ai_not_configured: 'A IA ainda não foi configurada no servidor (falta a chave ANTHROPIC_API_KEY nos Secrets do Supabase).',
  texto_curto: 'Descreva o orçamento com mais detalhes.',
  texto_longo: 'O texto é grande demais. Divida em partes menores.',
  limite_diario: 'Limite diário de gerações com IA atingido. Tente amanhã.',
  cadastro_indisponivel: 'Não foi possível ler clientes e produtos agora. Tente novamente.',
  ia_ocupada: 'A IA está ocupada no momento. Aguarde um minuto e tente de novo.',
  ia_falhou: 'A IA não respondeu. Tente novamente em instantes.',
  ia_recusou: 'A IA não conseguiu montar este orçamento. Revise o texto e tente de novo.',
  plano_grande_demais: 'O orçamento ficou grande demais para uma geração. Divida em partes menores.',
  plano_invalido: 'A IA devolveu um plano em formato inválido. Tente novamente.',
};

export async function gerarPlanoOrcamento(texto: string): Promise<unknown> {
  const supabase = getSupabaseClient() as any;
  const { data, error } = await supabase.functions.invoke('gerar-orcamento', { body: { texto } });
  if (error) {
    let codigo = '';
    try { codigo = (await error.context?.json?.())?.error || ''; } catch { /* resposta sem JSON */ }
    throw new Error(MENSAGENS[codigo] || 'Não foi possível gerar o plano agora (tempo esgotado ou falha de rede). Tente novamente.');
  }
  if (!data?.plano) throw new Error(MENSAGENS.plano_invalido);
  return data.plano;
}
