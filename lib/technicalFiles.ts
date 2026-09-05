import type { Device } from './types';
import { TechArea, assetDisplayIdentifier, legacyGroupLabel } from './technicalBase';

/* ===================================================================
 * ARQUIVOS TÉCNICOS (backups/programações/configurações) — apresentação.
 * SÓ camada de UI: rótulos e ícones amigáveis para os `backup_type` já
 * existentes (valores gravados PRESERVADOS — nada de enum novo, §5/§17).
 * Puro e testável. NÃO altera storage/versionamento/hash (§15/§19).
 * =================================================================== */

export interface FileTypeOption { value: string; label: string; icon: string }

/** Tipos de arquivo — `value` = backup_type gravado; label/icon são só UI. */
export const FILE_TYPES: FileTypeOption[] = [
  { value: 'BACKUP_COMPLETO', label: 'Backup completo', icon: 'archive' },
  { value: 'PROGRAMACAO', label: 'Programação', icon: 'code' },
  { value: 'BASE_DISPOSITIVOS', label: 'Base de dispositivos', icon: 'account_tree' },
  { value: 'CONFIGURACAO', label: 'Configuração', icon: 'settings' },
  { value: 'EXPORTACAO', label: 'Exportação', icon: 'file_export' },
  { value: 'OUTRO', label: 'Outro', icon: 'description' },
];

export const fileTypeLabel = (v?: string): string =>
  FILE_TYPES.find((t) => t.value === v)?.label || (v ? v.replace(/_/g, ' ') : 'Arquivo');

export const fileTypeIcon = (v?: string): string =>
  FILE_TYPES.find((t) => t.value === v)?.icon || 'description';

export const fmtFileSize = (n?: number): string =>
  n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

/** Rótulo contextual do equipamento para o vínculo do arquivo (§8). */
export function deviceOptionLabel(d: Device): string {
  const ident = assetDisplayIdentifier(d.sistema as TechArea, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
  const grp = legacyGroupLabel(d.sistema, d.grupo) || d.tipoAtivo || d.tipoDispositivo || 'Ativo';
  const fm = [d.fabricante, d.modelo].filter(Boolean).join(' ');
  return [grp, fm, ident].filter(Boolean).join(' · ') || d.id;
}
