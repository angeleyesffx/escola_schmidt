-- Escola Schmidt — schema inicial
-- Rodar em: Supabase > SQL Editor, ou salvar em supabase/migrations/0001_schema.sql

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type papel as enum ('dono', 'professor', 'aluno');
create type plano as enum ('mensal', 'trimestral', 'semestral', 'anual');
create type tipo_aula as enum ('regular', 'particular', 'reposicao');
create type status_presenca as enum ('presente', 'falta', 'falta_justificada');

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------

-- Espelha auth.users. Só quem faz login tem linha aqui.
create table perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  papel       papel not null default 'aluno',
  telefone    text,
  criado_em   timestamptz not null default now()
);

-- Aluno é separado de perfil de propósito: a escola atende a partir dos 5 anos
-- e a maioria das crianças não vai ter login. perfil_id fica nulo nesses casos,
-- e o responsável acompanha pelo próprio acesso.
create table alunos (
  id                   uuid primary key default gen_random_uuid(),
  perfil_id            uuid unique references perfis (id) on delete set null,
  nome                 text not null,
  data_nascimento      date,
  modulo               smallint not null default 1 check (modulo between 1 and 4),
  responsavel_nome     text,
  responsavel_telefone text,
  ativo                boolean not null default true,
  criado_em            timestamptz not null default now()
);

create index on alunos (modulo) where ativo;

-- ---------------------------------------------------------------------------
-- Contratos — definem até quando uma reposição pode ser feita
-- ---------------------------------------------------------------------------

create table contratos (
  id          uuid primary key default gen_random_uuid(),
  aluno_id    uuid not null references alunos (id) on delete cascade,
  plano       plano not null,
  data_inicio date not null,
  data_fim    date not null,
  criado_em   timestamptz not null default now(),
  constraint periodo_valido check (data_fim > data_inicio)
);

create index on contratos (aluno_id, data_inicio, data_fim);

-- ---------------------------------------------------------------------------
-- Testes de nível — a promoção de módulo é um evento, não um campo editado
-- ---------------------------------------------------------------------------

create table testes_nivel (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references alunos (id) on delete cascade,
  professor_id  uuid references perfis (id) on delete set null,
  data          date not null default current_date,
  modulo_de     smallint not null check (modulo_de between 1 and 4),
  modulo_para   smallint not null check (modulo_para between 1 and 4),
  aprovado      boolean not null,
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create index on testes_nivel (aluno_id, data desc);

-- Aprovou, o módulo do aluno anda. Reprovou, fica onde está — mas o teste
-- continua registrado, que é o histórico que a tela de evolução vai ler.
create function aplica_teste_nivel() returns trigger
language plpgsql as $$
begin
  if new.aprovado then
    update alunos set modulo = new.modulo_para where id = new.aluno_id;
  end if;
  return new;
end;
$$;

create trigger trg_aplica_teste_nivel
  after insert on testes_nivel
  for each row execute function aplica_teste_nivel();

-- ---------------------------------------------------------------------------
-- Grade fixa
-- ---------------------------------------------------------------------------

-- Uma aula da grade atende um ou mais módulos ao mesmo tempo — na quinta-feira
-- os quatro patinam juntos. Por isso módulo é atributo do aluno, não da turma.
create table aulas_recorrentes (
  id           uuid primary key default gen_random_uuid(),
  dia_semana   smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora         time not null,
  modulos      smallint[] not null check (
                 array_length(modulos, 1) between 1 and 4
                 and modulos <@ array[1,2,3,4]::smallint[]
               ),
  professor_id uuid references perfis (id) on delete set null,
  ativo        boolean not null default true,
  unique (dia_semana, hora)
);

-- ---------------------------------------------------------------------------
-- Aulas que de fato aconteceram
-- ---------------------------------------------------------------------------

create table aulas (
  id                   uuid primary key default gen_random_uuid(),
  data                 date not null,
  hora                 time not null,
  tipo                 tipo_aula not null default 'regular',
  aula_recorrente_id   uuid references aulas_recorrentes (id) on delete set null,
  professor_id         uuid references perfis (id) on delete set null,
  observacoes          text,
  criado_em            timestamptz not null default now(),
  -- Aula da grade precisa apontar para a grade; particular e reposição não.
  constraint origem_coerente check (
    (tipo = 'regular' and aula_recorrente_id is not null)
    or (tipo <> 'regular' and aula_recorrente_id is null)
  )
);

-- Impede abrir duas chamadas para a mesma aula da grade no mesmo dia.
create unique index aula_unica_por_data
  on aulas (aula_recorrente_id, data)
  where aula_recorrente_id is not null;

create index on aulas (data desc);

-- ---------------------------------------------------------------------------
-- Presença
-- ---------------------------------------------------------------------------

create table presencas (
  id                uuid primary key default gen_random_uuid(),
  aula_id           uuid not null references aulas (id) on delete cascade,
  aluno_id          uuid not null references alunos (id) on delete cascade,
  status            status_presenca not null,
  -- Preenchido quando esta linha é a reposição de uma falta anterior.
  repoe_presenca_id uuid unique references presencas (id) on delete set null,
  registrado_por    uuid references perfis (id) on delete set null,
  registrado_em     timestamptz not null default now(),
  unique (aula_id, aluno_id)
);

create index on presencas (aluno_id, registrado_em desc);

-- Reposição só vale dentro da vigência do contrato, e só repõe uma falta real.
create function valida_reposicao() returns trigger
language plpgsql as $$
declare
  data_aula     date;
  tipo_da_aula  tipo_aula;
  status_origem status_presenca;
begin
  if new.repoe_presenca_id is null then
    return new;
  end if;

  select a.data, a.tipo into data_aula, tipo_da_aula
    from aulas a where a.id = new.aula_id;

  if tipo_da_aula <> 'reposicao' then
    raise exception 'Só uma aula do tipo reposição pode repor uma falta.';
  end if;

  select p.status into status_origem
    from presencas p where p.id = new.repoe_presenca_id;

  if status_origem not in ('falta', 'falta_justificada') then
    raise exception 'A presença reposta precisa ser uma falta.';
  end if;

  if not exists (
    select 1 from contratos c
     where c.aluno_id = new.aluno_id
       and data_aula between c.data_inicio and c.data_fim
  ) then
    raise exception 'Reposição fora da vigência do contrato do aluno.';
  end if;

  return new;
end;
$$;

create trigger trg_valida_reposicao
  before insert or update on presencas
  for each row execute function valida_reposicao();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER para a policy de perfis não consultar perfis e entrar em
-- recursão infinita — erro clássico de RLS no Supabase.
create function papel_atual() returns papel
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid();
$$;

create function eh_equipe() returns boolean
language sql stable as $$
  select papel_atual() in ('dono', 'professor');
$$;

alter table perfis            enable row level security;
alter table alunos            enable row level security;
alter table contratos         enable row level security;
alter table testes_nivel      enable row level security;
alter table aulas_recorrentes enable row level security;
alter table aulas             enable row level security;
alter table presencas         enable row level security;

-- Perfis: cada um vê o seu; dono vê todos.
create policy perfil_proprio on perfis
  for select using (id = auth.uid() or papel_atual() = 'dono');
create policy perfil_edita_proprio on perfis
  for update using (id = auth.uid());

-- Alunos: equipe vê todos; aluno vê a si mesmo.
create policy aluno_leitura on alunos
  for select using (eh_equipe() or perfil_id = auth.uid());
create policy aluno_escrita on alunos
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

-- Contratos e testes: leitura para equipe e para o próprio aluno.
create policy contrato_leitura on contratos
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );
create policy contrato_escrita on contratos
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy teste_leitura on testes_nivel
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );
create policy teste_escrita on testes_nivel
  for all using (eh_equipe()) with check (eh_equipe());

-- Grade e aulas: todo mundo lê, equipe escreve.
create policy grade_leitura on aulas_recorrentes for select using (auth.uid() is not null);
create policy grade_escrita on aulas_recorrentes for all
  using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

create policy aula_leitura on aulas for select using (auth.uid() is not null);
create policy aula_escrita on aulas for all
  using (eh_equipe()) with check (eh_equipe());

-- Presenças: equipe registra; aluno só lê as próprias.
create policy presenca_leitura on presencas
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );
create policy presenca_escrita on presencas
  for all using (eh_equipe()) with check (eh_equipe());

-- ---------------------------------------------------------------------------
-- Grade atual da escola
-- ---------------------------------------------------------------------------

insert into aulas_recorrentes (dia_semana, hora, modulos) values
  (2, '18:00', array[1,2]::smallint[]),      -- terça
  (2, '19:00', array[3,4]::smallint[]),
  (4, '18:00', array[1,2,3,4]::smallint[]),  -- quinta
  (6, '15:00', array[1,2]::smallint[]),      -- sábado
  (6, '16:00', array[3,4]::smallint[]),
  (0, '10:00', array[1,2]::smallint[]),      -- domingo
  (0, '11:00', array[3,4]::smallint[]);

-- ---------------------------------------------------------------------------
-- Perfil automático no cadastro
-- ---------------------------------------------------------------------------

-- Toda conta nova em auth.users ganha uma linha em perfis. Sem isso, quem se
-- cadastra faz login mas o app não sabe se é dono, professor ou aluno.
create function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'papel')::papel, 'aluno')
  );
  return new;
end;
$$;

create trigger trg_cria_perfil
  after insert on auth.users
  for each row execute function cria_perfil_novo_usuario();
