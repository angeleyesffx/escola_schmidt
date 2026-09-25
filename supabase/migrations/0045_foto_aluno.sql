-- Escola Schmidt - foto do aluno
-- Responsaveis podem gerenciar a foto dos proprios alunos vinculados.

alter table alunos add column avatar_path text;

create or replace function atualizar_avatar_aluno(p_aluno_id uuid, p_avatar_path text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from alunos a
     where a.id = p_aluno_id
       and (
         a.perfil_id = auth.uid()
         or papel_atual() = 'dono'
         or (papel_atual() = 'professor' and sou_responsavel_pelo_aluno(p_aluno_id))
       )
  ) then
    raise exception 'Você não pode alterar a foto deste aluno.';
  end if;

  if p_avatar_path is not null and p_avatar_path <> auth.uid()::text || '/aluno-' || p_aluno_id::text then
    raise exception 'Caminho de avatar invalido.';
  end if;

  update alunos
     set avatar_path = p_avatar_path
   where id = p_aluno_id;
end;
$$;

grant execute on function atualizar_avatar_aluno(uuid, text) to authenticated;
