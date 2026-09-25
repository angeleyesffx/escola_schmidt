-- Escola Schmidt — avaliação de evolução vira upsert por dia, com confirmação
-- Rodar em: Supabase > SQL Editor, depois de 0042_operacoes_atomicas_alunos_aulas_teste.sql

-- Problema relatado: registrar_avaliacao_evolucao (0010/0035) sempre fazia um
-- INSERT puro em avaliacoes_evolucao. Se o professor avaliava a mesma
-- habilidade do mesmo aluno mais de uma vez no mesmo dia, cada clique virava
-- uma linha nova — a jornada (avaliacoes_evolucao listada por data) mostrava
-- "Aprendendo" repetido várias vezes, sem nunca refletir a pontuação
-- realmente atingida na última tentativa daquele dia. `sincroniza_status_habilidade_aluno`
-- já usava a mais recente por `data_avaliacao desc, criado_em desc`, então o
-- progresso ficava certo — só a jornada (histórico bruto) que virava ruído.
--
-- Decisão: uma avaliação por aluno+habilidade+dia. Reavaliar no mesmo dia
-- sobrescreve a linha existente em vez de inserir outra — mas só quando o
-- chamador confirmar explicitamente (`p_sobrescrever = true`); do contrário a
-- funcao recusa com uma mensagem que o cliente reconhece e usa pra perguntar
-- ao professor se ele quer sobrescrever.

-- 1) Dedup dos dados já existentes: mantém, por aluno+habilidade+dia, só a
--    avaliação mais recente (criado_em desc, id desc como desempate). Os
--    critérios da linha removida somem via on delete cascade; o trigger de
--    sincronização e a auditoria já reagem normalmente a esses deletes.
delete from avaliacoes_evolucao ae
 where exists (
   select 1
     from avaliacoes_evolucao mais_recente
    where mais_recente.aluno_id = ae.aluno_id
      and mais_recente.habilidade_id = ae.habilidade_id
      and mais_recente.data_avaliacao = ae.data_avaliacao
      and (mais_recente.criado_em, mais_recente.id) > (ae.criado_em, ae.id)
 );

alter table avaliacoes_evolucao
  add constraint avaliacoes_evolucao_aluno_habilidade_dia_key
  unique (aluno_id, habilidade_id, data_avaliacao);

-- 2) RPC vira upsert consciente: mesma validação de sempre, mas antes do
--    insert verifica se já existe avaliação daquele aluno+habilidade+dia.
-- `create or replace` não troca a assinatura antiga (11 parametros) por essa
-- (12, com p_sobrescrever novo) — cria uma sobrecarga nova e deixa as duas
-- coexistindo, o que reabriria a brecha do insert puro pra quem ainda chamar
-- com 11 argumentos. Precisa dropar a versao anterior primeiro.
drop function if exists registrar_avaliacao_evolucao(
  uuid, uuid, uuid, uuid, date, status_habilidade_evolucao, numeric, boolean, smallint, text, jsonb
);

create or replace function registrar_avaliacao_evolucao(
  p_aluno_id uuid,
  p_habilidade_id uuid,
  p_metodologia_id uuid,
  p_professor_id uuid default null,
  p_data_avaliacao date default current_date,
  p_status status_habilidade_evolucao default null,
  p_percentual_geral numeric default null,
  p_precisa_atencao boolean default false,
  p_prioridade_treinamento smallint default null,
  p_observacoes text default null,
  p_criterios jsonb default '[]'::jsonb,
  p_sobrescrever boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_avaliacao_id uuid;
  v_avaliacao_existente_id uuid;
  v_status status_habilidade_evolucao;
  v_percentual numeric(5,2);
  v_peso_total numeric;
  v_peso_atingido numeric;
  v_item jsonb;
  v_criterio_id uuid;
  v_criterio_percentual numeric;
  v_criterio_observacoes text;
  v_peso numeric;
begin
  if not eh_equipe() then
    raise exception 'Apenas a equipe pode registrar avaliacoes de evolucao.';
  end if;

  if exists (select 1 from alunos a where a.id = p_aluno_id and a.perfil_id = auth.uid()) then
    raise exception 'Nao e possivel registrar autoavaliacao.';
  end if;

  if p_criterios is null then
    p_criterios := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_criterios) <> 'array' then
    raise exception 'p_criterios precisa ser um array JSON.';
  end if;

  select id into v_avaliacao_existente_id
    from avaliacoes_evolucao
   where aluno_id = p_aluno_id
     and habilidade_id = p_habilidade_id
     and data_avaliacao = p_data_avaliacao;

  if v_avaliacao_existente_id is not null and not p_sobrescrever then
    raise exception 'AVALIACAO_JA_EXISTE_NO_DIA: ja existe uma avaliacao desta habilidade para este aluno nesta data.';
  end if;

  if jsonb_array_length(p_criterios) > 0 then
    v_peso_total := 0;
    v_peso_atingido := 0;

    for v_item in select value from jsonb_array_elements(p_criterios)
    loop
      v_criterio_id := (v_item->>'criterio_id')::uuid;
      v_criterio_percentual := (v_item->>'percentual')::numeric;
      v_criterio_observacoes := nullif(trim(v_item->>'observacoes'), '');

      if v_criterio_id is null or v_criterio_percentual is null then
        raise exception 'Cada criterio precisa informar criterio_id e percentual.';
      end if;

      if v_criterio_percentual < 0 or v_criterio_percentual > 100 then
        raise exception 'Percentual do criterio precisa estar entre 0 e 100.';
      end if;

      select ch.peso
        into v_peso
        from criterios_habilidade ch
       where ch.id = v_criterio_id
         and ch.habilidade_id = p_habilidade_id
         and ch.ativo = true;

      if v_peso is null then
        raise exception 'Criterio % invalido ou inativo para a habilidade informada.', v_criterio_id;
      end if;

      v_peso_total := v_peso_total + v_peso;
      v_peso_atingido := v_peso_atingido + (v_peso * v_criterio_percentual);
    end loop;

    if v_peso_total <= 0 then
      raise exception 'Nenhum criterio valido informado para calcular o percentual.';
    end if;

    v_percentual := round((v_peso_atingido / v_peso_total)::numeric, 2);
    v_status := derivar_status_por_percentual_evolucao(v_percentual);
  else
    if p_status is null then
      raise exception 'Avaliacao rapida exige p_status quando nao ha criterios.';
    end if;

    v_status := p_status;
    v_percentual := p_percentual_geral;
  end if;

  if v_avaliacao_existente_id is not null then
    update avaliacoes_evolucao
       set metodologia_id = p_metodologia_id,
           professor_id = p_professor_id,
           status = v_status,
           percentual_geral = v_percentual,
           precisa_atencao = coalesce(p_precisa_atencao, false),
           prioridade_treinamento = p_prioridade_treinamento,
           observacoes = p_observacoes
     where id = v_avaliacao_existente_id
    returning id into v_avaliacao_id;

    delete from avaliacao_criterios_evolucao where avaliacao_id = v_avaliacao_id;
  else
    insert into avaliacoes_evolucao (
      aluno_id,
      habilidade_id,
      metodologia_id,
      professor_id,
      data_avaliacao,
      status,
      percentual_geral,
      precisa_atencao,
      prioridade_treinamento,
      observacoes
    ) values (
      p_aluno_id,
      p_habilidade_id,
      p_metodologia_id,
      p_professor_id,
      p_data_avaliacao,
      v_status,
      v_percentual,
      coalesce(p_precisa_atencao, false),
      p_prioridade_treinamento,
      p_observacoes
    )
    returning id into v_avaliacao_id;
  end if;

  if jsonb_array_length(p_criterios) > 0 then
    for v_item in select value from jsonb_array_elements(p_criterios)
    loop
      v_criterio_id := (v_item->>'criterio_id')::uuid;
      v_criterio_percentual := (v_item->>'percentual')::numeric;
      v_criterio_observacoes := nullif(trim(v_item->>'observacoes'), '');

      insert into avaliacao_criterios_evolucao (
        avaliacao_id,
        criterio_id,
        percentual,
        observacoes
      ) values (
        v_avaliacao_id,
        v_criterio_id,
        v_criterio_percentual,
        v_criterio_observacoes
      );
    end loop;
  end if;

  return v_avaliacao_id;
end;
$$;

grant execute on function registrar_avaliacao_evolucao(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  status_habilidade_evolucao,
  numeric,
  boolean,
  smallint,
  text,
  jsonb,
  boolean
) to authenticated;
