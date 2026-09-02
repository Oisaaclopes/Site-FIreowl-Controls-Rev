# Versionamento de templates de relatório (CAMPO 2B)

## Princípio

- **TEMPLATE** = definição reutilizável e evolutiva (`report_templates`, sempre a
  versão **vigente** por código).
- **RELATÓRIO** = registro histórico **imutável** da estrutura usada no
  atendimento (`reports.template_snapshot` + `reports.template_version`).

Evoluir um template **nunca** reinterpreta relatórios antigos: cada relatório
carrega seu próprio snapshot. O histórico fiel vive no snapshot, não na tabela de
templates.

## Como alterar um template (processo obrigatório)

1. Edite o schema em `lib/reportTemplatesData.ts` (seções, campos, condicionais).
2. **INCREMENTE `versao`** no objeto do template:
   ```ts
   export const LEVANTAMENTO_SDAI: TemplateSchema = {
     codigo: 'LEVANTAMENTO_SDAI',
     versao: 2, // era 1 — bump obrigatório ao mudar o schema
     ...
   };
   ```
3. Faça deploy. Um **ADMINISTRATIVO** abre a aba **Relatórios** uma vez: o seed
   (`seedReportTemplates`) publica a nova versão de forma **não-destrutiva**
   (`publishTemplate`).

### O que o seed faz (`publishTemplate`)

| Situação                                             | Resultado    |
|------------------------------------------------------|--------------|
| Coluna `schema_hash` ausente (0075 não aplicada)     | `unsupported` (no-op seguro) |
| Código novo                                          | `inserted`   |
| Mesma versão + **mesmo** schema                      | `noop`       |
| Mesma versão + `schema_hash` NULL (linha pré-versão) | `aligned` (adota o schema do código uma vez, baseline) |
| Mesma versão + schema **diferente** (baseline já existe) | `conflict` (NÃO sobrescreve — **exige bump**) |
| Código com versão **maior** que a do banco           | `advanced` (publica a nova vigente) |
| Banco à frente do código                             | `behind` (não regride) |

> **Nunca** mude o schema mantendo a mesma `versao`: o seed recusa (`conflict`) e
> alerta no console. Isso protege a rastreabilidade.

## O que acontece com os relatórios

- **Novo relatório** → congela a versão vigente no `template_snapshot` ao iniciar.
- **Draft** (localStorage) → guarda o snapshot; reabrir mantém a versão inicial,
  mesmo que o template evolua no meio (online/offline).
- **Finalizado** → snapshot imutável (trigger `reports_freeze_template_snapshot`
  permite preencher quando NULL, impede alteração posterior).
- **Legado sem snapshot** → `resolveReportTemplate` cai para o template vigente
  por código (fallback de runtime, `source: 'legacy_current'`, `version: null` —
  não inventamos a versão histórica).

## Momento do snapshot

O relatório só é inserido no banco na **finalização** (bundle offline). O snapshot
é **congelado no início da sessão** (localStorage), viaja no bundle e é persistido
em `reports` no fim (best-effort: se a 0075 ainda não estiver aplicada, o
relatório fica legado e nada quebra).

## Resolução canônica

Sempre use `resolveReportTemplate(report, ALL_TEMPLATES)` (em
`lib/reportTemplateVersioning.ts`) para obter a definição de um relatório — nunca
`report.template_snapshot || currentTemplate` espalhado pelos componentes.
