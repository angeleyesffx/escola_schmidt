-- Escola Schmidt — módulos viram uma entidade nomeada (catálogo leve)
-- Rodar em: Supabase > SQL Editor, depois de 0039_data_nascimento_obrigatoria_app.sql

-- Até aqui, "módulo" era só um smallint 1-4 hardcoded em 4 tabelas e em 3
-- constantes MODULOS=[1,2,3,4] duplicadas na UI — o dono não conseguia criar
-- um 5º módulo, renomear ou desativar um sem editar código (pedido direto do
-- usuário, 2026-09-22).
--
-- Decisão: catálogo leve, chave = o próprio smallint já em uso — não troca
-- alunos.modulo/professores_aula.modulo/testes_nivel.modulo_de/modulo_para/
-- aulas_recorrentes.modulos pra uuid. Isso significa ZERO mudança nas 5
-- funções/policies de RLS que hoje comparam essas colunas direto
-- (sou_professor_do_pedido, sou_responsavel_pelo_aluno, aula_autocriacao_
-- aluno, pedido_criacao_aluno, perfil_leitura_professor_da_minha_aula) e nos
-- 2 triggers que escrevem alunos.modulo (aplica_teste_nivel,
-- aplica_promocao_nivel_evolucao) — continuam comparando/escrevendo smallint
-- exatamente como hoje. As colunas só ganham uma FK pra integridade
-- referencial, e os CHECK hardcoded em "between 1 and 4" saem (não fazia
-- sentido travar em 4 se o catálogo agora decide quais números existem).

create table modulos (
  numero    smallint primary key,
  nome      text not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into modulos (numero, nome) values (1, 'Módulo 1'), (2, 'Módulo 2'), (3, 'Módulo 3'), (4, 'Módulo 4');

alter table modulos enable row level security;

grant select on public.modulos to anon;
grant select, insert, update, delete on public.modulos to authenticated;
grant select, insert, update, delete on public.modulos to service_role;

-- Mesmo padrão de tipos_evento (0003): todo mundo autenticado lê, só dono
-- altera — módulo é decisão estrutural da grade, mesma trava de "Grade
-- semanal" (configuracoes/grade-semanal.tsx, dono-only).
create policy modulo_leitura on modulos
  for select using (auth.uid() is not null);
create policy modulo_escrita on modulos
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

-- FK + relaxamento dos CHECK hardcoded. Nomes de constraint conferidos contra
-- a convenção padrão do Postgres (`<tabela>_<coluna>_check` pra CHECK sem
-- nome explícito, que é como as 5 foram criadas em 0001/0005).
alter table alunos
  add constraint alunos_modulo_fkey foreign key (modulo) references modulos (numero),
  drop constraint alunos_modulo_check;

alter table professores_aula
  add constraint professores_aula_modulo_fkey foreign key (modulo) references modulos (numero),
  drop constraint professores_aula_modulo_check;

alter table testes_nivel
  add constraint testes_nivel_modulo_de_fkey foreign key (modulo_de) references modulos (numero),
  add constraint testes_nivel_modulo_para_fkey foreign key (modulo_para) references modulos (numero),
  drop constraint testes_nivel_modulo_de_check,
  drop constraint testes_nivel_modulo_para_check;

-- aulas_recorrentes.modulos é array — Postgres não tem FK nativa em array.
-- Troca o CHECK estático (modulos <@ array[1,2,3,4]) por uma trigger de
-- validação: cada número no array precisa existir em `modulos`.
alter table aulas_recorrentes drop constraint aulas_recorrentes_modulos_check;

create function valida_modulos_grade() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from unnest(new.modulos) m where not exists (select 1 from modulos where numero = m)
  ) then
    raise exception 'Módulo inválido na grade.';
  end if;
  return new;
end;
$$;

create trigger valida_modulos_grade_trigger
  before insert or update on aulas_recorrentes
  for each row execute function valida_modulos_grade();
