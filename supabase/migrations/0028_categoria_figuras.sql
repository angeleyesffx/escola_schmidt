-- Escola Schmidt — "Figuras" vira categoria propria, separada de "Fundamentos"
-- Rodar em: Supabase > SQL Editor, depois de 0027_aula_teste_candidatos.sql

-- Retomada de 2026-09-20 (docs/product/evolucao-vs-desempenho.md secao 7-8),
-- confirmada de forma independente por 4 regulamentos oficiais de patinacao
-- (FCPA/FGP/FPPA/FPP, CSB, torneio estadual, tabela RollArt): "Figura de
-- Alongamento" e uma categoria tecnica formal, distinta de Saltos/Giros/
-- Passos/Fundamentos, com elemento obrigatorio proprio em toda categoria de
-- base e tabela de bonificacao por posicao propria.
--
-- Achado confirmado (secao 7.3.1): o `case` de categorizacao em
-- 0009_minha_evolucao_seed.sql (linha ~67) nao tinha regra explicita pra
-- "Figuras de alongamento" e ela caiu no `else -> 'fundamentos'` — dado ja
-- em producao esta categorizado errado. Precisa rodar antes da tela de
-- catalogo do dono existir, senao a primeira coisa que ele ve la e um dado
-- incoerente com a decisao ja tomada.

with modalidade_livre as (
  select id from modalidades_evolucao where slug = 'livre'
)
insert into categorias_habilidade (modalidade_id, nome, slug, descricao, ordem, ativo)
select
  modalidade_livre.id,
  'Figuras',
  'figuras',
  'Figuras de alongamento — posicoes de eixo, extensao e apresentacao tecnica.',
  6,
  true
from modalidade_livre
on conflict (modalidade_id, slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  ativo = true;

update habilidades_catalogo hc
   set categoria_id = (
     select ch.id
       from categorias_habilidade ch
       join modalidades_evolucao me on me.id = ch.modalidade_id
      where me.slug = 'livre' and ch.slug = 'figuras'
   )
 where hc.slug = 'figuras-alongamento';
