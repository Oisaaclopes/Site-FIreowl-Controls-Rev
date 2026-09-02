-- Vincula ajustes à evidência original e registra autoria da revisão.
-- Não altera time_punches: punched_at continua sendo o valor original.
alter table public.punch_adjustments
  add column if not exists original_punch_id uuid references public.time_punches(id) on delete restrict,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewer_name text;

create index if not exists punch_adj_original_idx
  on public.punch_adjustments (original_punch_id);

-- Uma batida não pode ter duas correções aprovadas concorrentes. Ajustes
-- históricos sem vínculo continuam legíveis pelo resolvedor compatível.
create unique index if not exists punch_adj_one_approved_per_punch_idx
  on public.punch_adjustments (original_punch_id)
  where status = 'APROVADO' and original_punch_id is not null;
