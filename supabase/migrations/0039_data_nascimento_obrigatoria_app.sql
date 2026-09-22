-- Escola Schmidt — data de nascimento passa a ser obrigatória (aplicação)
-- Rodar em: Supabase > SQL Editor, depois de 0038_responsavel_adiciona_filhos.sql

-- Pedido direto do usuário (2026-09-22): data_nascimento é informação
-- mandatória pra todo aluno — inclusive filhos cadastrados por um
-- responsável e inclusive quando o próprio responsável também é atleta —
-- porque competições dividem atletas por faixa etária, não só por
-- categoria/módulo. Decisão: obrigatoriedade só na aplicação por agora, não
-- `not null` no banco — evita travar a migration contra alunos que já
-- existem sem data (ex.: os criados nos testes de hoje) e não bloqueia quem
-- já usa o app. Registros antigos sem data continuam existindo até alguém
-- abrir e salvar de novo.

-- ---------------------------------------------------------------------------
-- 1) atualizar_meus_dados_aluno (0037): mesma validação que já existe pro
-- nome, agora também pra data de nascimento.
-- ---------------------------------------------------------------------------

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
  if not (eh_equipe() or tenho_vinculo_confirmado(p_aluno_id)) then
    raise exception 'Sem permissão para editar esse aluno.';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Informe o nome do aluno.';
  end if;

  if p_data_nascimento is null then
    raise exception 'Informe a data de nascimento.';
  end if;

  update alunos
    set nome = p_nome,
        data_nascimento = p_data_nascimento,
        responsavel_nome = p_responsavel_nome,
        responsavel_telefone = p_responsavel_telefone
    where id = p_aluno_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) adiciona_filho_confirmado / adicionar_meu_filho (0038): ganham
-- p_data_nascimento, com a mesma validação de "não pode ser nulo". A versão
-- antiga de adicionar_meu_filho(text) é removida pra não deixar duas RPCs
-- públicas com o mesmo nome (uma exigindo data, outra não) coexistindo.
-- ---------------------------------------------------------------------------

drop function if exists adicionar_meu_filho(text);

create or replace function adiciona_filho_confirmado(
  p_perfil_id uuid,
  p_nome text,
  p_data_nascimento date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id uuid;
begin
  if v_nome = '' then
    raise exception 'Informe o nome do filho.';
  end if;

  if p_data_nascimento is null then
    raise exception 'Informe a data de nascimento.';
  end if;

  insert into alunos (nome, data_nascimento, perfil_id, vinculo_confirmado_em)
  values (v_nome, p_data_nascimento, p_perfil_id, now())
  returning id into v_id;

  update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';

  return v_id;
end;
$$;

create function adicionar_meu_filho(p_nome text, p_data_nascimento date) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;
  return adiciona_filho_confirmado(auth.uid(), p_nome, p_data_nascimento);
end;
$$;

grant execute on function adicionar_meu_filho(text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) cria_perfil_novo_usuario (0038): `filhos` no meta_data do signup passa
-- de string[] (só nome) pra {nome, data_nascimento}[] — mecanismo criado
-- nesta mesma sessão (0038), sem formato legado em uso a preservar.
-- ---------------------------------------------------------------------------

create or replace function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_filhos jsonb := coalesce(new.raw_user_meta_data->'filhos', '[]'::jsonb);
  v_filho jsonb;
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
    for v_filho in select value from jsonb_array_elements(v_filhos) as value
    loop
      if btrim(coalesce(v_filho->>'nome', '')) <> '' and (v_filho->>'data_nascimento') is not null then
        perform adiciona_filho_confirmado(
          new.id,
          v_filho->>'nome',
          (v_filho->>'data_nascimento')::date
        );
      end if;
    end loop;
  end if;

  perform vincula_aluno_por_email(new.id, new.email);

  return new;
end;
$$;
