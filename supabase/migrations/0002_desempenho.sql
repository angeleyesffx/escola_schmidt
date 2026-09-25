-- Escola Schmidt — controle de desempenho
-- Rodar em: Supabase > SQL Editor, depois de 0001_schema.sql

-- ---------------------------------------------------------------------------
-- Habilidades avaliáveis e registros de avaliação por aluno
-- ---------------------------------------------------------------------------

create type nivel_desempenho as enum ('precisa_melhorar', 'conforme_esperado', 'excelente');

-- Catálogo simplificado de habilidades, inspirado nos regulamentos oficiais
-- de patinação artística — não é a lista de elementos de competição, é uma
-- versão reduzida pra acompanhamento de treino interno.
create table habilidades (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  ordem  smallint not null default 0,
  ativo  boolean not null default true
);

insert into habilidades (nome, ordem) values
  ('Equilíbrio e postura', 1),
  ('Impulsos e propulsão', 2),
  ('Giros e corrupios', 3),
  ('Saltos', 4),
  ('Sequência de passos', 5),
  ('Figuras de alongamento', 6),
  ('Freio e controle de velocidade', 7),
  ('Musicalidade e apresentação', 8);

create table avaliacoes_desempenho (
  id             uuid primary key default gen_random_uuid(),
  aluno_id       uuid not null references alunos (id) on delete cascade,
  habilidade_id  uuid not null references habilidades (id) on delete restrict,
  data           date not null default current_date,
  nivel          nivel_desempenho not null,
  observacoes    text,
  registrado_por uuid references perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  -- Reavaliar a mesma habilidade no mesmo dia sobrescreve, não duplica.
  unique (aluno_id, habilidade_id, data)
);

create index on avaliacoes_desempenho (aluno_id, data desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table habilidades           enable row level security;
alter table avaliacoes_desempenho enable row level security;

-- Habilidades: catálogo fixo, todo mundo autenticado lê; só equipe altera.
create policy habilidade_leitura on habilidades
  for select using (auth.uid() is not null);
create policy habilidade_escrita on habilidades
  for all using (eh_equipe()) with check (eh_equipe());

-- Avaliações: mesmo padrão de testes_nivel — equipe vê e edita tudo,
-- aluno só lê as próprias.
create policy avaliacao_leitura on avaliacoes_desempenho
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );
create policy avaliacao_escrita on avaliacoes_desempenho
  for all using (eh_equipe()) with check (eh_equipe());

grant select on public.habilidades to anon;
grant select, insert, update, delete on public.habilidades to authenticated;
grant select, insert, update, delete on public.habilidades to service_role;

grant select on public.avaliacoes_desempenho to anon;
grant select, insert, update, delete on public.avaliacoes_desempenho to authenticated;
grant select, insert, update, delete on public.avaliacoes_desempenho to service_role;
