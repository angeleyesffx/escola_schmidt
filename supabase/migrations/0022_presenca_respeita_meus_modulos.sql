-- Escola Schmidt — chamada regular respeita "Meus módulos" (exceto dono)
-- Rodar em: Supabase > SQL Editor, depois de 0021_perfil_dono_nao_auto_gerencia.sql

-- Até aqui, presenca_escrita (0001) liberava qualquer professor pra marcar
-- presença/falta de QUALQUER turma, via eh_equipe() puro — sem checar se ele
-- de fato responde por aquele horário/módulo em professores_aula. O mesmo
-- valia pra aula_escrita nas aulas do tipo 'regular' (a linha que
-- getOuCriaAula cria na hora). Isso muda: professor passa a precisar de
-- vínculo em professores_aula pro aula_recorrente_id daquela turma; dono
-- continua com acesso total, sem exceção, via sou_responsavel_pela_aula
-- (0018) — mesma função já usada pra aula_teste, sem duplicar a regra.
--
-- Sem migration de backfill antes desta: aulas_recorrentes já teve uma
-- coluna professor_id (schema original, 0001), mas ela foi *removida* em
-- 0005_pedido_presenca_professor.sql quando professores_aula assumiu o
-- papel de fonte da verdade — não sobrou nenhum dado legado pra migrar. E,
-- como o banco de produção só recebeu o schema completo agora (nunca tinha
-- sido populado, ver docs/product/arquitetura-tecnica.md §1.1), não existe
-- nenhum professor com aula em andamento que essa mudança possa travar no
-- meio de um uso real. É a janela mais segura possível pra essa RLS entrar
-- em vigor — depois que a escola começar a operar de verdade, isso teria o
-- risco descrito em docs/product/plano-de-execucao.md §4 (backfill
-- obrigatório antes do corte). Consequência prática AGORA: todo professor
-- precisa passar por "Meus módulos" (chamada/modulos.tsx) e assumir seus
-- horários antes de conseguir abrir a primeira chamada.

drop policy aula_escrita on aulas;

create policy aula_escrita on aulas
  for all
  using (eh_equipe() and (tipo <> 'regular' or sou_responsavel_pela_aula(aula_recorrente_id)))
  with check (eh_equipe() and (tipo <> 'regular' or sou_responsavel_pela_aula(aula_recorrente_id)));

drop policy presenca_escrita on presencas;

create policy presenca_escrita on presencas
  for all
  using (
    eh_equipe() and exists (
      select 1 from aulas au
       where au.id = presencas.aula_id
         and (au.tipo <> 'regular' or sou_responsavel_pela_aula(au.aula_recorrente_id))
    )
  )
  with check (
    eh_equipe() and exists (
      select 1 from aulas au
       where au.id = presencas.aula_id
         and (au.tipo <> 'regular' or sou_responsavel_pela_aula(au.aula_recorrente_id))
    )
  );
