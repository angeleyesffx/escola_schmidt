-- Escola Schmidt — conta vinculada a aluno por e-mail nasce como "responsavel"
-- Rodar em: Supabase > SQL Editor, depois de 0029_papel_responsavel.sql

-- Pedido direto do usuário (2026-09-20): quando o vínculo entre conta e
-- aluno acontece pelo e-mail do responsável — seja porque o staff
-- preencheu responsavel_email na tela de "novo aluno" e a pessoa se
-- cadastra depois, seja porque o cadastro já existia e o staff preenche
-- o e-mail depois na ficha do aluno — a conta deve nascer com
-- papel = 'responsavel', não 'aluno'.
--
-- Nenhuma RLS precisa mudar: nenhuma policy de self-service testa
-- papel_atual() = 'aluno' diretamente, todas testam o vínculo
-- (`alunos.perfil_id = auth.uid()`) — então 'responsavel' já tem, de
-- graça, exatamente o mesmo acesso que 'aluno' sempre teve. Confirmado
-- lendo todas as migrations: nenhuma policy usa esse padrão. Só o client
-- (telas) precisa reconhecer o novo valor — feito em paralelo nesta
-- mesma sessão (meuPapel === 'aluno' virou meuPapel === 'aluno' ||
-- meuPapel === 'responsavel' em todo lugar que checava isso).
--
-- Guarda de segurança: só promove quem hoje é 'aluno' (o default que
-- cria_perfil_novo_usuario sempre usa, mesmo pra convite de staff — ver
-- 0017/0023). Nunca reescreve papel de quem já é dono/professor — um
-- e-mail de responsável coincidir por acaso com o de um membro da equipe
-- não deveria rebaixar a conta dele.

create or replace function vincula_aluno_por_email(p_perfil_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_aluno_id uuid;
begin
  if p_email is null then
    return;
  end if;

  select id into v_aluno_id
    from alunos
   where perfil_id is null
     and responsavel_email is not null
     and lower(btrim(responsavel_email)) = lower(btrim(p_email))
   order by criado_em
   limit 1;

  if v_aluno_id is not null then
    update alunos set perfil_id = p_perfil_id where id = v_aluno_id;
    update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';
  end if;
end;
$$;

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
    update perfis set papel = 'responsavel' where id = v_perfil_id and papel = 'aluno';
  end if;

  return new;
end;
$$;
