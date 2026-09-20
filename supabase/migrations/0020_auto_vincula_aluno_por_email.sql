-- Escola Schmidt — vínculo automático de conta por e-mail do responsável
-- Rodar em: Supabase > SQL Editor, depois de 0019_disponibilidade_particular_flexivel.sql

-- Até aqui, quem se cadastrava sozinho (signup público) virava um perfil
-- "aluno" órfão — a equipe precisava abrir a ficha do aluno certo e vincular
-- manualmente na lista de "contas que já fizeram cadastro". Agora a equipe
-- informa o e-mail do responsável na hora de matricular, e o vínculo acontece
-- sozinho — na ordem que for (matrícula primeiro ou cadastro primeiro).
alter table alunos add column responsavel_email text;

-- perfil_id é unique em alunos (um perfil só liga a um aluno), então um mesmo
-- responsável com mais de um filho matriculado continua precisando do vínculo
-- manual pros filhos seguintes — mesma limitação que o fluxo manual já tinha,
-- só o primeiro aluno sem vínculo daquele e-mail é ligado automaticamente.
create or replace function vincula_aluno_por_email(p_perfil_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null then
    return;
  end if;

  update alunos
     set perfil_id = p_perfil_id
   where id = (
     select id from alunos
      where perfil_id is null
        and responsavel_email is not null
        and lower(btrim(responsavel_email)) = lower(btrim(p_email))
      order by criado_em
      limit 1
   );
end;
$$;

-- Caso 1: matrícula já tinha o e-mail quando a conta se cadastra agora.
create or replace function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'aluno'
  );

  perform vincula_aluno_por_email(new.id, new.email);

  return new;
end;
$$;

-- Caso 2: a conta já existia (ou acabou de se cadastrar) e só agora a equipe
-- preenche/corrige o e-mail do responsável na ficha do aluno.
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

  if v_perfil_id is not null and not exists (select 1 from alunos where perfil_id = v_perfil_id) then
    new.perfil_id := v_perfil_id;
  end if;

  return new;
end;
$$;

create trigger trg_vincula_perfil_por_email
  before insert or update of responsavel_email on alunos
  for each row execute function vincula_perfil_por_email_no_aluno();
