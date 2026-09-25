-- Permite ao staff definir o horário regular principal do aluno no cadastro.
-- Alunos antigos permanecem sem horário e continuam aparecendo em qualquer
-- chamada compatível com o módulo até serem atualizados.
alter table alunos
  add column if not exists aula_recorrente_id uuid references aulas_recorrentes (id) on delete set null;

create index if not exists alunos_aula_recorrente_id_idx on alunos (aula_recorrente_id);