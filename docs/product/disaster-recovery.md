# Plano de Disaster Recovery — Supabase

Documento operacional: o que fazer se o projeto Supabase de producao ficar indisponivel,
tiver dados corrompidos/apagados por engano, ou precisar ser migrado para outro provedor.

## 1. O que depende do Supabase hoje

| Camada | Uso | Onde |
|---|---|---|
| Auth | Login e-mail/senha, convites, reset de senha | `src/lib/supabase.ts`, `src/features/auth/` |
| Postgres (schema + RLS + triggers + RPCs) | ~25 tabelas, ~15 RPCs, regras de negocio criticas em funcoes/triggers | `supabase/migrations/0001`-`0047` |
| Storage | Bucket `avatars` (fotos de perfil/alunos) | `src/features/perfil/api.ts` |
| Edge Functions (Deno) | Convites com privilegio de service role | `supabase/functions/convidar-aluno`, `supabase/functions/convidar-usuario` |
| Realtime | Nao usado | - |

Regras de negocio que so existem como funcao/trigger no Postgres (nao tem equivalente no
app) e por isso exigem atencao redobrada em qualquer migracao de banco:
`0010_registrar_avaliacao_evolucao_rpc.sql`, `0035_trava_autoavaliacao_evolucao.sql`,
`0036_marcar_presenca_atomico.sql`, `0037_confirmacao_vinculo_responsavel.sql`,
`0043_sobrescreve_avaliacao_evolucao_no_dia.sql`, `0047_data_agendamento_futura.sql`.

## 2. Backup automatizado

Workflow: [.github/workflows/supabase-backup.yml](../../.github/workflows/supabase-backup.yml)

- Roda todo dia as 03:00 UTC (`workflow_dispatch` tambem disponivel para rodar manualmente).
- Gera `supabase db dump` (schema + dados) e baixa todos os objetos do bucket `avatars`.
- Publica os dois num `.tar.gz` como GitHub Release privado (`backup-YYYY-MM-DD-HHMM`).
- Requer secrets no repositorio: `SUPABASE_DB_URL` (connection string do Postgres, com senha),
  `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (para o export do storage).

RPO alvo: 24h (um backup por dia). RTO alvo: poucas horas, restaurando num novo projeto Supabase
(secao 3). Se o requisito de RPO diminuir, aumentar a frequencia do cron.

## 3. Restaurar em um novo projeto Supabase (cenario mais comum)

1. Criar um novo projeto no dashboard do Supabase (ou `supabase projects create`).
2. `supabase link --project-ref <novo-ref>`.
3. Baixar o Release de backup mais recente e extrair o `.tar.gz`.
4. Restaurar o schema+dados: `psql "<novo-db-url>" -f backup/database.sql`.
5. Recriar o bucket `avatars` no novo projeto e reenviar os arquivos extraidos
   (`backup/storage/avatars/**`) via `supabase storage` ou script com service role key.
6. Reimplantar as Edge Functions: `supabase functions deploy convidar-aluno` e
   `convidar-usuario`; configurar `SUPABASE_SECRET_KEY` via `supabase secrets set`.
7. Atualizar `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (EAS secrets / `.env`)
   para o novo projeto e gerar um novo build.
8. Validar antes de apontar producao para o novo projeto: `npm run test`, login manual, e uma
   RPC critica (ex.: `marcar_presenca`, `registrar_avaliacao_evolucao`).

## 4. Plano B — self-host / troca de provedor (alto nivel)

Cenario de ultima instancia (Supabase deixa de existir ou de ser viavel). Nao e um "lift and
shift" trivial por causa do acoplamento a RLS/triggers/RPCs e ao Auth do Supabase — e reescrita,
nao copia.

- **Postgres**: qualquer Postgres gerenciado (RDS, Neon, Cloud SQL) ou self-host via
  `docker compose` (o proprio `supabase start` local ja usa essa stack) roda o schema das
  migrations sem mudanca, incluindo RLS/triggers/RPCs.
- **Auth**: GoTrue (o servidor de auth do Supabase) e open source e pode rodar standalone; a
  alternativa e reimplementar login/sessao com outra solucao (ex.: Auth.js), o que exige revisar
  todo `src/features/auth/`.
- **Storage**: a Storage API do Supabase tambem e open source (self-host) ou trocar por S3/R2
  direto, ajustando `src/features/perfil/api.ts` (upload/remove/getPublicUrl).
- **Edge Functions**: sao Deno; portam para Deno Deploy, Supabase self-hosted, ou reescrita em
  Node/outra serverless.
- Esforco esperado: dias a semanas, nao horas — priorizar sempre a restauracao em novo projeto
  Supabase (secao 3) antes de considerar essa rota.

## 5. Observacao de privacidade

O backup inclui fotos de alunos (bucket `avatars`) e dados de contas. O Release do GitHub e
privado, mas antes de manter esse fluxo em producao, confirmar se isso atende aos requisitos de
privacidade/LGPD do projeto (considerar criptografar o `.tar.gz` antes do upload se necessario).
