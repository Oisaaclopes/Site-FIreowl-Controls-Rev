import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKUP_DISCLAIMER, TECHNICAL_BACKUP_BUCKET } from './technicalBackups';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const credLib = read('lib/clientCredentials.ts');
const bkpLib = read('lib/technicalBackups.ts');
const cred0096 = read('lib/db/migrations/0096_client_technical_credentials.sql');
const bkp0097 = read('lib/db/migrations/0097_technical_backups.sql');

describe('Credenciais — o segredo nunca vaza em consulta genérica (§65/§100/§110)', () => {
  it('a listagem seleciona colunas explícitas, nunca select(*) que arraste segredo', () => {
    expect(credLib).not.toMatch(/from\(META\)\s*\n?\s*\.select\('\*'\)/);
    expect(credLib).toContain("select('id,cliente_id,device_id,area,label,username,notes,created_by,created_at')");
  });
  it('a metadata NÃO tem coluna de segredo; o segredo vive em tabela isolada', () => {
    expect(credLib).toContain("const META = 'client_technical_credentials'");
    expect(credLib).toContain("const SECRETS = 'client_technical_credential_secrets'");
    // nenhuma leitura de "secret" a partir da metadata
    expect(credLib).not.toMatch(/from\(META\)[\s\S]{0,80}secret/);
  });
  it('revelar segredo é via RPC dedicada (não por SELECT direto)', () => {
    expect(credLib).toContain("rpc('reveal_technical_credential'");
    expect(credLib).not.toMatch(/from\(SECRETS\)[\s\S]{0,40}\.select/);
  });
  it('migração 0096: SELECT do segredo restrito a ADMIN/GESTOR e RPC security definer', () => {
    expect(cred0096).toMatch(/cred secret select[\s\S]{0,200}ADMINISTRATIVO','GESTOR'\)/);
    expect(cred0096).toContain('security definer');
    expect(cred0096).toMatch(/reveal_technical_credential[\s\S]{0,400}sem permissao para revelar/);
  });
});

describe('Backups — armazenamento seguro; nunca interpreta/executa; bucket privado (§3D.EXTRA)', () => {
  it('bucket dedicado e privado', () => {
    expect(TECHNICAL_BACKUP_BUCKET).toBe('technical-backups');
    expect(bkp0097).toContain("('technical-backups', 'technical-backups', false)");
  });
  it('download por signed URL — storage_path nunca vira URL pública', () => {
    expect(bkpLib).toContain('createSignedUrl');
    expect(bkpLib).not.toContain('getPublicUrl');
  });
  it('upload sem upsert — cada versão é um objeto novo (não sobrescreve)', () => {
    expect(bkpLib).toContain('upsert: false');
  });
  it('não interpreta/executa/converte o arquivo (sem parse/exec/JSON.parse do conteúdo)', () => {
    expect(bkpLib).not.toMatch(/\.text\(\)\s*\)/);
    expect(bkpLib).not.toContain('eval(');
    expect(bkpLib).not.toContain('child_process');
  });
  it('disclaimer obrigatório presente e completo', () => {
    expect(BACKUP_DISCLAIMER).toContain('não valida, executa ou garante compatibilidade');
  });
});
