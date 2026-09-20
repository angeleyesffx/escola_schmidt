-- Escola Schmidt — adiciona "responsavel" ao enum de papel
-- Rodar em: Supabase > SQL Editor, depois de 0028_categoria_figuras.sql

-- Retomada de 2026-09-20, pedido direto do usuário: quando uma conta é
-- vinculada a um registro de aluno pelo e-mail do responsável (vínculo
-- automático, 0020) ou por convite direto (convidar-aluno), quem loga ali
-- normalmente não é o próprio atleta — é o responsável por ele. Só o valor
-- de enum aqui, sem uso ainda (0030 conecta o comportamento) — Postgres não
-- deixa usar um valor de enum recém-criado na mesma transação em que foi
-- adicionado, por isso fica numa migration própria.

alter type papel add value 'responsavel';
