-- Escola Schmidt — correções da revisão de segurança de 2026-09-21
-- Rodar em: Supabase > SQL Editor, depois de 0032_disponibilidade_particular_janela_unica.sql
-- (e depois de qualquer que seja a migration 0033 aplicada — esta não depende
-- dela, mas há dois candidatos a 0033 no repo no momento; ver conversa)

-- ---------------------------------------------------------------------------
-- 1) aluno_escrita (0014) cobria INSERT/UPDATE/DELETE com o mesmo eh_equipe(),
-- então qualquer professor podia apagar um aluno — e alunos é referenciado
-- "on delete cascade" por presencas, contratos, testes_nivel,
-- avaliacoes_desempenho, aluno_metodologias, avaliacoes_evolucao,
-- status_habilidade_aluno e historico_nivel_evolucao. Um DELETE de qualquer
-- professor apagava, em cascata, toda a história do aluno sem volta.
-- alunos.ativo (0001) já existe pra ser o jeito certo de "remover" um aluno;
-- agora isso vira regra de banco, não só convenção de tela: só o dono
-- consegue de fato excluir a linha.
-- ---------------------------------------------------------------------------

drop policy aluno_escrita on alunos;

create policy aluno_insercao on alunos
  for insert with check (eh_equipe());

create policy aluno_atualizacao on alunos
  for update using (eh_equipe()) with check (eh_equipe());

create policy aluno_exclusao on alunos
  for delete using (papel_atual() = 'dono');

-- ---------------------------------------------------------------------------
-- 2) perfil_leitura_professor_disponivel_particular (0026) não tinha nenhuma
-- âncora em auth.uid() — bastava o professor ter disponibilidade_particular
-- cadastrada pra qualquer autenticado ler a linha inteira dele em perfis
-- (telefone incluso), não só o nome que a tela realmente usa. Troca a policy
-- de linha por uma function SECURITY DEFINER que só devolve id/nome — RLS
-- não faz coluna, então "expor só o nome" precisa ser isso, não uma policy
-- de linha inteira.
-- ---------------------------------------------------------------------------

drop policy perfil_leitura_professor_disponivel_particular on perfis;

create function nomes_professores_disponiveis_particular() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome
    from perfis p
   where p.papel = 'professor'
     and p.ativo
     and exists (select 1 from disponibilidade_particular dp where dp.professor_id = p.id);
$$;

grant execute on function nomes_professores_disponiveis_particular() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) registrar_promocao_nivel (0025) só checava eh_equipe() — diferente de
-- aula_escrita/presenca_escrita (0022), que já restringem professor a "meus
-- módulos". Um professor responsável só pelo módulo 1 podia promover/mover
-- alunos.modulo de um aluno do módulo 4. Passa a exigir, pra quem não é
-- dono, vínculo em professores_aula com o módulo ATUAL do aluno (antes da
-- promoção) — mesmo padrão de sou_responsavel_pela_aula (0018), só que por
-- módulo do aluno em vez de aula_recorrente_id.
-- ---------------------------------------------------------------------------

create function sou_responsavel_pelo_aluno(p_aluno_id uuid) returns boolean
language sql stable as $$
  select papel_atual() = 'dono' or exists (
    select 1
      from professores_aula pa
      join alunos a on a.modulo = pa.modulo
     where pa.professor_id = auth.uid()
       and a.id = p_aluno_id
  );
$$;

create or replace function registrar_promocao_nivel(
  p_aluno_id     uuid,
  p_nivel_id     uuid,
  p_data_evento  date default current_date,
  p_observacoes  text default null
) returns uuid
language plpgsql
as $$
declare
  v_metodologia_id uuid;
  v_id uuid;
begin
  if not sou_responsavel_pelo_aluno(p_aluno_id) then
    raise exception 'Você só pode registrar promoção de nível dos módulos que responde.';
  end if;

  select am.metodologia_id
    into v_metodologia_id
    from aluno_metodologias am
   where am.aluno_id = p_aluno_id
     and am.data_fim is null;

  if v_metodologia_id is null then
    raise exception 'Aluno não tem metodologia ativa.';
  end if;

  if not exists (
    select 1 from niveis_evolucao ne
     where ne.id = p_nivel_id and ne.metodologia_id = v_metodologia_id
  ) then
    raise exception 'Nível informado não pertence à metodologia ativa do aluno.';
  end if;

  insert into historico_nivel_evolucao (
    aluno_id, metodologia_id, nivel_id, tipo, data_evento, registrado_por, observacoes
  ) values (
    p_aluno_id, v_metodologia_id, p_nivel_id, 'promovido', p_data_evento, auth.uid(), p_observacoes
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) aula_insercao (0026) deixava o aluno reservar particular em qualquer
-- (data, hora) — só o índice único (0011) barrava duas particulares no
-- mesmíssimo instante pro mesmo professor, nada validava contra a
-- disponibilidade declarada nem contra a grade regular dele.
-- horarios_livres_particular (0019) já faz exatamente essa conta; passa a
-- ser exigida no INSERT de autoatendimento, não só na tela. Fica restrito ao
-- caminho do próprio aluno — a equipe mantém a liberdade de agendar
-- particular fora da disponibilidade publicada (ex.: encaixe combinado
-- diretamente com a família), que já existia antes desta migration.
-- ---------------------------------------------------------------------------

drop policy aula_insercao on aulas;

create policy aula_insercao on aulas
  for insert
  with check (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and eh_equipe())
    or (
      tipo = 'particular'
      and exists (select 1 from alunos a where a.perfil_id = auth.uid() and a.id = aluno_id)
      and exists (select 1 from horarios_livres_particular(professor_id, data) h where h.hora = aulas.hora)
    )
  );

-- ---------------------------------------------------------------------------
-- 5) 0032 limpou as janelas de disponibilidade_particular duplicadas e
-- apertou o CHECK de período, mas não impedia recriar a mesma duplicata
-- depois — a única trava era o cálculo no cliente (disponibilidade.tsx),
-- que não vale nada contra dois cadastros quase simultâneos. Fecha no
-- banco, no mesmo espírito do índice único que aulas particulares já têm
-- desde a 0011.
-- ---------------------------------------------------------------------------

create unique index disponibilidade_unica_por_professor_dia
  on disponibilidade_particular (professor_id, data_inicio)
  where tipo_recorrencia = 'unica';

create unique index disponibilidade_recorrente_por_professor_periodo
  on disponibilidade_particular (professor_id, tipo_recorrencia, data_inicio, data_fim)
  where tipo_recorrencia <> 'unica';

-- ---------------------------------------------------------------------------
-- 6) supabase/functions/convidar-aluno fazia 2 updates separados (alunos.
-- perfil_id, depois perfis.papel) sem nenhuma transação cruzando os dois —
-- se o 2º falhasse depois do 1º já ter sido gravado, o aluno ficava com
-- perfil_id preenchido (bloqueando um novo convite, já que a function rejeita
-- aluno_id com perfil_id não nulo) mas com papel errado ('aluno' em vez de
-- 'responsavel'), sem caminho de correção automática. Uma function faz os
-- dois updates na mesma transação implícita da chamada — se qualquer um
-- falhar/for rejeitado, os dois desfazem, e o convite continua reexecutável.
-- ---------------------------------------------------------------------------

create function vincula_convite_aluno(p_aluno_id uuid, p_perfil_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_linhas int;
begin
  update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    return false;
  end if;

  update alunos set perfil_id = p_perfil_id where id = p_aluno_id and perfil_id is null;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Aluno já vinculado ou não encontrado.';
  end if;

  return true;
end;
$$;

-- Só a Edge Function chama isso, com service_role — não precisa (nem deve)
-- ficar disponível pro client autenticado comum.
