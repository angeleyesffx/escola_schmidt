-- Escola Schmidt — registrar "nível conquistado" e propagar pro módulo do aluno
-- Rodar em: Supabase > SQL Editor, depois de 0024_atribuir_metodologia_aluno.sql

-- Fase 4, passo 2 (docs/product/evolucao-vs-desempenho.md achado 4.4 + decisão 5).
-- Duas peças que faltavam juntas, não só o trigger: não existia, em
-- nenhuma tela ou função, um jeito de inserir em historico_nivel_evolucao
-- fora do seed (0009) — só leitura (getHistoricoNivelAluno). E o único
-- mecanismo que hoje move alunos.modulo de verdade é o legado
-- aplica_teste_nivel (0001, em cima de testes_nivel). Esta migration cria
-- o caminho de escrita novo e o troca pra ser a fonte da verdade, sem
-- desligar o legado ainda (isso é decisão separada, só depois que este
-- caminho estiver testado em uso real).

-- ---------------------------------------------------------------------------
-- RPC: staff registra que o aluno conquistou um nível. Mesmo espírito de
-- registrar_avaliacao_evolucao (0010) — não é security definer, a RLS de
-- historico_nivel_evolucao_escrita (eh_equipe(), 0008) já cobre quem pode
-- chamar; a função só valida a regra de negócio com mensagem amigável.
-- ---------------------------------------------------------------------------

create or replace function registrar_promocao_nivel(
  p_aluno_id     uuid,
  p_nivel_id     uuid,
  p_data_evento  date default current_date,
  p_observacoes  text default null
) returns uuid
language plpgsql
as $$
declare
  v_metodologia_id uuid;
  v_id uuid;
begin
  if not eh_equipe() then
    raise exception 'Apenas a equipe pode registrar promoção de nível.';
  end if;

  select am.metodologia_id
    into v_metodologia_id
    from aluno_metodologias am
   where am.aluno_id = p_aluno_id
     and am.data_fim is null;

  if v_metodologia_id is null then
    raise exception 'Aluno não tem metodologia ativa.';
  end if;

  if not exists (
    select 1 from niveis_evolucao ne
     where ne.id = p_nivel_id and ne.metodologia_id = v_metodologia_id
  ) then
    raise exception 'Nível informado não pertence à metodologia ativa do aluno.';
  end if;

  insert into historico_nivel_evolucao (
    aluno_id, metodologia_id, nivel_id, tipo, data_evento, registrado_por, observacoes
  ) values (
    p_aluno_id, v_metodologia_id, p_nivel_id, 'promovido', p_data_evento, auth.uid(), p_observacoes
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function registrar_promocao_nivel(uuid, uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: todo insert tipo='promovido' em historico_nivel_evolucao (por
-- esta RPC ou qualquer outro caminho futuro) avança nivel_atual_id na
-- atribuição ativa e alunos.modulo — equivalente a aplica_teste_nivel
-- (0001), mas na estrutura nova. SECURITY DEFINER necessário: quem dispara
-- isso pode ser professor, e aluno_metodologias só aceita escrita direta de
-- dono (aluno_metodologia_escrita, 0007) — mesmo padrão já usado em
-- audita_avaliacoes_evolucao/sincroniza_status_habilidade_aluno (0013) pra
-- efeito colateral automático que não deveria depender do papel de quem
-- disparou o evento original. alunos.modulo em si já é eh_equipe() (0014),
-- não precisaria do bypass sozinho, mas a função inteira já está definer.
-- ---------------------------------------------------------------------------

create function aplica_promocao_nivel_evolucao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo <> 'promovido' then
    return new;
  end if;

  update aluno_metodologias
     set nivel_atual_id = new.nivel_id
   where aluno_id = new.aluno_id
     and metodologia_id = new.metodologia_id
     and data_fim is null;

  -- Mesma correspondência ordem-de-nível -> módulo já assumida no backfill
  -- de 0009 (join niveis n on n.ordem = least(greatest(a.modulo, 1), 4)).
  update alunos
     set modulo = least(greatest((select ne.ordem from niveis_evolucao ne where ne.id = new.nivel_id), 1), 4)
   where id = new.aluno_id;

  return new;
end;
$$;

create trigger trg_aplica_promocao_nivel_evolucao
  after insert on historico_nivel_evolucao
  for each row execute function aplica_promocao_nivel_evolucao();
