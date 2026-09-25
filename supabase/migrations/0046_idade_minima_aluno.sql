-- Escola Schmidt - idade minima para matricula
-- Novos alunos precisam ter pelo menos 3 anos completos na data do cadastro.

create or replace function valida_idade_minima_aluno() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.data_nascimento is null then
    raise exception 'Informe a data de nascimento do aluno.';
  end if;

  if new.data_nascimento is not null
     and new.data_nascimento > (current_date - interval '3 years')::date then
    raise exception 'O aluno precisa ter pelo menos 3 anos completos para ser matriculado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_valida_idade_minima_aluno on alunos;
create trigger trg_valida_idade_minima_aluno
  before insert or update of data_nascimento on alunos
  for each row execute function valida_idade_minima_aluno();
