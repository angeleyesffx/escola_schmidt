-- Escola Schmidt — professor ativo/inativo
-- Rodar em: Supabase > SQL Editor, depois de 0014_professor_cadastra_aluno.sql

-- Sem isso não dava pra tirar um professor que saiu da escola da lista de
-- "quem pode dar aula particular" sem apagar o perfil dele (e junto o
-- histórico de aulas, avaliações etc. que referenciam esse id).
alter table perfis add column ativo boolean not null default true;
