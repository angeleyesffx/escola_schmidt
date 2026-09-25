-- Escola Schmidt — base catalogável para Minha Evolucao
-- Rodar em: Supabase > SQL Editor, depois de 0006_professor_visivel_para_aluno.sql

-- Esta migracao nao substitui a estrutura simplificada de desempenho existente.
-- Ela cria a base nova em paralelo para suportar:
-- - catalogo flexivel de habilidades
-- - metodologia versionada por temporada
-- - niveis e requisitos configuraveis
-- - pre-requisitos entre habilidades
-- - atribuicao de metodologia ao aluno sem reescrever historico

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type status_habilidade_evolucao as enum (
  'nao_iniciado',
  'aprendendo',
  'em_desenvolvimento',
  'dominado',
  'consolidado'
);

-- ---------------------------------------------------------------------------
-- Catalogo pedagogico
-- ---------------------------------------------------------------------------

create table modalidades_evolucao (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  descricao  text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table categorias_habilidade (
  id             uuid primary key default gen_random_uuid(),
  modalidade_id  uuid not null references modalidades_evolucao (id) on delete cascade,
  nome           text not null,
  slug           text not null,
  descricao      text,
  ordem          smallint not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  unique (modalidade_id, slug)
);

create index on categorias_habilidade (modalidade_id, ordem);

create table habilidades_catalogo (
  id                  uuid primary key default gen_random_uuid(),
  categoria_id        uuid not null references categorias_habilidade (id) on delete cascade,
  nome                text not null,
  slug                text not null,
  nome_internacional  text,
  descricao           text,
  origem              text,
  temporada_regra     smallint,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  unique (categoria_id, slug)
);

create index on habilidades_catalogo (categoria_id);

create table criterios_habilidade (
  id            uuid primary key default gen_random_uuid(),
  habilidade_id uuid not null references habilidades_catalogo (id) on delete cascade,
  nome          text not null,
  descricao     text,
  ordem         smallint not null default 0,
  peso          numeric(5,2) not null default 1 check (peso > 0),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  unique (habilidade_id, nome)
);

create index on criterios_habilidade (habilidade_id, ordem);

create table prerequisitos_habilidade (
  id                         uuid primary key default gen_random_uuid(),
  habilidade_id              uuid not null references habilidades_catalogo (id) on delete cascade,
  prerequisito_habilidade_id uuid not null references habilidades_catalogo (id) on delete cascade,
  criado_em                  timestamptz not null default now(),
  constraint prerequisito_diferente check (habilidade_id <> prerequisito_habilidade_id),
  unique (habilidade_id, prerequisito_habilidade_id)
);

create index on prerequisitos_habilidade (habilidade_id);
create index on prerequisitos_habilidade (prerequisito_habilidade_id);

-- ---------------------------------------------------------------------------
-- Metodologia e niveis
-- ---------------------------------------------------------------------------

create table metodologias_evolucao (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  slug            text not null unique,
  temporada       smallint not null,
  descricao       text,
  vigencia_inicio date not null,
  vigencia_fim    date,
  ativa           boolean not null default false,
  criado_em       timestamptz not null default now(),
  constraint metodologia_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  unique (nome, temporada)
);

create table niveis_evolucao (
  id              uuid primary key default gen_random_uuid(),
  metodologia_id  uuid not null references metodologias_evolucao (id) on delete cascade,
  nome            text not null,
  descricao       text,
  ordem           smallint not null,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  unique (metodologia_id, nome),
  unique (metodologia_id, ordem)
);

create index on niveis_evolucao (metodologia_id, ordem);

create table requisitos_nivel_evolucao (
  id             uuid primary key default gen_random_uuid(),
  nivel_id       uuid not null references niveis_evolucao (id) on delete cascade,
  habilidade_id  uuid not null references habilidades_catalogo (id) on delete restrict,
  obrigatorio    boolean not null default true,
  peso           numeric(5,2) not null default 1 check (peso > 0),
  nota_minima    numeric(5,2),
  status_minimo  status_habilidade_evolucao not null default 'dominado',
  criado_em      timestamptz not null default now(),
  constraint nota_minima_valida check (nota_minima is null or (nota_minima >= 0 and nota_minima <= 100)),
  unique (nivel_id, habilidade_id)
);

create index on requisitos_nivel_evolucao (nivel_id);
create index on requisitos_nivel_evolucao (habilidade_id);

-- Atribui uma metodologia a um aluno em um periodo. Serve para preservar o
-- contexto pedagogico sem recalcular historico com regras de outra temporada.
create table aluno_metodologias (
  id              uuid primary key default gen_random_uuid(),
  aluno_id        uuid not null references alunos (id) on delete cascade,
  metodologia_id  uuid not null references metodologias_evolucao (id) on delete restrict,
  nivel_atual_id  uuid references niveis_evolucao (id) on delete set null,
  data_inicio     date not null,
  data_fim        date,
  criado_em       timestamptz not null default now(),
  constraint aluno_metodologia_periodo_valido check (data_fim is null or data_fim >= data_inicio)
);

create index on aluno_metodologias (aluno_id, data_inicio desc);
create index on aluno_metodologias (metodologia_id);

create function valida_sobreposicao_aluno_metodologia() returns trigger
language plpgsql as $$
begin
  if new.nivel_atual_id is not null and not exists (
    select 1
      from niveis_evolucao ne
     where ne.id = new.nivel_atual_id
       and ne.metodologia_id = new.metodologia_id
  ) then
    raise exception 'Nivel atual precisa pertencer a metodologia atribuida ao aluno.';
  end if;

  if exists (
    select 1
      from aluno_metodologias am
     where am.aluno_id = new.aluno_id
       and (tg_op = 'INSERT' or am.id <> new.id)
       and daterange(am.data_inicio, coalesce(am.data_fim + 1, 'infinity'::date), '[)')
           && daterange(new.data_inicio, coalesce(new.data_fim + 1, 'infinity'::date), '[)')
  ) then
    raise exception 'Aluno ja possui metodologia atribuida em periodo sobreposto.';
  end if;

  return new;
end;
$$;

create trigger trg_valida_sobreposicao_aluno_metodologia
  before insert or update on aluno_metodologias
  for each row execute function valida_sobreposicao_aluno_metodologia();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table modalidades_evolucao         enable row level security;
alter table categorias_habilidade        enable row level security;
alter table habilidades_catalogo         enable row level security;
alter table criterios_habilidade         enable row level security;
alter table prerequisitos_habilidade     enable row level security;
alter table metodologias_evolucao        enable row level security;
alter table niveis_evolucao              enable row level security;
alter table requisitos_nivel_evolucao    enable row level security;
alter table aluno_metodologias           enable row level security;

grant select on public.modalidades_evolucao to anon;
grant select, insert, update, delete on public.modalidades_evolucao to authenticated;
grant select, insert, update, delete on public.modalidades_evolucao to service_role;

grant select on public.categorias_habilidade to anon;
grant select, insert, update, delete on public.categorias_habilidade to authenticated;
grant select, insert, update, delete on public.categorias_habilidade to service_role;

grant select on public.habilidades_catalogo to anon;
grant select, insert, update, delete on public.habilidades_catalogo to authenticated;
grant select, insert, update, delete on public.habilidades_catalogo to service_role;

grant select on public.criterios_habilidade to anon;
grant select, insert, update, delete on public.criterios_habilidade to authenticated;
grant select, insert, update, delete on public.criterios_habilidade to service_role;

grant select on public.prerequisitos_habilidade to anon;
grant select, insert, update, delete on public.prerequisitos_habilidade to authenticated;
grant select, insert, update, delete on public.prerequisitos_habilidade to service_role;

grant select on public.metodologias_evolucao to anon;
grant select, insert, update, delete on public.metodologias_evolucao to authenticated;
grant select, insert, update, delete on public.metodologias_evolucao to service_role;

grant select on public.niveis_evolucao to anon;
grant select, insert, update, delete on public.niveis_evolucao to authenticated;
grant select, insert, update, delete on public.niveis_evolucao to service_role;

grant select on public.requisitos_nivel_evolucao to anon;
grant select, insert, update, delete on public.requisitos_nivel_evolucao to authenticated;
grant select, insert, update, delete on public.requisitos_nivel_evolucao to service_role;

grant select on public.aluno_metodologias to anon;
grant select, insert, update, delete on public.aluno_metodologias to authenticated;
grant select, insert, update, delete on public.aluno_metodologias to service_role;

-- Catalogos/metodologia: todo autenticado pode ler; dono administra.
create policy modalidade_evolucao_leitura on modalidades_evolucao
  for select using (auth.uid() is not null);
create policy modalidade_evolucao_escrita on modalidades_evolucao
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy categoria_habilidade_leitura on categorias_habilidade
  for select using (auth.uid() is not null);
create policy categoria_habilidade_escrita on categorias_habilidade
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy habilidade_catalogo_leitura on habilidades_catalogo
  for select using (auth.uid() is not null);
create policy habilidade_catalogo_escrita on habilidades_catalogo
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy criterio_habilidade_leitura on criterios_habilidade
  for select using (auth.uid() is not null);
create policy criterio_habilidade_escrita on criterios_habilidade
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy prerequisito_habilidade_leitura on prerequisitos_habilidade
  for select using (auth.uid() is not null);
create policy prerequisito_habilidade_escrita on prerequisitos_habilidade
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy metodologia_evolucao_leitura on metodologias_evolucao
  for select using (auth.uid() is not null);
create policy metodologia_evolucao_escrita on metodologias_evolucao
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy nivel_evolucao_leitura on niveis_evolucao
  for select using (auth.uid() is not null);
create policy nivel_evolucao_escrita on niveis_evolucao
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy requisito_nivel_evolucao_leitura on requisitos_nivel_evolucao
  for select using (auth.uid() is not null);
create policy requisito_nivel_evolucao_escrita on requisitos_nivel_evolucao
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

-- Atribuicao do aluno a metodologia: equipe pode ler; dono administra.
create policy aluno_metodologia_leitura on aluno_metodologias
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

create policy aluno_metodologia_escrita on aluno_metodologias
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');