-- Escola Schmidt — aluno reserva a propria aula particular; edicao restrita a data/hora
-- Rodar em: Supabase > SQL Editor, depois de 0025_registrar_promocao_nivel.sql

-- Refinamento de requisitos de 2026-09-20 (docs/product/chamada-agenda-frequencia.md
-- secao 7), depois da implementacao das Fases 0-4. Estado atual confirmado antes
-- desta migration:
-- - aula_leitura (0011) libera eh_equipe() pra ver TODAS as particulares de
--   TODOS os professores — sem escopo por professor responsavel.
-- - aula_escrita (pos 0022) pra tipo='particular' equivale a eh_equipe() puro —
--   qualquer staff cria/edita/exclui qualquer particular.
-- - nao existe fluxo de edicao (so criacao e exclusao) nem autoatendimento do aluno.
--
-- Decisoes registradas (secao 7.2 do documento):
-- 1. Edicao so muda data/hora — aluno/professor da reserva sao fixos.
-- 2. Reserva do aluno e confirmada na hora, sem aprovacao.

-- ---------------------------------------------------------------------------
-- Helper: quem "e dono" de uma particular pra fins de update/delete —
-- dono da escola, o proprio professor da aula, ou o proprio aluno vinculado.
-- ---------------------------------------------------------------------------

create function sou_dono_da_particular(p_professor_id uuid, p_aluno_id uuid) returns boolean
language sql stable as $$
  select
    papel_atual() = 'dono'
    or (eh_equipe() and p_professor_id = auth.uid())
    or exists (select 1 from alunos a where a.perfil_id = auth.uid() and a.id = p_aluno_id);
$$;

-- ---------------------------------------------------------------------------
-- Leitura: particular so e visivel pro dono, pelo proprio professor da aula,
-- ou pelo proprio aluno — nao mais "qualquer um da equipe".
-- ---------------------------------------------------------------------------

drop policy aula_leitura on aulas;
create policy aula_leitura on aulas
  for select using (
    tipo <> 'particular'
    or papel_atual() = 'dono'
    or aulas.professor_id = auth.uid()
    or exists (select 1 from alunos a where a.id = aulas.aluno_id and a.perfil_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Escrita: separada por comando porque insert e update/delete tem regras
-- diferentes pra particular (insert e mais aberto — inclui autoatendimento
-- sem restricao de "so a propria", ja que so pode criar pra si mesmo de
-- qualquer forma; update/delete restringe a quem "e dono" da reserva).
-- Regular e reposicao mantem exatamente o comportamento de 0022/0001.
-- ---------------------------------------------------------------------------

drop policy aula_escrita on aulas;

create policy aula_insercao on aulas
  for insert
  with check (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and (
      eh_equipe()
      or exists (select 1 from alunos a where a.perfil_id = auth.uid() and a.id = aluno_id)
    ))
  );

create policy aula_atualizacao on aulas
  for update
  using (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and sou_dono_da_particular(professor_id, aluno_id))
  )
  with check (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and sou_dono_da_particular(professor_id, aluno_id))
  );

create policy aula_exclusao on aulas
  for delete using (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and sou_dono_da_particular(professor_id, aluno_id))
  );

-- ---------------------------------------------------------------------------
-- Achado durante a implementacao, fora do que o documento especificou:
-- perfil_leitura_professor_da_minha_aula (0006) so deixa aluno ler o nome de
-- um professor vinculado (professores_aula) ao proprio modulo dele. Sem
-- ajuste, o aluno nao consegue ver o NOME de um professor de outro modulo
-- que ofereca particular — mesmo que horarios_livres_particular ja calcule
-- a disponibilidade dele corretamente (essa RPC nao e travada por modulo).
-- Abre leitura do nome de qualquer professor que tenha declarado
-- disponibilidade_particular — mesmo espirito de disponibilidade_particular
-- em si, que ja e legivel por qualquer autenticado.
-- ---------------------------------------------------------------------------

create policy perfil_leitura_professor_disponivel_particular on perfis
  for select using (
    papel = 'professor'
    and exists (select 1 from disponibilidade_particular dp where dp.professor_id = perfis.id)
  );

-- ---------------------------------------------------------------------------
-- RPC de remarcacao: so data/hora, nunca aluno/professor (decisao 1). Em vez
-- de update direto via PostgREST (que exporia todas as colunas pra quem tem
-- permissao de update), mesmo padrao ja usado em atualizar_meus_dados_aluno/
-- atualizar_meu_perfil — restricao de coluna vira garantia de codigo, nao so
-- de UI. Reaproveita horarios_livres_particular (0019) pra validar que o
-- novo horario continua livre, mesma checagem ja usada na criacao.
-- ---------------------------------------------------------------------------

create or replace function remarcar_aula_particular(
  p_aula_id   uuid,
  p_nova_data date,
  p_nova_hora time
) returns void
language plpgsql
as $$
declare
  v_tipo         tipo_aula;
  v_professor_id uuid;
  v_aluno_id     uuid;
begin
  select tipo, professor_id, aluno_id
    into v_tipo, v_professor_id, v_aluno_id
    from aulas
   where id = p_aula_id;

  if v_tipo is null then
    raise exception 'Aula não encontrada.';
  end if;

  if v_tipo <> 'particular' then
    raise exception 'Só é possível remarcar aula particular.';
  end if;

  if not sou_dono_da_particular(v_professor_id, v_aluno_id) then
    raise exception 'Você não tem permissão para remarcar esta aula.';
  end if;

  if not exists (
    select 1 from horarios_livres_particular(v_professor_id, p_nova_data) hl where hl.hora = p_nova_hora
  ) then
    raise exception 'Esse horário não está livre para o professor nessa data.';
  end if;

  update aulas set data = p_nova_data, hora = p_nova_hora where id = p_aula_id;
end;
$$;

grant execute on function remarcar_aula_particular(uuid, date, time) to authenticated;
