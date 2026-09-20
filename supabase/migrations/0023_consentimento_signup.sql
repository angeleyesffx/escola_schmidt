-- Escola Schmidt — persiste o consentimento aceito no autocadastro
-- Rodar em: Supabase > SQL Editor, depois de 0022_presenca_respeita_meus_modulos.sql

-- signup.tsx já coleta "para mim / para meu filho" (titular) e mostra o
-- texto de consentimento correspondente (constante CONSENTIMENTO), mas
-- nunca gravava nada disso — se a escola precisasse comprovar que o
-- consentimento foi coletado (LGPD, dados de menor de idade), não havia
-- como (achado 4.2 de docs/product/alunos-e-responsaveis.md). Não muda o
-- enum `papel` nem RLS nenhuma — só passa a guardar o que já é coletado.
--
-- Nulo pro caso comum de conta criada por convite (convidar-usuario/
-- convidar-aluno): quem convida já está autenticado como staff, não passa
-- pela tela de consentimento — só autocadastro público preenche isso.
alter table perfis
  add column titular                 text,
  add column consentimento_versao    text,
  add column consentimento_aceito_em timestamptz,
  add constraint titular_valido check (titular is null or titular in ('proprio', 'responsavel')),
  add constraint consentimento_coerente check (
    (consentimento_versao is null) = (consentimento_aceito_em is null)
  );

create or replace function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
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

  perform vincula_aluno_por_email(new.id, new.email);

  return new;
end;
$$;
