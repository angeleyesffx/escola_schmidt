# Professor como Aluno (dupla identidade)

Oitavo documento da serie. Motivado por uma observacao de dominio levantada em 2026-09-20: professores da escola podem tambem ser atletas em treinamento em modulos mais avancados, sob outro professor — ou seja, a mesma pessoa precisa, ao mesmo tempo, **dar aula** (papel `professor`) e **receber feedback/avaliacao como aluno** (do proprio treinador). Depende de [papeis-e-permissoes.md](./papeis-e-permissoes.md), [evolucao-vs-desempenho.md](./evolucao-vs-desempenho.md) e [alunos-e-responsaveis.md](./alunos-e-responsaveis.md) (mecanismo de vinculo por e-mail, `0020`, ja em producao).

## 1. Achado principal: o banco ja suporta isso, o RLS tambem — quem impede sao 3 checagens no cliente

Antes de propor desenho novo, auditei se a modelagem atual ja permite um `perfis` com `papel = 'professor'` ter um registro `alunos` vinculado a si mesmo (`alunos.perfil_id = auth.uid()`) e acessar dados de evolucao/frequencia proprios. Resultado, confirmado lendo o codigo:

- **Nada no schema impede.** `alunos.perfil_id` e so uma FK `unique` para `perfis.id` — nao ha `check` de papel.
- **A RLS de leitura/escrita self-service ja e escrita como `eh_equipe() or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())`** em praticamente todas as tabelas relevantes (`contratos`, `testes_nivel`, `avaliacoes_desempenho`, `pedidos_presenca`, `avaliacoes_evolucao`, `status_habilidade_aluno`, etc. — confirmado em `0001`, `0002`, `0004`, `0005`, `0007`, `0008`, `0011`, `0012`). **Nenhuma dessas policies testa `papel_atual() = 'aluno'`** — a condicao e so "sou da equipe OU o registro de aluno aponta pra mim". Um professor com `alunos.perfil_id = auth.uid()` ja passaria nessas checagens hoje, sem nenhuma migration nova.
- **O mecanismo de vinculo por e-mail (`0020_auto_vincula_aluno_por_email.sql`) tambem nao filtra por papel** — `vincula_perfil_por_email_no_aluno()` busca direto em `auth.users` por e-mail, sem checar `perfis.papel`. Ou seja: um professor pode ser cadastrado como aluno (pelo fluxo normal de `alunos/novo.tsx`, que ja e staff-only, o proprio professor ou o dono cadastram) informando o proprio e-mail em `responsavel_email`, e o vinculo acontece sozinho — mecanismo ja em producao, sem mudanca.

**O que realmente bloqueia hoje e client-side, em 3 lugares especificos:**

| Arquivo | Linha | Checagem atual | Efeito |
|---|---|---|---|
| `src/features/auth/AuthProvider.tsx` | 139 | `if (meuPapel !== 'aluno' \|\| !session?.user.id) return` | `meuAluno` nunca e carregado para quem tem `papel = 'professor'`, mesmo que exista um `alunos` vinculado |
| `src/components/QuickMenu.tsx` | 79 | `if (souAluno)` (`meuPapel === 'aluno'`) | Itens "Minha evolucao"/"Frequencia" nunca aparecem no menu de um professor |
| `app/(app)/minha-evolucao.tsx` | 19 | `if (meuPapel !== 'aluno') return <Redirect ... />` | Mesmo que o professor navegasse direto pra URL, seria redirecionado pra fora |

Ha ainda um efeito colateral no dashboard (`app/(app)/index.tsx`), que usa a mesma variavel `souAluno` pra decidir se mostra o card "Minha evolucao" — mesma causa raiz.

## 2. Achado secundario: falta uma trava contra autoavaliacao

`registrar_avaliacao_evolucao` (`supabase/migrations/0010_registrar_avaliacao_evolucao_rpc.sql:46-48`) so verifica `if not eh_equipe() then raise exception` — **nao ha nenhuma checagem de que `p_aluno_id` seja diferente do proprio chamador**. Hoje isso e uma janela teorica sem uso real (nenhum professor tem `alunos` vinculado a si mesmo em producao ainda), mas assim que a dupla identidade for viabilizada pelos 3 pontos da secao 1, um professor **poderia registrar a propria avaliacao de evolucao** sem nenhum impedimento tecnico — precisa de decisao de produto (secao 3) antes de qualquer implementacao.

## 3. Decisoes registradas (2026-09-20)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Acesso simultaneo | **Sim.** Um professor com registro de aluno vinculado mantem tudo que ja ve como professor (Chamada, Alunos, Meus modulos) **e** ganha as telas de aluno (Minha Evolucao, Frequencia, pedir presenca) na mesma conta |
| 2 | Autoavaliacao (achado 2) | **Sim, bloquear.** Um professor nunca pode registrar avaliacao de evolucao para o proprio registro de aluno vinculado — precisa sempre de outro membro da equipe |
| 3 | Chamada da propria aula de treino | Confirmado: segue o UC-01 padrao sem tratamento especial, quem da a aula marca a presenca de todos, incluindo o professor-aluno |

## 4. Desenho decorrente

- **Cadastro:** nenhuma tela nova — o professor (ou o dono) cadastra o proprio registro de aluno via `alunos/novo.tsx` (ja staff-only), preenchendo `responsavel_email` com o proprio e-mail do professor. O gatilho de `0020` liga automaticamente.
- **`AuthProvider.tsx:139`:** trocar a condicao para carregar `meuAluno` sempre que existir um `alunos` vinculado a `auth.uid()`, independente de `meuPapel` (`if (!session?.user.id) return` seguido de uma busca por `alunos.perfil_id = auth.uid()` sem filtro de papel).
- **`QuickMenu.tsx:79`** e **`app/(app)/index.tsx`**: trocar a condicao de exibicao dos itens/cards de aluno de `souAluno` (`meuPapel === 'aluno'`) para `!!meuAluno` (existe registro vinculado), preservando os itens de equipe que ja aparecem por `souEquipe` — as duas listas passam a poder coexistir pra quem for professor-e-aluno.
- **`app/(app)/minha-evolucao.tsx:19`**: trocar `meuPapel !== 'aluno'` por `!meuAluno` como condicao de redirect.
- **Autoavaliacao (se a resposta a pergunta 2 for sim):** adicionar em `registrar_avaliacao_evolucao` um `raise exception` quando existe `alunos a where a.id = p_aluno_id and a.perfil_id = auth.uid()` — mesmo padrao ja usado nas outras funcoes desse arquivo. Aplicar a mesma trava, por consistencia, em qualquer outro caminho de escrita de avaliacao que sobreviver depois da migracao decidida em `evolucao-vs-desempenho.md` (o legado `avaliacoes_desempenho` esta sendo descontinuado, entao a trava so precisa existir no caminho novo).
- **Item menor, baixa prioridade:** `getPerfisNaoVinculados()` (`src/features/alunos/api.ts:78`) filtra `.eq('papel', 'aluno')` para a lista residual de "candidatos" (usada so quando o vinculo automatico por e-mail nao encontrou par) — atualizar para nao filtrar por papel, cobrindo o caso raro de um professor precisar de vinculo manual em vez de automatico por e-mail.

## 5. Consequencia para o `plano-de-execucao.md`

Este e um item pequeno-medio, tecnicamente mais simples do que pareceu a primeira vista (a RLS ja estava certa; e so o cliente que assume exclusividade de papel). Nao muda nenhuma fase ja fechada (0-3); entra como item novo, sem bloqueio de fase, junto ao aditivo de feriados — pode ser feito a qualquer momento, inclusive antes da Fase 4 (migracao Evolucao), ja que nao depende dela.
