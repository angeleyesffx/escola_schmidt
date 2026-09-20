-- Escola Schmidt — valor base por habilidade, pra compor a pontuação do aluno
-- Rodar em: Supabase > SQL Editor, depois de 0030_papel_responsavel_no_vinculo.sql

-- docs/product/evolucao-vs-desempenho.md §8.2: mesmo principio das tabelas
-- oficiais de patinação (BASYS/RollArt/regulamentos estaduais) — cada
-- elemento tem um valor base, ajustado por um fator de qualidade da
-- execução, gerando a pontuação daquele elemento. `valor_base` é o "quanto
-- vale essa habilidade/figura", independente de quem a executa; o fator de
-- qualidade vem do status/percentual que a avaliação já grava (sem coluna
-- nova pra isso — é uma função pura sobre o que já existe).
--
-- Default 1 (não 0): habilidade recém-criada participa da pontuação com
-- peso neutro até o dono configurar o valor real, em vez de zerar a
-- pontuação de quem for avaliado nela antes da configuração.

alter table habilidades_catalogo add column valor_base numeric(6,2) not null default 1;
