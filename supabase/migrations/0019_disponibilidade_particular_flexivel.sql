-- Escola Schmidt — disponibilidade de particular deixa de ser "toda X-feira
-- pra sempre" e passa a aceitar data única (com um ou mais horários) ou
-- recorrência diária/semanal/mensal/anual dentro de um intervalo com início
-- e fim. Recria a tabela em vez de fazer ALTER incremental — ainda não tem
-- linha em produção (o app nem chegou a ser publicado com 0016), e a troca
-- de forma (dia_semana/hora fixos → data_inicio/data_fim/tipo_recorrencia/
-- horas[]) é grande demais pra valer a pena simular com ALTER.
-- Rodar em: Supabase > SQL Editor, depois de 0018_professor_modulos_e_aula_teste.sql

drop trigger trg_valida_disponibilidade_particular on disponibilidade_particular;
drop function valida_disponibilidade_particular();
drop table disponibilidade_particular;

create type tipo_recorrencia as enum ('unica', 'diaria', 'semanal', 'mensal', 'anual');

create table disponibilidade_particular (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null references perfis (id) on delete cascade,
  data_inicio      date not null,
  -- Só obrigatório quando repete: é o que limita "semanal" etc a não valer
  -- pra sempre. Em 'unica' fica null (é so aquele dia).
  data_fim         date,
  tipo_recorrencia tipo_recorrencia not null default 'unica',
  -- Um mesmo padrão de data pode abrir vários horários de uma vez (ex.: toda
  -- terça das 18h às 21h, de hora em hora) — por isso array, não 1 linha por hora.
  horas            time[] not null,
  criado_em        timestamptz not null default now(),
  constraint horas_nao_vazias check (array_length(horas, 1) > 0),
  constraint recorrencia_tem_fim check (tipo_recorrencia = 'unica' or data_fim is not null),
  constraint periodo_valido check (data_fim is null or data_fim >= data_inicio)
);

create index on disponibilidade_particular (professor_id);

-- Diz se `p_data` é uma ocorrência do padrão (tipo + início + fim). Mensal
-- ancorado num dia 29/30/31 simplesmente não ocorre nos meses mais curtos —
-- comportamento aceito aqui, não corrigido pra "último dia do mês".
create function ocorre_na_data(p_tipo tipo_recorrencia, p_data_inicio date, p_data_fim date, p_data date)
returns boolean
language sql immutable as $$
  select case p_tipo
    when 'unica' then p_data = p_data_inicio
    when 'diaria' then p_data between p_data_inicio and p_data_fim
    when 'semanal' then p_data between p_data_inicio and p_data_fim
      and extract(dow from p_data) = extract(dow from p_data_inicio)
    when 'mensal' then p_data between p_data_inicio and p_data_fim
      and extract(day from p_data) = extract(day from p_data_inicio)
    when 'anual' then p_data between p_data_inicio and p_data_fim
      and extract(month from p_data) = extract(month from p_data_inicio)
      and extract(day from p_data) = extract(day from p_data_inicio)
  end;
$$;

-- Substitui o cálculo que antes vivia espalhado em 3 queries no client
-- (getHorariosLivresProfessor) agora que "que dia é esse" não é mais um
-- dia_semana fixo guardado na linha, e sim algo que só a função sabe resolver
-- pra uma data concreta. Cruza: horários que o professor abriu e que caem
-- nessa data (via ocorre_na_data) menos o que já está ocupado por aula
-- regular (professores_aula + aulas_recorrentes, no dia da semana de p_data)
-- e por outra particular já marcada nesse mesmo dia.
create function horarios_livres_particular(p_professor_id uuid, p_data date)
returns table (hora time)
language sql stable as $$
  with candidatas as (
    select distinct unnest(d.horas) as hora
      from disponibilidade_particular d
     where d.professor_id = p_professor_id
       and ocorre_na_data(d.tipo_recorrencia, d.data_inicio, d.data_fim, p_data)
  ),
  ocupadas_regulares as (
    select ar.hora
      from professores_aula pa
      join aulas_recorrentes ar on ar.id = pa.aula_recorrente_id
     where pa.professor_id = p_professor_id
       and ar.ativo
       and ar.dia_semana = extract(dow from p_data)::smallint
  ),
  ocupadas_particulares as (
    select hora from aulas
     where professor_id = p_professor_id and tipo = 'particular' and data = p_data
  )
  select hora from candidatas
  except
  select hora from ocupadas_regulares
  except
  select hora from ocupadas_particulares
  order by hora;
$$;

grant execute on function ocorre_na_data(tipo_recorrencia, date, date, date) to authenticated;
grant execute on function horarios_livres_particular(uuid, date) to authenticated;

alter table disponibilidade_particular enable row level security;

-- Mesmas policies de antes (0016) — só o formato dos dados embaixo mudou.
create policy disponibilidade_leitura on disponibilidade_particular
  for select using (auth.uid() is not null);

create policy disponibilidade_escrita on disponibilidade_particular
  for all using (eh_equipe() and (papel_atual() = 'dono' or professor_id = auth.uid()))
  with check (eh_equipe() and (papel_atual() = 'dono' or professor_id = auth.uid()));
