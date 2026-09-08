import type { FieldSchema, RepeaterCard } from './reportSchema';

const SINGULAR_LABELS: Record<string, string> = {
  'Dispositivos': 'Dispositivo',
  'Dispositivos em alarme': 'Dispositivo em alarme',
  'Dispositivos desabilitados': 'Dispositivo desabilitado',
  'Falhas': 'Falha',
  'Intervenções': 'Intervenção',
  'Apontamentos': 'Apontamento',
  'Pendências': 'Pendência',
  'Laços': 'Laço',
  'Baterias': 'Bateria',
};

export function repeaterItemLabel(field: Pick<FieldSchema, 'label' | 'item_label'>): string {
  const label = (field.item_label || field.label || 'Item').trim();
  return SINGULAR_LABELS[label] || label.replace(/ões$/i, 'ão').replace(/s$/i, '') || 'Item';
}

export function numberedRepeaterLabel(field: Pick<FieldSchema, 'label' | 'item_label'>, index: number): string {
  return `${repeaterItemLabel(field)} ${index + 1}`;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

export function summarizeRepeaterCard(card: RepeaterCard, schema: FieldSchema[]): string {
  const parts: string[] = [];
  const add = (value: unknown) => {
    const v = text(value);
    if (v && !parts.includes(v)) parts.push(v);
  };

  add(card.dispositivo_perfil || card.dispositivo || card.tipo || card.identificacao);
  const loop = text(card.laco);
  const address = text(card.endereco);
  if (loop) add(/^l(a|ç)o\b/i.test(loop) ? loop : `L${loop}`);
  if (address) add(/^end\.?\b/i.test(address) ? address : `End. ${address}`);
  add(card.codigo);
  add(card.local || card.localizacao);
  add(card.resultado || card.condicao || card.status);

  if (parts.length < 2) {
    for (const field of schema) {
      if (['foto', 'assinatura', 'select_falha'].includes(field.tipo) || field.multilinha) continue;
      if (['device_id', 'inventory_item_id', 'base_status', 'pertence_central'].includes(field.key)) continue;
      add(card[field.key]);
      if (parts.length >= 5) break;
    }
  }
  return parts.slice(0, 5).join(' · ');
}

export function missingRepeaterPhotoMessage(
  field: Pick<FieldSchema, 'label' | 'item_label'>,
  index: number,
  photoLabel = 'Foto',
): string {
  const item = numberedRepeaterLabel(field, index);
  const kind = photoLabel.toLocaleLowerCase('pt-BR');
  return `Adicione ${kind === 'foto' ? 'uma foto' : `a ${kind}`} do ${item} antes de avançar.`;
}
