-- Escola Schmidt — atribuir metodologia/nível a um aluno sem atribuição
-- Rodar em: Supabase > SQL Editor, depois de 0023_consentimento_signup.sql

-- Fase 4, passo 1 (docs/product/evolucao-vs-desempenho.md achado 4.2):
-- src/features/evolucao/api.ts só tem leitura de aluno_metodologias
-- (getMetodologiaAtualAluno) — não existe, em nenhuma tela, um jeito de
-- escrever a primeira linha pra um aluno. O backfill de 0009 cobriu só os
-- alunos que já existiam naquela data; todo aluno matriculado depois disso
-- fica preso no estado vazio de EvolucaoScreen até alguém rodar SQL manual.
-- Esta RPC é o mínimo pra desbloquear isso pela própria tela.
--
-- Dono-only, não security definer: aluno_metodogias já tem RLS restrita a
-- dono (aluno_metodologia_escrita, 0007) — "administrar níveis" é papel do
-- Administrador segundo papeis-e-permissoes.md, não do professor no dia a
-- dia. A função só formaliza essa mesma regra com uma mensagem amigável em
-- vez de deixar a violação de RLS crua chegar na tela; se no futuro a
-- escola quiser abrir isso pra professor também, é só trocar a condição
-- abaixo e a policy juntas.
create or replace function atribuir_metodologia_aluno(
  p_aluno_id      uuid,
  p_metodologia_id uuid,
  p_nivel_id      uuid,
  p_data_inicio   date default current_date
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if papel_atual() <> 'dono' then
    raise exception 'Apenas o dono pode atribuir metodologia e nível a um aluno.';
  end if;

  if exists (
    select 1 from aluno_metodologias am
     where am.aluno_id = p_aluno_id and am.data_fim is null
  ) then
    raise exception 'Este aluno já tem uma metodologia ativa.';
  end if;

  insert into aluno_metodologias (aluno_id, metodologia_id, nivel_atual_id, data_inicio)
  values (p_aluno_id, p_metodologia_id, p_nivel_id, p_data_inicio)
  returning id into v_id;

  insert into historico_nivel_evolucao (aluno_id, metodologia_id, nivel_id, tipo, data_evento, registrado_por)
  values (p_aluno_id, p_metodologia_id, p_nivel_id, 'atribuicao_inicial', p_data_inicio, auth.uid());

  return v_id;
end;
$$;

grant execute on function atribuir_metodologia_aluno(uuid, uuid, uuid, date) to authenticated;
