-- Escola Schmidt — aula teste aceita candidato ainda não matriculado
-- Rodar em: Supabase > SQL Editor, depois de 0026_aula_particular_autoatendimento.sql

-- Refinamento de requisitos de 2026-09-20 (docs/product/chamada-agenda-frequencia.md
-- secao 7). Estado atual confirmado: nova-teste.tsx usa um Dropdown alimentado por
-- getAlunos() (só matriculados/ativos) — o oposto do requisito real, que é oferecer
-- aula teste pra quem ainda não é aluno. aulas_teste_alunos.aluno_id (0018) é FK
-- not null pra alunos(id), então hoje é literalmente impossível cadastrar um
-- candidato sem registro prévio.
--
-- Decisões registradas (seção 7.2):
-- 3. Presença do candidato é só informativa (rótulo "Aula Experimental" na
--    chamada, sem gravar presença formal) — candidato não matriculado não
--    tem registro em `alunos`, então não há onde guardar presença sem um
--    redesenho maior; a decisão evita esse redesenho.
-- 4. Continua aceitando vários candidatos por aula teste — só troca a fonte
--    (texto livre em vez de dropdown de matriculados).
--
-- Sem dado de produção em aulas_teste_alunos ainda (feature nunca foi usada
-- em uso real, banco recém-populado nesta mesma rodada de sessões) — troca
-- direta de tabela, sem migração de dados.

drop table aulas_teste_alunos;

create table aulas_teste_candidatos (
  id            uuid primary key default gen_random_uuid(),
  aula_teste_id uuid not null references aulas_teste (id) on delete cascade,
  nome          text not null,
  telefone      text,
  criado_em     timestamptz not null default now()
);

create index on aulas_teste_candidatos (aula_teste_id);

alter table aulas_teste_candidatos enable row level security;

-- Mesmo espírito de aulas_teste (0018): staff-only, escopado por quem
-- responde pelo horário (sou_responsavel_pela_aula) — candidato não tem
-- login, então não existe papel "candidato" acessando isso.
create policy aula_teste_candidatos_leitura on aulas_teste_candidatos
  for select using (eh_equipe());

create policy aula_teste_candidatos_escrita on aulas_teste_candidatos
  for all using (
    exists (
      select 1 from aulas_teste at_
       where at_.id = aula_teste_id and sou_responsavel_pela_aula(at_.aula_recorrente_id)
    )
  ) with check (
    exists (
      select 1 from aulas_teste at_
       where at_.id = aula_teste_id and sou_responsavel_pela_aula(at_.aula_recorrente_id)
    )
  );
