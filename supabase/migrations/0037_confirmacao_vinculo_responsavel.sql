-- Escola Schmidt — vínculo por e-mail passa a exigir confirmação de quem recebeu
-- Rodar em: Supabase > SQL Editor, depois de 0036_marcar_presenca_atomico.sql

-- Achado #3 da revisão de segurança de 2026-09-21: vincula_aluno_por_email e
-- vincula_perfil_por_email_no_aluno (0020, redefinidas em 0033 pra ligar mais
-- de um aluno de uma vez) casam alunos.responsavel_email — um campo comum,
-- editável por qualquer membro da equipe (eh_equipe()) — contra o e-mail de
-- uma conta já existente e, se bater, dão a essa conta acesso imediato à
-- frequência/avaliações da criança, sem confirmação nenhuma de que quem está
-- do outro lado do e-mail é de fato o responsável por ela. Um professor
-- apressado (ou um typo) em responsavel_email dá acesso de responsável a uma
-- conta qualquer sobre uma criança sem relação nenhuma com ela.
--
-- Fecha isso com um estado "pendente": o vínculo automático por e-mail passa
-- a nascer sem confirmação, e nenhuma RLS de self-service (contratos,
-- presenças, avaliações, aulas particulares etc.) concede acesso a ele até a
-- própria conta confirmar ("Você é responsável por [nome]?"). Enquanto
-- pendente, a linha inteira de `alunos` (data de nascimento, telefone do
-- outro responsável) também fica fora — só o nome, via
-- meus_vinculos_pendentes() abaixo, que é o mínimo pra tela de confirmação
-- fazer sentido. O vínculo feito por convite explícito da equipe
-- (convidar-aluno) nasce confirmado: ali a equipe escolheu o aluno_id e o
-- e-mail no mesmo ato, não é um match cego contra qualquer conta pré-existente.

-- ---------------------------------------------------------------------------
-- 1) Coluna de confirmação. Vínculos já existentes são considerados
-- confirmados (não retroagimos um bloqueio sobre quem já usa o app hoje) —
-- só vínculos NOVOS por e-mail, a partir desta migration, nascem pendentes.
-- ---------------------------------------------------------------------------

alter table alunos add column vinculo_confirmado_em timestamptz;
update alunos set vinculo_confirmado_em = now() where perfil_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Helper: "auth.uid() tem vínculo CONFIRMADO com esse aluno" — substitui,
-- em toda RLS de self-service, o antigo `exists (select 1 from alunos a
-- where a.id = p_aluno_id and a.perfil_id = auth.uid())`. SECURITY DEFINER
-- pelo mesmo motivo de papel_atual() (0001): esta function é usada dentro da
-- própria policy de leitura de `alunos` (aluno_leitura, abaixo) — sem
-- SECURITY DEFINER, a consulta interna a `alunos` reentraria na mesma RLS
-- que está sendo avaliada (recursão infinita, erro clássico de RLS no
-- Supabase). Fica seguro porque só devolve um boolean estreito, sempre
-- amarrado a auth.uid() — não abre leitura nenhuma pro chamador.
-- ---------------------------------------------------------------------------

create function tenho_vinculo_confirmado(p_aluno_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from alunos a
     where a.id = p_aluno_id
       and a.perfil_id = auth.uid()
       and a.vinculo_confirmado_em is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Vínculo automático por e-mail (0033) passa a nascer pendente — só marca
-- perfil_id, nunca vinculo_confirmado_em.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 4) Convite explícito (convidar-aluno, via vincula_convite_aluno de 0034)
-- nasce confirmado — é ação direta da equipe sobre um aluno_id escolhido por
-- ela, não um match automático contra uma conta pré-existente qualquer.
-- ---------------------------------------------------------------------------

create or replace function vincula_convite_aluno(p_aluno_id uuid, p_perfil_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_linhas int;
begin
  update perfis set papel = 'responsavel' where id = p_perfil_id and papel = 'aluno';
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    return false;
  end if;

  update alunos
     set perfil_id = p_perfil_id, vinculo_confirmado_em = now()
   where id = p_aluno_id and perfil_id is null;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Aluno já vinculado ou não encontrado.';
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs que a própria conta usa pra decidir sobre um vínculo pendente.
-- Confirmar dá acesso de verdade (é o que os "and vinculo_confirmado_em is
-- not null" abaixo passam a exigir); recusar desfaz o vínculo (não apaga
-- responsavel_email — fica pro staff revisar/corrigir na ficha do aluno).
-- ---------------------------------------------------------------------------

create function confirmar_meu_vinculo(p_aluno_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alunos
     set vinculo_confirmado_em = now()
   where id = p_aluno_id
     and perfil_id = auth.uid()
     and vinculo_confirmado_em is null;

  if not found then
    raise exception 'Vínculo não encontrado ou já confirmado.';
  end if;
end;
$$;

grant execute on function confirmar_meu_vinculo(uuid) to authenticated;

create function recusar_meu_vinculo(p_aluno_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alunos
     set perfil_id = null
   where id = p_aluno_id
     and perfil_id = auth.uid()
     and vinculo_confirmado_em is null;

  if not found then
    raise exception 'Vínculo não encontrado ou já confirmado.';
  end if;
end;
$$;

grant execute on function recusar_meu_vinculo(uuid) to authenticated;

-- Só nome e id, pra tela "Você é responsável por [nome]?" — nada do resto da
-- ficha (nascimento, telefone do outro responsável) antes de confirmar.
create function meus_vinculos_pendentes() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select a.id, a.nome
    from alunos a
   where a.perfil_id = auth.uid()
     and a.vinculo_confirmado_em is null;
$$;

grant execute on function meus_vinculos_pendentes() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) RLS de self-service: troca cada `exists (select 1 from alunos a where
-- a.id = X and a.perfil_id = auth.uid())` (ou equivalente) por
-- `tenho_vinculo_confirmado(X)`. Isso inclui a própria `aluno_leitura`
-- (0001) — a leitura direta da linha exige confirmado; enquanto pendente, só
-- meus_vinculos_pendentes() acima expõe o suficiente pra decidir.
-- ---------------------------------------------------------------------------

drop policy aluno_leitura on alunos;
create policy aluno_leitura on alunos
  for select using (eh_equipe() or tenho_vinculo_confirmado(id));

drop policy contrato_leitura on contratos;
create policy contrato_leitura on contratos
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy teste_leitura on testes_nivel;
create policy teste_leitura on testes_nivel
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy presenca_leitura on presencas;
create policy presenca_leitura on presencas
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy avaliacao_leitura on avaliacoes_desempenho;
create policy avaliacao_leitura on avaliacoes_desempenho
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy aula_autocriacao_aluno on aulas;
create policy aula_autocriacao_aluno on aulas
  for insert
  with check (
    tipo = 'regular'
    and data = current_date
    and exists (
      select 1
        from aulas_recorrentes ar
        join alunos a on a.perfil_id = auth.uid() and a.vinculo_confirmado_em is not null
       where ar.id = aula_recorrente_id
         and ar.ativo
         and ar.dia_semana = extract(dow from current_date)
         and ar.modulos @> array[a.modulo]::smallint[]
    )
  );

drop policy pedido_leitura on pedidos_presenca;
create policy pedido_leitura on pedidos_presenca
  for select using (
    papel_atual() = 'dono'
    or (papel_atual() = 'professor' and sou_professor_do_pedido(aula_id, aluno_id))
    or tenho_vinculo_confirmado(aluno_id)
  );

drop policy pedido_criacao_aluno on pedidos_presenca;
create policy pedido_criacao_aluno on pedidos_presenca
  for insert
  with check (
    tenho_vinculo_confirmado(aluno_id)
    and exists (
      select 1
        from aulas au
        join aulas_recorrentes ar on ar.id = au.aula_recorrente_id
        join alunos a on a.id = aluno_id
       where au.id = aula_id
         and au.tipo = 'regular'
         and au.data = current_date
         and ar.modulos @> array[a.modulo]::smallint[]
    )
  );

drop policy perfil_leitura_professor_da_minha_aula on perfis;
create policy perfil_leitura_professor_da_minha_aula on perfis
  for select using (
    papel = 'professor'
    and exists (
      select 1
        from professores_aula pa
        join alunos a on a.perfil_id = auth.uid() and a.vinculo_confirmado_em is not null
       where pa.professor_id = perfis.id
         and pa.modulo = a.modulo
    )
  );

drop policy aluno_metodologia_leitura on aluno_metodologias;
create policy aluno_metodologia_leitura on aluno_metodologias
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy avaliacao_evolucao_leitura on avaliacoes_evolucao;
create policy avaliacao_evolucao_leitura on avaliacoes_evolucao
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy avaliacao_criterio_evolucao_leitura on avaliacao_criterios_evolucao;
create policy avaliacao_criterio_evolucao_leitura on avaliacao_criterios_evolucao
  for select using (
    eh_equipe()
    or exists (
      select 1 from avaliacoes_evolucao ae
       where ae.id = avaliacao_id
         and tenho_vinculo_confirmado(ae.aluno_id)
    )
  );

drop policy status_habilidade_aluno_leitura on status_habilidade_aluno;
create policy status_habilidade_aluno_leitura on status_habilidade_aluno
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

drop policy historico_nivel_evolucao_leitura on historico_nivel_evolucao;
create policy historico_nivel_evolucao_leitura on historico_nivel_evolucao
  for select using (eh_equipe() or tenho_vinculo_confirmado(aluno_id));

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

  update alunos
    set nome = p_nome,
        data_nascimento = p_data_nascimento,
        responsavel_nome = p_responsavel_nome,
        responsavel_telefone = p_responsavel_telefone
    where id = p_aluno_id;
end;
$$;

drop policy aula_leitura on aulas;
create policy aula_leitura on aulas
  for select using (
    tipo <> 'particular'
    or papel_atual() = 'dono'
    or aulas.professor_id = auth.uid()
    or tenho_vinculo_confirmado(aulas.aluno_id)
  );

create or replace function sou_dono_da_particular(p_professor_id uuid, p_aluno_id uuid) returns boolean
language sql stable as $$
  select
    papel_atual() = 'dono'
    or (eh_equipe() and p_professor_id = auth.uid())
    or tenho_vinculo_confirmado(p_aluno_id);
$$;

drop policy aula_insercao on aulas;
create policy aula_insercao on aulas
  for insert
  with check (
    (tipo = 'regular' and eh_equipe() and sou_responsavel_pela_aula(aula_recorrente_id))
    or (tipo = 'reposicao' and eh_equipe())
    or (tipo = 'particular' and eh_equipe())
    or (
      tipo = 'particular'
      and tenho_vinculo_confirmado(aluno_id)
      and exists (select 1 from horarios_livres_particular(professor_id, data) h where h.hora = aulas.hora)
    )
  );
