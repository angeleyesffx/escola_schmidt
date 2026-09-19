-- Escola Schmidt — aluno edita os próprios dados de cadastro em "Meu perfil"
-- Rodar em: Supabase > SQL Editor, depois de 0011_aula_particular.sql

-- RLS de `alunos` só libera escrita pra dono (aluno_escrita). Em vez de abrir
-- update de linha inteira pro aluno (ele acabaria com acesso de escrita a
-- modulo, ativo, perfil_id — nada disso é dele mexer), uma função com
-- SECURITY DEFINER expõe só os 4 campos do formulário de "novo aluno" que
-- fazem sentido o próprio aluno/responsável manter atualizados.
create or replace function atualizar_meus_dados_aluno(
  p_aluno_id uuid,
  p_nome text,
  p_data_nascimento date,
  p_responsavel_nome text,
  p_responsavel_telefone text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = p_aluno_id and a.perfil_id = auth.uid())
  ) then
    raise exception 'Sem permissão para editar esse aluno.';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Informe o nome do aluno.';
  end if;

  update alunos
    set nome = p_nome,
        data_nascimento = p_data_nascimento,
        responsavel_nome = p_responsavel_nome,
        responsavel_telefone = p_responsavel_telefone
    where id = p_aluno_id;
end;
$$;

grant execute on function atualizar_meus_dados_aluno(uuid, text, date, text, text) to authenticated;
