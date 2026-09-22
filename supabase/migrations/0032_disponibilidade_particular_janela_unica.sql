-- Escola Schmidt — só 'unica' pode representar um único dia de disponibilidade
-- Rodar em: Supabase > SQL Editor, depois de 0031_pontuacao_habilidade.sql

-- Simplificação decidida em 2026-09-20 (conversa sobre chamada-agenda-
-- frequencia.md §... "disponibilidade de particular"), depois de um bug real
-- encontrado em produção de dev: com data_inicio = data_fim, 'diaria',
-- 'semanal', 'mensal' e 'anual' colapsam todas pro mesmo único dia que
-- 'unica' já representa — nada impedia cadastrar a mesma janela duas vezes
-- sob rótulos de recorrência diferentes (ex.: "Mensalmente 20/09→20/09" e
-- "Diariamente 20/09→20/09", ambas só ocorrendo em 20/09). Em vez de detectar
-- essa ambiguidade depois (via overlap na tela), a decisão foi eliminar a
-- ambiguidade na origem: só 'unica' pode representar 1 dia só; toda
-- recorrência de verdade exige data_fim estritamente depois de data_inicio.

-- ---------------------------------------------------------------------------
-- Limpeza de dado já existente, na ordem: primeiro colapsa toda recorrência
-- degenerada (data_fim = data_inicio) pra 'unica', depois funde em 1 linha só
-- as que virarem duplicata de fato (mesmo professor + mesmo dia).
-- ---------------------------------------------------------------------------

update disponibilidade_particular
   set tipo_recorrencia = 'unica', data_fim = null
 where tipo_recorrencia <> 'unica' and data_fim = data_inicio;

do $$
declare
  grupo record;
  id_mantido uuid;
begin
  for grupo in
    select professor_id, data_inicio
      from disponibilidade_particular
     where tipo_recorrencia = 'unica'
     group by professor_id, data_inicio
    having count(*) > 1
  loop
    select id into id_mantido
      from disponibilidade_particular
     where professor_id = grupo.professor_id
       and data_inicio = grupo.data_inicio
       and tipo_recorrencia = 'unica'
     order by criado_em
     limit 1;

    update disponibilidade_particular
       set horas = (
         select array_agg(distinct hora order by hora)
           from disponibilidade_particular d2, unnest(d2.horas) as hora
          where d2.professor_id = grupo.professor_id
            and d2.data_inicio = grupo.data_inicio
            and d2.tipo_recorrencia = 'unica'
       )
     where id = id_mantido;

    delete from disponibilidade_particular
     where professor_id = grupo.professor_id
       and data_inicio = grupo.data_inicio
       and tipo_recorrencia = 'unica'
       and id <> id_mantido;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Aperta a constraint: antes só exigia data_fim >= data_inicio (quando não
-- nulo); agora, fora de 'unica', exige data_fim > data_inicio, e 'unica'
-- passa a exigir data_fim nulo (já era sempre assim na prática, via
-- criarDisponibilidade — isso só torna a garantia explícita no banco).
-- ---------------------------------------------------------------------------

alter table disponibilidade_particular drop constraint periodo_valido;

alter table disponibilidade_particular add constraint periodo_valido check (
  case when tipo_recorrencia = 'unica' then data_fim is null
       else data_fim > data_inicio
  end
);
