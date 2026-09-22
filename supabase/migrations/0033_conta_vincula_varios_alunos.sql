-- Escola Schmidt — uma conta pode ter mais de um aluno vinculado
-- Rodar em: Supabase > SQL Editor, depois de 0032_disponibilidade_particular_janela_unica.sql

-- Ate aqui, alunos.perfil_id era unique: no maximo 1 aluno por conta. Isso
-- nunca cobriu responsavel com mais de um filho matriculado, nem aluno
-- adulto que tambem e responsavel por outro filho (achado 4.3 de
-- alunos-e-responsaveis.md, deliberadamente adiado ate agora — decisao
-- revertida em 2026-09-21, pedido direto do usuario).
--
-- Auditoria antes de remover: nenhuma RLS pressupoe 1 linha so — todas usam
-- `exists(select 1 from alunos where perfil_id = auth.uid() and ...)`, que
-- continua correto com 0, 1 ou N linhas. Nenhuma FK referencia
-- alunos.perfil_id (as FKs de outras tabelas apontam pra alunos.id). A unica
-- suposicao de unicidade vivia em vincula_aluno_por_email/
-- vincula_perfil_por_email_no_aluno (0020/0030), corrigida abaixo.

alter table alunos drop constraint alunos_perfil_id_key;
create index on alunos (perfil_id) where perfil_id is not null;

-- Antes: linkava só o primeiro aluno sem vínculo daquele e-mail (comentário
-- original dizia explicitamente "perfil_id é unique, só o primeiro é
-- ligado"). Agora: linka todos os que baterem, e só promove a papel
-- 'responsavel' se pelo menos um vínculo novo foi de fato criado.
create or replace function vincula_aluno_por_email(p_perfil_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_qtd int;
begin
  if p_email is null then
    return;
  end if;

  update alunos
     set perfil_id = p_perfil_id
   where perfil_id is null
     and responsavel_email is not null
     and lower(btrim(responsavel_email)) = lower(btrim(p_email));

  get diagnostics v_qtd = row_count;

  if v_qtd > 0 then
    update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';
  end if;
end;
$$;

-- Antes: só linkava se aquele perfil_id ainda não tivesse nenhum aluno
-- (guarda que existia só pra não violar a unique constraint que acabou de
-- sair). Sem a constraint, essa guarda não faz mais sentido — um responsável
-- que já tem um filho vinculado pode, e deve, vincular o e-mail dele a um
-- segundo filho matriculado depois.
create or replace function vincula_perfil_por_email_no_aluno() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_perfil_id uuid;
begin
  if new.perfil_id is not null or new.responsavel_email is null then
    return new;
  end if;

  select u.id into v_perfil_id
    from auth.users u
   where lower(btrim(u.email)) = lower(btrim(new.responsavel_email))
   limit 1;

  if v_perfil_id is not null then
    new.perfil_id := v_perfil_id;
    update perfis set papel = 'responsavel' where id = v_perfil_id and papel = 'aluno';
  end if;

  return new;
end;
$$;
