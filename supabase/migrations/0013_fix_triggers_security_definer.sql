-- Escola Schmidt — corrige triggers de avaliacoes_evolucao sem SECURITY DEFINER
-- Rodar em: Supabase > SQL Editor, depois de 0012_editar_dados_aluno.sql

-- audita_avaliacoes_evolucao() e sincroniza_status_habilidade_aluno() escrevem
-- em tabelas protegidas por RLS (auditoria_avaliacoes_evolucao tem
-- "with check (false)" — só o próprio trigger pode escrever nela;
-- status_habilidade_aluno exige eh_equipe()). Sem SECURITY DEFINER, os dois
-- rodam com o papel de quem disparou o UPDATE em avaliacoes_evolucao —
-- inclusive um UPDATE em cascata (on delete set null) ao apagar um usuário em
-- auth.users, que roda sem sessão (auth.uid() nulo) e sem bypass de RLS.
-- Resultado: apagar um professor/dono referenciado em alguma avaliação trava
-- com "Database error deleting user" porque o cascade esbarra nessas policies.
create or replace function audita_avaliacoes_evolucao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload_antes jsonb;
  payload_depois jsonb;
  alvo_id uuid;
  alvo_aluno_id uuid;
  alvo_habilidade_id uuid;
begin
  if tg_op = 'INSERT' then
    payload_antes = null;
    payload_depois = to_jsonb(new);
    alvo_id = new.id;
    alvo_aluno_id = new.aluno_id;
    alvo_habilidade_id = new.habilidade_id;
  elsif tg_op = 'UPDATE' then
    payload_antes = to_jsonb(old);
    payload_depois = to_jsonb(new);
    alvo_id = new.id;
    alvo_aluno_id = new.aluno_id;
    alvo_habilidade_id = new.habilidade_id;
  else
    payload_antes = to_jsonb(old);
    payload_depois = null;
    alvo_id = old.id;
    alvo_aluno_id = old.aluno_id;
    alvo_habilidade_id = old.habilidade_id;
  end if;

  insert into auditoria_avaliacoes_evolucao (
    avaliacao_id,
    aluno_id,
    habilidade_id,
    operacao,
    executado_por,
    payload_antes,
    payload_depois
  ) values (
    alvo_id,
    alvo_aluno_id,
    alvo_habilidade_id,
    lower(tg_op),
    auth.uid(),
    payload_antes,
    payload_depois
  );

  return coalesce(new, old);
end;
$$;

create or replace function sincroniza_status_habilidade_aluno() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  avaliacao_atual avaliacoes_evolucao%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into avaliacao_atual
      from avaliacoes_evolucao ae
     where ae.aluno_id = old.aluno_id
       and ae.habilidade_id = old.habilidade_id
     order by ae.data_avaliacao desc, ae.criado_em desc
     limit 1;

    if avaliacao_atual.id is null then
      delete from status_habilidade_aluno
       where aluno_id = old.aluno_id
         and habilidade_id = old.habilidade_id;
      return old;
    end if;
  else
    select * into avaliacao_atual
      from avaliacoes_evolucao ae
     where ae.aluno_id = new.aluno_id
       and ae.habilidade_id = new.habilidade_id
     order by ae.data_avaliacao desc, ae.criado_em desc
     limit 1;
  end if;

  insert into status_habilidade_aluno (
    aluno_id,
    habilidade_id,
    ultima_avaliacao_id,
    status_atual,
    percentual_atual,
    precisa_atencao,
    prioridade_atual,
    atualizado_em
  ) values (
    avaliacao_atual.aluno_id,
    avaliacao_atual.habilidade_id,
    avaliacao_atual.id,
    avaliacao_atual.status,
    avaliacao_atual.percentual_geral,
    avaliacao_atual.precisa_atencao,
    avaliacao_atual.prioridade_treinamento,
    now()
  )
  on conflict (aluno_id, habilidade_id) do update set
    ultima_avaliacao_id = excluded.ultima_avaliacao_id,
    status_atual = excluded.status_atual,
    percentual_atual = excluded.percentual_atual,
    precisa_atencao = excluded.precisa_atencao,
    prioridade_atual = excluded.prioridade_atual,
    atualizado_em = excluded.atualizado_em;

  return coalesce(new, old);
end;
$$;
