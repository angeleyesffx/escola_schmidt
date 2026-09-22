-- Escola Schmidt — marcarPresenca vira uma função atômica no banco
-- Rodar em: Supabase > SQL Editor, depois de 0035_trava_autoavaliacao_evolucao.sql

-- Até aqui, marcarPresenca (src/features/chamada/api.ts) fazia SELECT do
-- registrado_em atual, comparava com a versão conhecida pelo client, e só
-- então fazia o UPSERT — duas idas separadas ao banco. Dois dispositivos
-- marcando o mesmo aluno na mesma janela podiam ambos ler a mesma versão
-- antiga, ambos passar na checagem, e um sobrescrever o outro sem nenhum
-- conflito detectado — exatamente o cenário que ConflitoPresencaError existe
-- pra pegar, só que a checagem em si não era atômica. Esta função faz leitura
-- e escrita condicional num único statement (INSERT ... ON CONFLICT DO
-- NOTHING quando não havia registro, UPDATE ... WHERE registrado_em = versão
-- conhecida quando havia), então a corrida deixa de ser possível: ou a
-- condição bate e a escrita acontece, ou não bate e zero linhas são afetadas.
--
-- security invoker (padrão, não security definer): RLS de presenca_escrita
-- (0022) continua valendo exatamente como antes — esta função não abre
-- nenhum acesso novo, só torna atômico o que já era permitido.
--
-- set search_path = public: mesmo não sendo security definer (onde isso é
-- crítico pra evitar sequestro de search_path), fixar aqui evita qualquer
-- ambiguidade sobre em qual schema `presencas`/`status_presenca` resolvem,
-- e deixa a função alinhada ao lint padrão do Supabase ("Function Search
-- Path Mutable"), que cobre toda função, não só as security definer.
--
-- errcode 'P0100' em vez de deixar o default (P0001, genérico de
-- `raise exception`): o client (marcarPresenca, src/features/chamada/api.ts)
-- detectava esse conflito por substring na mensagem de erro
-- (`error.message.includes('conflito_presenca')`) — funcionava, mas casava
-- por texto solto. Um SQLSTATE dedicado dá um contrato mais preciso pro
-- client checar (`error.code === 'P0100'`), sem depender da mensagem ficar
-- exatamente igual.

create or replace function marcar_presenca(
  p_aula_id           uuid,
  p_aluno_id          uuid,
  p_status            status_presenca,
  p_registrado_por    uuid,
  p_versao_conhecida  timestamptz
) returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  v_agora   timestamptz := now();
  v_linhas  int;
begin
  if p_versao_conhecida is null then
    insert into presencas (aula_id, aluno_id, status, registrado_por, registrado_em)
    values (p_aula_id, p_aluno_id, p_status, p_registrado_por, v_agora)
    on conflict (aula_id, aluno_id) do nothing;
  else
    update presencas
       set status = p_status, registrado_por = p_registrado_por, registrado_em = v_agora
     where aula_id = p_aula_id
       and aluno_id = p_aluno_id
       and registrado_em = p_versao_conhecida;
  end if;

  get diagnostics v_linhas = row_count;

  if v_linhas = 0 then
    raise exception 'conflito_presenca' using errcode = 'P0100';
  end if;

  return v_agora;
end;
$$;

grant execute on function marcar_presenca(uuid, uuid, status_presenca, uuid, timestamptz) to authenticated;
