-- Escola Schmidt — só o dono muda papel/status de outros usuários
-- Rodar em: Supabase > SQL Editor, depois de 0016_disponibilidade_particular.sql

-- Fecha a brecha de auto-promoção: cria_perfil_novo_usuario() confiava em
-- raw_user_meta_data->>'papel', um campo que o próprio signUp() do cliente
-- preenche livremente via options.data — nada no banco impedia alguém de
-- chamar o SDK direto e se autodeclarar 'dono'. Cadastro público sempre nasce
-- 'aluno' agora; quem precisa de outro papel entra pelo convite do dono (Edge
-- Function convidar-usuario), que corrige o papel depois via service_role.
create or replace function cria_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'aluno'
  );
  return new;
end;
$$;

-- perfil_edita_proprio só restringia qual linha (id = auth.uid()), não quais
-- colunas — qualquer usuário podia, em tese, dar update no próprio papel/ativo
-- direto pelo client. Sai a policy aberta, entra RPC restrita aos 2 campos que
-- "Meu perfil" já edita hoje (mesmo padrão de atualizar_meus_dados_aluno em
-- 0012_editar_dados_aluno.sql).
drop policy perfil_edita_proprio on perfis;

create or replace function atualizar_meu_perfil(p_nome text, p_telefone text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Informe seu nome.';
  end if;

  update perfis set nome = p_nome, telefone = p_telefone where id = auth.uid();
end;
$$;

grant execute on function atualizar_meu_perfil(text, text) to authenticated;

-- Dono gerencia qualquer perfil (papel, ativo, nome, telefone de outros).
create policy perfil_dono_gerencia on perfis
  for update using (papel_atual() = 'dono') with check (papel_atual() = 'dono');
