-- Escola Schmidt — responsável cadastra os próprios filhos, no cadastro ou depois
-- Rodar em: Supabase > SQL Editor, depois de 0037_confirmacao_vinculo_responsavel.sql

-- Até aqui, o único jeito de um `alunos` nascer vinculado a uma conta era a
-- equipe preencher `responsavel_email` na ficha (vínculo por e-mail, 0020/
-- 0033/0037) ou convidar explicitamente (`convidar-aluno`) — o autocadastro
-- público nunca criava nenhuma linha em `alunos`, só a conta em `perfis`.
-- Pedido direto do usuário (2026-09-21): quem se identifica como responsável
-- no cadastro deveria poder listar os filhos ali mesmo — e/ou voltar depois,
-- já logado, e adicionar mais um a qualquer momento (família não termina de
-- crescer no dia do cadastro).
--
-- Esses vínculos nascem CONFIRMADOS (vinculo_confirmado_em = now()), ao
-- contrário do vínculo por e-mail de 0037: ali a preocupação era um e-mail
-- errado (digitado pela equipe) dar acesso a uma criança sem relação
-- nenhuma com a conta. Aqui é a própria conta, autenticada, digitando o
-- nome — não existe "e-mail errado" nesse caminho, é sempre a pessoa se
-- auto-vinculando ao próprio filho que ela mesma está nomeando.

-- ---------------------------------------------------------------------------
-- 1) Helper interno (não tem grant — não é RPC direta): cria o aluno já
-- confirmado pro perfil informado, e promove papel 'aluno' -> 'responsavel'
-- (mesma guarda de sempre: só promove quem ainda é 'aluno', nunca rebaixa
-- dono/professor). Compartilhado pelos dois pontos de entrada abaixo (cadastro
-- e "adicionar depois") pra não duplicar a lógica de inserção.
-- ---------------------------------------------------------------------------

create function adiciona_filho_confirmado(p_perfil_id uuid, p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id uuid;
begin
  if v_nome = '' then
    raise exception 'Informe o nome do filho.';
  end if;

  insert into alunos (nome, perfil_id, vinculo_confirmado_em)
  values (v_nome, p_perfil_id, now())
  returning id into v_id;

  update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) "Adicionar depois": RPC pra quem já está logado. Qualquer papel pode
-- chamar — dono/professor que também é pai/mãe (docs/product/professor-
-- como-aluno.md) tem o mesmo direito de cadastrar o próprio filho que
-- qualquer outra conta.
-- ---------------------------------------------------------------------------

create function adicionar_meu_filho(p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;
  return adiciona_filho_confirmado(auth.uid(), p_nome);
end;
$$;

grant execute on function adicionar_meu_filho(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) "No cadastro": cria_perfil_novo_usuario() passa a ler um array opcional
-- `filhos` de raw_user_meta_data (signup.tsx manda quando titular =
-- 'responsavel' e a pessoa preencheu pelo menos um nome) e cria uma linha por
-- nome não vazio. Continua opcional — quem não preencher nenhum filho aqui
-- segue exatamente como hoje (papel nasce 'aluno', pode virar 'responsavel'
-- depois por vínculo de e-mail, convite, ou pela RPC acima).
-- ---------------------------------------------------------------------------

create or replace function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_filhos jsonb := coalesce(new.raw_user_meta_data->'filhos', '[]'::jsonb);
  v_nome_filho text;
begin
  insert into perfis (id, nome, papel, titular, consentimento_versao, consentimento_aceito_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'aluno',
    new.raw_user_meta_data->>'titular',
    new.raw_user_meta_data->>'consentimento_versao',
    case when new.raw_user_meta_data->>'consentimento_versao' is not null then now() else null end
  );

  if jsonb_typeof(v_filhos) = 'array' then
    for v_nome_filho in select value from jsonb_array_elements_text(v_filhos) as value
    loop
      if btrim(v_nome_filho) <> '' then
        perform adiciona_filho_confirmado(new.id, v_nome_filho);
      end if;
    end loop;
  end if;

  perform vincula_aluno_por_email(new.id, new.email);

  return new;
end;
$$;
