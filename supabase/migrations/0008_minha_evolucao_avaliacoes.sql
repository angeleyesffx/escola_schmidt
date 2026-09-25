-- Escola Schmidt — avaliacoes e historico para Minha Evolucao
-- Rodar em: Supabase > SQL Editor, depois de 0007_minha_evolucao_base.sql

-- Esta migracao adiciona a camada transacional da nova feature:
-- - avaliacoes historicas por habilidade
-- - notas/observacoes por criterio
-- - snapshot do status atual por aluno e habilidade
-- - historico de nivel
-- - auditoria basica das avaliacoes

-- ---------------------------------------------------------------------------
-- Avaliacoes
-- ---------------------------------------------------------------------------

create table avaliacoes_evolucao (
  id                    uuid primary key default gen_random_uuid(),
  aluno_id              uuid not null references alunos (id) on delete cascade,
  habilidade_id         uuid not null references habilidades_catalogo (id) on delete restrict,
  metodologia_id        uuid not null references metodologias_evolucao (id) on delete restrict,
  professor_id          uuid references perfis (id) on delete set null,
  data_avaliacao        date not null default current_date,
  status                status_habilidade_evolucao not null,
  percentual_geral      numeric(5,2) check (percentual_geral is null or (percentual_geral >= 0 and percentual_geral <= 100)),
  precisa_atencao       boolean not null default false,
  prioridade_treinamento smallint check (prioridade_treinamento is null or prioridade_treinamento between 1 and 5),
  observacoes           text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

create index on avaliacoes_evolucao (aluno_id, data_avaliacao desc, criado_em desc);
create index on avaliacoes_evolucao (habilidade_id, data_avaliacao desc, criado_em desc);
create index on avaliacoes_evolucao (metodologia_id);

create table avaliacao_criterios_evolucao (
  id               uuid primary key default gen_random_uuid(),
  avaliacao_id     uuid not null references avaliacoes_evolucao (id) on delete cascade,
  criterio_id      uuid not null references criterios_habilidade (id) on delete restrict,
  percentual       numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  observacoes      text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (avaliacao_id, criterio_id)
);

create index on avaliacao_criterios_evolucao (avaliacao_id);
create index on avaliacao_criterios_evolucao (criterio_id);

-- Snapshot materializado do estado atual do aluno em cada habilidade.
create table status_habilidade_aluno (
  id                   uuid primary key default gen_random_uuid(),
  aluno_id             uuid not null references alunos (id) on delete cascade,
  habilidade_id        uuid not null references habilidades_catalogo (id) on delete restrict,
  ultima_avaliacao_id  uuid not null references avaliacoes_evolucao (id) on delete cascade,
  status_atual         status_habilidade_evolucao not null,
  percentual_atual     numeric(5,2) check (percentual_atual is null or (percentual_atual >= 0 and percentual_atual <= 100)),
  precisa_atencao      boolean not null default false,
  prioridade_atual     smallint check (prioridade_atual is null or prioridade_atual between 1 and 5),
  atualizado_em        timestamptz not null default now(),
  unique (aluno_id, habilidade_id)
);

create index on status_habilidade_aluno (aluno_id);
create index on status_habilidade_aluno (habilidade_id);

-- ---------------------------------------------------------------------------
-- Historico de nivel e prontidao
-- ---------------------------------------------------------------------------

create table historico_nivel_evolucao (
  id                      uuid primary key default gen_random_uuid(),
  aluno_id                uuid not null references alunos (id) on delete cascade,
  metodologia_id          uuid not null references metodologias_evolucao (id) on delete restrict,
  nivel_id                uuid not null references niveis_evolucao (id) on delete restrict,
  tipo                    text not null check (tipo in ('atribuicao_inicial', 'pronto_para_avaliacao', 'aprovado', 'reprovado', 'promovido')),
  data_evento             date not null default current_date,
  origem_teste_nivel_id   uuid references testes_nivel (id) on delete set null,
  registrado_por          uuid references perfis (id) on delete set null,
  observacoes             text,
  criado_em               timestamptz not null default now()
);

create index on historico_nivel_evolucao (aluno_id, data_evento desc, criado_em desc);
create index on historico_nivel_evolucao (metodologia_id, nivel_id);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create table auditoria_avaliacoes_evolucao (
  id                uuid primary key default gen_random_uuid(),
  avaliacao_id      uuid,
  aluno_id          uuid,
  habilidade_id     uuid,
  operacao          text not null check (operacao in ('insert', 'update', 'delete')),
  executado_por     uuid references perfis (id) on delete set null,
  payload_antes     jsonb,
  payload_depois    jsonb,
  criado_em         timestamptz not null default now()
);

create index on auditoria_avaliacoes_evolucao (avaliacao_id, criado_em desc);
create index on auditoria_avaliacoes_evolucao (aluno_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Validacoes e sincronizacao
-- ---------------------------------------------------------------------------

create function define_atualizado_em_minha_evolucao() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_define_atualizado_em_avaliacoes_evolucao
  before update on avaliacoes_evolucao
  for each row execute function define_atualizado_em_minha_evolucao();

create trigger trg_define_atualizado_em_avaliacao_criterios_evolucao
  before update on avaliacao_criterios_evolucao
  for each row execute function define_atualizado_em_minha_evolucao();

create function valida_avaliacao_evolucao() returns trigger
language plpgsql as $$
declare
  metodologia_aluno_id uuid;
  categoria_da_habilidade uuid;
  habilidade_do_criterio uuid;
begin
  select am.metodologia_id
    into metodologia_aluno_id
    from aluno_metodologias am
   where am.aluno_id = new.aluno_id
     and new.data_avaliacao between am.data_inicio and coalesce(am.data_fim, 'infinity'::date)
   order by am.data_inicio desc
   limit 1;

  if metodologia_aluno_id is null then
    raise exception 'Aluno precisa ter uma metodologia atribuida para receber avaliacao de evolucao.';
  end if;

  if metodologia_aluno_id <> new.metodologia_id then
    raise exception 'Metodologia da avaliacao difere da metodologia atribuida ao aluno nesta data.';
  end if;

  if new.professor_id is not null and not exists (
    select 1 from perfis p where p.id = new.professor_id and p.papel in ('dono', 'professor')
  ) then
    raise exception 'Professor da avaliacao precisa possuir papel de equipe.';
  end if;

  select hc.categoria_id into categoria_da_habilidade
    from habilidades_catalogo hc
   where hc.id = new.habilidade_id;

  if categoria_da_habilidade is null then
    raise exception 'Habilidade da avaliacao nao encontrada no catalogo.';
  end if;

  return new;
end;
$$;

create trigger trg_valida_avaliacao_evolucao
  before insert or update on avaliacoes_evolucao
  for each row execute function valida_avaliacao_evolucao();

create function valida_avaliacao_criterio_evolucao() returns trigger
language plpgsql as $$
declare
  habilidade_da_avaliacao uuid;
  habilidade_do_criterio uuid;
begin
  select habilidade_id into habilidade_da_avaliacao
    from avaliacoes_evolucao
   where id = new.avaliacao_id;

  select habilidade_id into habilidade_do_criterio
    from criterios_habilidade
   where id = new.criterio_id;

  if habilidade_da_avaliacao is null or habilidade_do_criterio is null then
    raise exception 'Avaliacao ou criterio nao encontrado para o registro detalhado.';
  end if;

  if habilidade_da_avaliacao <> habilidade_do_criterio then
    raise exception 'Criterio avaliado precisa pertencer a mesma habilidade da avaliacao.';
  end if;

  return new;
end;
$$;

create trigger trg_valida_avaliacao_criterio_evolucao
  before insert or update on avaliacao_criterios_evolucao
  for each row execute function valida_avaliacao_criterio_evolucao();

create function sincroniza_status_habilidade_aluno() returns trigger
language plpgsql as $$
declare
  avaliacao_atual avaliacoes_evolucao%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into avaliacao_atual
      from avaliacoes_evolucao ae
     where ae.aluno_id = old.aluno_id
       and ae.habilidade_id = old.habilidade_id
     order by ae.data_avaliacao desc, ae.criado_em desc
     limit 1;

    if avaliacao_atual.id is null then
      delete from status_habilidade_aluno
       where aluno_id = old.aluno_id
         and habilidade_id = old.habilidade_id;
      return old;
    end if;
  else
    select * into avaliacao_atual
      from avaliacoes_evolucao ae
     where ae.aluno_id = new.aluno_id
       and ae.habilidade_id = new.habilidade_id
     order by ae.data_avaliacao desc, ae.criado_em desc
     limit 1;
  end if;

  insert into status_habilidade_aluno (
    aluno_id,
    habilidade_id,
    ultima_avaliacao_id,
    status_atual,
    percentual_atual,
    precisa_atencao,
    prioridade_atual,
    atualizado_em
  ) values (
    avaliacao_atual.aluno_id,
    avaliacao_atual.habilidade_id,
    avaliacao_atual.id,
    avaliacao_atual.status,
    avaliacao_atual.percentual_geral,
    avaliacao_atual.precisa_atencao,
    avaliacao_atual.prioridade_treinamento,
    now()
  )
  on conflict (aluno_id, habilidade_id) do update set
    ultima_avaliacao_id = excluded.ultima_avaliacao_id,
    status_atual = excluded.status_atual,
    percentual_atual = excluded.percentual_atual,
    precisa_atencao = excluded.precisa_atencao,
    prioridade_atual = excluded.prioridade_atual,
    atualizado_em = excluded.atualizado_em;

  return coalesce(new, old);
end;
$$;

create trigger trg_sincroniza_status_habilidade_aluno
  after insert or update or delete on avaliacoes_evolucao
  for each row execute function sincroniza_status_habilidade_aluno();

create function audita_avaliacoes_evolucao() returns trigger
language plpgsql as $$
declare
  payload_antes jsonb;
  payload_depois jsonb;
  alvo_id uuid;
  alvo_aluno_id uuid;
  alvo_habilidade_id uuid;
begin
  if tg_op = 'INSERT' then
    payload_antes = null;
    payload_depois = to_jsonb(new);
    alvo_id = new.id;
    alvo_aluno_id = new.aluno_id;
    alvo_habilidade_id = new.habilidade_id;
  elsif tg_op = 'UPDATE' then
    payload_antes = to_jsonb(old);
    payload_depois = to_jsonb(new);
    alvo_id = new.id;
    alvo_aluno_id = new.aluno_id;
    alvo_habilidade_id = new.habilidade_id;
  else
    payload_antes = to_jsonb(old);
    payload_depois = null;
    alvo_id = old.id;
    alvo_aluno_id = old.aluno_id;
    alvo_habilidade_id = old.habilidade_id;
  end if;

  insert into auditoria_avaliacoes_evolucao (
    avaliacao_id,
    aluno_id,
    habilidade_id,
    operacao,
    executado_por,
    payload_antes,
    payload_depois
  ) values (
    alvo_id,
    alvo_aluno_id,
    alvo_habilidade_id,
    lower(tg_op),
    auth.uid(),
    payload_antes,
    payload_depois
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_audita_avaliacoes_evolucao
  after insert or update or delete on avaliacoes_evolucao
  for each row execute function audita_avaliacoes_evolucao();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table avaliacoes_evolucao              enable row level security;
alter table avaliacao_criterios_evolucao     enable row level security;
alter table status_habilidade_aluno          enable row level security;
alter table historico_nivel_evolucao         enable row level security;
alter table auditoria_avaliacoes_evolucao    enable row level security;

grant select on public.avaliacoes_evolucao to anon;
grant select, insert, update, delete on public.avaliacoes_evolucao to authenticated;
grant select, insert, update, delete on public.avaliacoes_evolucao to service_role;

grant select on public.avaliacao_criterios_evolucao to anon;
grant select, insert, update, delete on public.avaliacao_criterios_evolucao to authenticated;
grant select, insert, update, delete on public.avaliacao_criterios_evolucao to service_role;

grant select on public.status_habilidade_aluno to anon;
grant select, insert, update, delete on public.status_habilidade_aluno to authenticated;
grant select, insert, update, delete on public.status_habilidade_aluno to service_role;

grant select on public.historico_nivel_evolucao to anon;
grant select, insert, update, delete on public.historico_nivel_evolucao to authenticated;
grant select, insert, update, delete on public.historico_nivel_evolucao to service_role;

grant select on public.auditoria_avaliacoes_evolucao to anon;
grant select, insert, update, delete on public.auditoria_avaliacoes_evolucao to authenticated;
grant select, insert, update, delete on public.auditoria_avaliacoes_evolucao to service_role;

create policy avaliacao_evolucao_leitura on avaliacoes_evolucao
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

create policy avaliacao_evolucao_escrita on avaliacoes_evolucao
  for all using (eh_equipe()) with check (eh_equipe());

create policy avaliacao_criterio_evolucao_leitura on avaliacao_criterios_evolucao
  for select using (
    eh_equipe()
    or exists (
      select 1
        from avaliacoes_evolucao ae
        join alunos a on a.id = ae.aluno_id
       where ae.id = avaliacao_id
         and a.perfil_id = auth.uid()
    )
  );

create policy avaliacao_criterio_evolucao_escrita on avaliacao_criterios_evolucao
  for all using (eh_equipe()) with check (eh_equipe());

create policy status_habilidade_aluno_leitura on status_habilidade_aluno
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

create policy status_habilidade_aluno_escrita on status_habilidade_aluno
  for all using (eh_equipe()) with check (eh_equipe());

create policy historico_nivel_evolucao_leitura on historico_nivel_evolucao
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

create policy historico_nivel_evolucao_escrita on historico_nivel_evolucao
  for all using (eh_equipe()) with check (eh_equipe());

create policy auditoria_avaliacoes_evolucao_leitura on auditoria_avaliacoes_evolucao
  for select using (papel_atual() = 'dono');

create policy auditoria_avaliacoes_evolucao_escrita on auditoria_avaliacoes_evolucao
  for all using (false) with check (false);