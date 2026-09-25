-- Escola Schmidt — eventos do calendário (recesso, competição, feriado, etc.)
-- Rodar em: Supabase > SQL Editor, depois de 0002_desempenho.sql

-- Catálogo de tipos de evento com cor própria — tabela, não enum, pra dar
-- pra escola ajustar/adicionar tipo sem precisar de migração nova.
create table tipos_evento (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  cor    text not null, -- hex, ex: '#8B5CF6'
  ordem  smallint not null default 0,
  ativo  boolean not null default true
);

insert into tipos_evento (nome, cor, ordem) values
  ('Recesso', '#8B5CF6', 1),
  ('Treino especial', '#00B4CC', 2),
  ('Competição', '#F97316', 3),
  ('Ausência de professor', '#C4453D', 4),
  ('Feriado', '#1BA97B', 5),
  ('Apresentação', '#D99A2B', 6),
  ('Reunião', '#6B7280', 7);

-- Evento é só um aviso visual no calendário — não cancela nem interfere na
-- grade fixa (aulas_recorrentes) nem na chamada (aulas/presencas).
create table eventos_calendario (
  id           uuid primary key default gen_random_uuid(),
  tipo_id      uuid not null references tipos_evento (id) on delete restrict,
  titulo       text not null,
  data_inicio  date not null,
  data_fim     date not null,
  descricao    text,
  criado_por   uuid references perfis (id) on delete set null,
  criado_em    timestamptz not null default now(),
  constraint periodo_valido check (data_fim >= data_inicio)
);

create index on eventos_calendario (data_inicio, data_fim);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table tipos_evento       enable row level security;
alter table eventos_calendario enable row level security;

-- Mesmo padrão de aulas_recorrentes: todo mundo autenticado lê, só equipe altera.
create policy tipo_evento_leitura on tipos_evento
  for select using (auth.uid() is not null);
create policy tipo_evento_escrita on tipos_evento
  for all using (eh_equipe()) with check (eh_equipe());

create policy evento_leitura on eventos_calendario
  for select using (auth.uid() is not null);
create policy evento_escrita on eventos_calendario
  for all using (eh_equipe()) with check (eh_equipe());

grant select on public.tipos_evento to anon;
grant select, insert, update, delete on public.tipos_evento to authenticated;
grant select, insert, update, delete on public.tipos_evento to service_role;

grant select on public.eventos_calendario to anon;
grant select, insert, update, delete on public.eventos_calendario to authenticated;
grant select, insert, update, delete on public.eventos_calendario to service_role;
