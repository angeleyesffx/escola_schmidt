-- Escola Schmidt - agendamentos nao retroativos
-- Apenas novas aulas particulares e aulas teste precisam ser futuras.
-- Chamadas regulares historicas continuam permitidas.

create or replace function valida_data_agendamento_futura() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data < current_date then
    raise exception 'A data do agendamento nao pode ser retroativa.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_valida_data_particular_futura on aulas;
create trigger trg_valida_data_particular_futura
  before insert or update of data on aulas
  for each row
  when (new.tipo = 'particular')
  execute function valida_data_agendamento_futura();

drop trigger if exists trg_valida_data_teste_futura on aulas_teste;
create trigger trg_valida_data_teste_futura
  before insert or update of data on aulas_teste
  for each row execute function valida_data_agendamento_futura();
