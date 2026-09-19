-- Escola Schmidt — aluno vê o(s) professor(es) do próprio módulo
-- Rodar em: Supabase > SQL Editor, depois de 0005_pedido_presenca_professor.sql

-- perfis só é legível pelo próprio dono da linha (ou pelo dono da escola),
-- então sem isso o app não conseguia mostrar o nome do professor pro aluno.
-- Abre leitura só do necessário: nome/telefone de um professor vinculado
-- (via professores_aula) ao módulo do aluno — não abre pra alunos em geral
-- nem pra professores de outros módulos.
create policy perfil_leitura_professor_da_minha_aula on perfis
  for select using (
    papel = 'professor'
    and exists (
      select 1
        from professores_aula pa
        join alunos a on a.perfil_id = auth.uid()
       where pa.professor_id = perfis.id
         and pa.modulo = a.modulo
    )
  );
