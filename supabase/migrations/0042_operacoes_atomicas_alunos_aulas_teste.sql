-- Operacoes atomicas para evitar alunos sem contrato e aulas teste sem candidatos.

create or replace function criar_aluno_com_contrato(
  p_nome text,
  p_data_nascimento date,
  p_modulo smallint,
  p_aula_recorrente_id uuid,
  p_responsavel_nome text,
  p_responsavel_telefone text,
  p_responsavel_email text,
  p_plano plano,
  p_data_inicio date,
  p_data_fim date
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_aluno_id uuid;
begin
  if not eh_equipe() then
    raise exception 'Apenas a equipe pode cadastrar alunos.';
  end if;

  if p_aula_recorrente_id is null or not exists (
    select 1 from aulas_recorrentes ar
     where ar.id = p_aula_recorrente_id
       and ar.ativo
       and p_modulo = any(ar.modulos)
  ) then
    raise exception 'Horario da grade invalido para o modulo informado.';
  end if;

  insert into alunos (
    nome, data_nascimento, modulo, aula_recorrente_id,
    responsavel_nome, responsavel_telefone, responsavel_email
  ) values (
    btrim(p_nome), p_data_nascimento, p_modulo, p_aula_recorrente_id,
    nullif(btrim(p_responsavel_nome), ''),
    nullif(btrim(p_responsavel_telefone), ''),
    nullif(btrim(p_responsavel_email), '')
  )
  returning id into v_aluno_id;

  insert into contratos (aluno_id, plano, data_inicio, data_fim)
  values (v_aluno_id, p_plano, p_data_inicio, p_data_fim);

  return v_aluno_id;
end;
$$;

revoke all on function criar_aluno_com_contrato(text, date, smallint, uuid, text, text, text, plano, date, date)
from public, anon;
grant execute on function criar_aluno_com_contrato(text, date, smallint, uuid, text, text, text, plano, date, date)
to authenticated;

create or replace function salvar_aula_teste(
  p_aula_recorrente_id uuid,
  p_data date,
  p_observacoes text,
  p_candidatos jsonb,
  p_id uuid default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_candidato jsonb;
begin
  if p_candidatos is null or jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'Informe ao menos um candidato.';
  end if;

  if p_id is null then
    insert into aulas_teste (aula_recorrente_id, data, observacoes)
    values (p_aula_recorrente_id, p_data, p_observacoes)
    returning id into v_id;
  else
    update aulas_teste
       set aula_recorrente_id = p_aula_recorrente_id,
           data = p_data,
           observacoes = p_observacoes
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Aula teste nao encontrada.';
    end if;

    delete from aulas_teste_candidatos where aula_teste_id = v_id;
  end if;

  for v_candidato in select value from jsonb_array_elements(p_candidatos)
  loop
    if btrim(coalesce(v_candidato->>'nome', '')) = '' then
      raise exception 'Todo candidato precisa informar um nome.';
    end if;

    insert into aulas_teste_candidatos (aula_teste_id, nome, telefone)
    values (
      v_id,
      btrim(v_candidato->>'nome'),
      nullif(btrim(v_candidato->>'telefone'), '')
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function salvar_aula_teste(uuid, date, text, jsonb, uuid)
from public, anon;
grant execute on function salvar_aula_teste(uuid, date, text, jsonb, uuid)
to authenticated;
