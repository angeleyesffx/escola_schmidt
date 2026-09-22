-- Escola Schmidt — trava de autoavaliação em registrar_avaliacao_evolucao
-- Rodar em: Supabase > SQL Editor, depois de 0034_correcoes_revisao_seguranca.sql

-- docs/product/professor-como-aluno.md §4: a RLS de self-service (contratos,
-- pedidos_presenca, avaliacoes_evolucao, status_habilidade_aluno etc.) já
-- suporta um professor/dono ter `alunos.perfil_id` vinculado a si mesmo —
-- nenhuma delas testa `papel_atual() = 'aluno'`, todas testam o vínculo. Isso
-- foi reforçado em 2026-09-21 quando `alunos.perfil_id` deixou de ser único
-- (0033): agora qualquer papel pode ter alunos vinculados. Mas
-- registrar_avaliacao_evolucao só checava eh_equipe() — nada impedia alguém
-- de avaliar a própria habilidade quando também é o aluno da linha que está
-- avaliando. Trava aqui, no banco, não só na tela: quem chama a RPC não pode
-- ser o mesmo perfil vinculado ao aluno avaliado, mesmo sendo dono/professor.

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
  p_criterios jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_avaliacao_id uuid;
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
