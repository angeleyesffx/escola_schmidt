# Chamada, Agenda e Frequencia

Segundo documento da serie de produto. Depende do vocabulario de papeis definido em [papeis-e-permissoes.md](./papeis-e-permissoes.md). Este e o modulo de maior valor e complexidade do app: e onde a escola registra o que realmente aconteceu (presenca), organiza o que vai acontecer (grade, particulares, aulas teste) e onde o aluno interage ativamente (autocheckin).

## 1. Visao geral

O modulo cobre 4 sub-fluxos que compartilham as mesmas tabelas de base (`aulas_recorrentes`, `aulas`, `presencas`):

1. **Agenda** (`chamada/index.tsx`) — calendario semanal/mensal, ponto de entrada visual para tudo abaixo.
2. **Chamada** (`chamada/[id].tsx`, `chamada/lista.tsx`) — registrar presenca/falta de uma turma numa data.
3. **Particulares e aulas teste** (`chamada/agendar.tsx`, `nova-particular.tsx`, `nova-teste.tsx`, `disponibilidade.tsx`, `modulos.tsx`) — agendamento fora ou dentro da grade fixa.
4. **Eventos de calendario** — sobreposicao informativa (feriados, competicoes); tratado com mais profundidade em `docs/product/eventos.md` (proximo da fila), mas a tela de criacao (`novo-evento.tsx`) mora fisicamente nesta pasta e o achado sobre ela ja foi registrado e decidido em `papeis-e-permissoes.md` (secao 2.3): aluno/responsavel so visualiza, dono/professor cria — falta a guarda de papel na tela.

## 2. Papeis e matriz de permissao

| Acao | dono | professor | aluno |
|---|---|---|---|
| Ver agenda (grade, particulares, testes, eventos) | tudo | tudo | tudo (leitura) |
| Marcar presenca/falta de uma turma | qualquer turma | so turma(s) assumida(s) em "Meus modulos" ⚠️ **ainda nao implementado** — hoje e qualquer turma, ver decisao registrada na secao 4.3 | nao |
| Aprovar/recusar pedido de autocheckin | qualquer pedido | so pedidos da turma que assumiu em "Meus modulos" (`sou_professor_do_pedido`) | nao |
| Pedir a propria presenca (autocheckin) | n/a | n/a | sim, so no dia real e modulo da propria aula |
| Exportar lista de chamada (xlsx/csv) | sim | sim | nao |
| Agendar aula particular | qualquer professor | sim | nao |
| Cancelar aula particular/teste agendada | sim | sim | nao |
| Declarar disponibilidade para particular | qualquer professor (dropdown) | so a propria | nao |
| Agendar aula teste | qualquer slot | so slots assumidos em "Meus modulos" | nao |
| Assumir responsabilidade por slot/modulo ("Meus modulos") | em nome de qualquer professor | so para si mesmo | nao |

**Achado — RESOLVIDO (decisao registrada em 2026-09-19):** hoje marcar presenca/falta em uma chamada e liberado para **qualquer** professor em **qualquer** turma (a RLS usa `eh_equipe()`, sem checar `professores_aula`). Decisao: isso esta errado — a chamada regular **deve respeitar "Meus modulos"**, igual a aprovacao de pedidos e a aula teste. A **unica excecao e o `dono`**, que continua podendo fazer chamada de qualquer turma independente de modulo assumido. **Acao recomendada:** ajustar a RLS de escrita em `presencas` (e leitura/escrita da `aulas` correspondente) para `professor` exigir `exists (select 1 from professores_aula pa where pa.professor_id = auth.uid() and pa.aula_recorrente_id = aulas.aula_recorrente_id)`, mantendo `papel_atual() = 'dono'` como bypass total. Refletir na UI: a lista de turmas do dia so mostra ao professor as turmas que ele assumiu (dono continua vendo todas).

## 3. Casos de uso

Nomenclatura: **Pre-condicoes**, **Fluxo principal**, **Fluxos alternativos/excecao**, **Pos-condicoes**. Escopo restrito ao que existe implementado — nenhum passo abaixo e requisito novo.

### UC-01 — Staff registra presenca de uma turma

- **Pre-condicoes:** usuario autenticado com papel `dono` ou `professor`; existe um slot de `aulas_recorrentes` com alunos ativos no(s) modulo(s) daquele horario.
- **Fluxo principal:**
  1. Staff abre Agenda, seleciona o dia (ou usa "Lista de chamada" para o atalho do dia atual).
  2. Abre a chamada da turma. Se ainda nao existe uma linha em `aulas` para esse slot+data, o sistema cria uma na hora (`getOuCriaAula`).
  3. Tela lista os alunos ativos do modulo. Staff toca no chip de status (Presente / Falta justificada / Falta) por aluno.
  4. Sistema grava em `presencas`, guardando quem registrou e quando (`registrado_por`, `registrado_em`).
- **Fluxos alternativos:**
  - **FA-1 (conflito de edicao concorrente):** se outro staff ja alterou o status desse aluno depois da ultima leitura da tela (comparando `registrado_em` antes de sobrescrever), o sistema lanca `ConflitoPresencaError` e mostra um aviso pedindo para recarregar a tela, em vez de sobrescrever silenciosamente.
  - **FA-2 (pedido de autocheckin pendente):** se o aluno ja fez um pedido de presenca para essa aula, ele aparece destacado na lista para o staff aprovar/recusar, e a aprovacao grava a presenca.
  - **FE-1 (corrida na criacao da aula) — defeito confirmado, ver secao 4.1:** se dois staff abrirem a chamada da mesma turma nova (sem linha em `aulas` ainda) ao mesmo tempo, um dos dois recebe um erro nao tratado em vez de simplesmente reaproveitar a aula que o outro acabou de criar.
- **Pos-condicoes:** `presencas` refletem o estado marcado; staff pode exportar a lista (xlsx/csv) a qualquer momento depois.

### UC-02 — Aluno pede a propria presenca (autocheckin)

- **Pre-condicoes:** aluno autenticado, vinculado a um registro em `alunos`; hoje e o dia real da aula do seu modulo (dia da semana bate com o slot).
- **Fluxo principal:**
  1. Aluno abre a chamada da propria aula.
  2. Sistema verifica (`getMeuPedido`) se ja existe um pedido dele para essa aula; se nao existir, mostra o botao "Pedir presenca".
  3. Aluno toca; sistema cria uma linha em `pedidos_presenca` com status `pendente`.
  4. Aluno ve o proprio pedido como pendente ate que o staff aprove ou recuse (UC-01/FA-2).
- **Fluxos alternativos:**
  - **FA-1:** se o aluno tentar pedir presenca fora do dia/modulo da propria aula, a RLS nega a insercao (a tela nem oferece a acao fora dessas condicoes).
  - **FA-2:** um segundo pedido para a mesma aula e bloqueado pela constraint `unique(aula_id, aluno_id)` — a tela ja evita isso checando o pedido existente antes de oferecer o botao de novo.
- **Pos-condicoes:** `pedidos_presenca` com status `pendente`, `aprovado` ou `recusado` conforme decisao do staff.

### UC-03 — Agendar aula particular

- **Pre-condicoes:** staff autenticado.
- **Fluxo principal:**
  1. Agenda -> "Agendar aula" -> "Aula particular".
  2. Escolhe o aluno, escolhe o professor (pre-selecionado automaticamente se so ha uma opcao, ou se o proprio usuario logado e professor).
  3. Escolhe a data; sistema mostra so os horarios que o professor declarou como `disponibilidade_particular` **e** que ainda estao livres (RPC `horarios_livres_particular`, que cruza contra a grade fixa e outras aulas particulares ja marcadas).
  4. Confirma; nova linha em `aulas` (`tipo = 'particular'`, `aluno_id` preenchido).
- **Fluxos alternativos:**
  - **FA-1 (corrida de agendamento):** se dois staff tentarem reservar o mesmo horario ao mesmo tempo, o segundo recebe a violacao de unique constraint do banco (`23505`), e a tela ja trata isso com uma mensagem amigavel de horario ja ocupado — nao precisa de ajuste.
- **Pos-condicoes:** aula particular visivel na Agenda para staff e para o aluno vinculado.

### UC-04 — Declarar disponibilidade para aulas particulares

- **Pre-condicoes:** professor autenticado, ou dono agindo em nome de um professor (via seletor).
- **Fluxo principal:**
  1. Abre "Horarios livres".
  2. Escolhe data de inicio, tipo de recorrencia (unica, diaria, semanal, mensal, anual) e, se recorrente, data fim.
  3. Lista um ou mais horarios (HH:MM).
  4. Salva em `disponibilidade_particular`.
- **Fluxos alternativos:** dono pode editar a disponibilidade de qualquer professor pelo mesmo formulario, trocando o professor no seletor.
- **Pos-condicoes:** os horarios declarados passam a aparecer como opcao em UC-03, filtrados pela disponibilidade real (menos os ja ocupados).

### UC-05 — Agendar aula teste

- **Pre-condicoes:** staff autenticado; se for `professor`, precisa ter reivindicado o slot/modulo em "Meus modulos" (UC-06).
- **Fluxo principal:**
  1. Agenda -> "Agendar aula" -> "Aula teste".
  2. Escolhe um slot da grade fixa (`aulas_recorrentes`) — professor so ve os que assumiu, dono ve todos.
  3. Escolhe a data; sistema valida que o dia da semana da data bate com o dia do slot.
  4. Escolhe um ou mais alunos.
  5. Salva em `aulas_teste` + `aulas_teste_alunos`.
- **Pos-condicoes:** aula teste visivel na Agenda; **nao ha fluxo de conversao** de aula teste para matricula/contrato dentro do app hoje — isso e feito manualmente pelo staff cadastrando o aluno do zero se ele decidir se matricular (ver secao 5, pergunta 3).

### UC-06 — Assumir responsabilidade por um modulo/slot ("Meus modulos")

- **Pre-condicoes:** professor autenticado (ou dono agindo em nome de um professor).
- **Fluxo principal:**
  1. Abre "Meus modulos" / "Modulos por professor".
  2. Ve a lista de slots da grade; marca quais modulos assume em cada um.
  3. Grava em `professores_aula`.
- **Pos-condicoes:** esse vinculo passa a controlar quem pode aprovar pedidos de autocheckin (UC-01/FA-2) daquele modulo e quem pode oferecer aula teste nele (UC-05) — e, apos a decisao registrada na secao 2, **tambem devera controlar** quem pode fazer a chamada regular da turma (ainda nao implementado).

## 4. Problemas confirmados no codigo

Diferente do documento anterior, aqui abri o codigo-fonte para confirmar cada item antes de listar — nenhum e especulacao.

### 4.1 Corrida na criacao preguicosa da aula (defeito real, baixo impacto)

`getOuCriaAula` (`src/features/chamada/api.ts:104-126`) faz um `select` e, se nao encontrar nada, um `insert`. A tabela `aulas` tem um indice unico (`aula_unica_por_data`, em `supabase/migrations/0001_schema.sql:132-134`) que impede duas linhas para o mesmo `aula_recorrente_id` + `data` — entao o banco esta protegido, nao ha dado duplicado. Mas se dois staff abrirem a chamada da **mesma turma nova** (primeira vez naquele dia) ao mesmo tempo, o segundo `insert` falha com violacao de unicidade e o codigo simplesmente faz `throw erroInsert` (linha 124) sem tratar esse caso — diferente de `criarAulaParticular`, que ja trata a mesma classe de erro (`23505`) com uma mensagem amigavel. Na pratica: o segundo staff ve um erro tecnico em vez de a tela simplesmente abrir a chamada que o primeiro acabou de criar.

**Impacto:** baixo (janela de corrida muito curta, exige dois toques quase simultaneos na mesma turma nunca aberta) mas facil de corrigir: capturar `23505` em `getOuCriaAula` e refazer o `select`.

### 4.2 Sem cobertura de teste automatizado neste modulo alem da tela de detalhe da chamada

Existe `__tests__` para telas de `chamada` (mencionado no README como parte da base ~20-22% de cobertura), mas os fluxos de agendamento (particular, teste, disponibilidade, meus modulos) nao tem teste dedicado identificado. Nao e um bug, mas e relevante para priorizacao de QA — esses fluxos tem mais logica de negocio (calculo de horarios livres, validacao de dia da semana) que os generos de UI simples.

## 5. Decisoes registradas (2026-09-19)

| # | Pergunta | Decisao | Status |
|---|---|---|---|
| 1 | Chamada por qualquer professor vs. "Meus modulos" | A chamada regular **deve respeitar "Meus modulos"**. Excecao unica: `dono` continua fazendo chamada de qualquer turma independente de modulo assumido | Pronto para implementar (ver acao recomendada na secao 2) |
| 2 | Correcao do defeito 4.1 (corrida em `getOuCriaAula`) | Confirmado como correcao pequena de bug | Pronto para implementar |
| 3 | Aula teste sem fluxo de conversao para matricula | Confirmado como aceitavel — nao e uma lacuna a resolver agora | Fechado, sem acao |

## 6. Backlog de implementacao gerado por este documento

Somado ao backlog ja aberto em `papeis-e-permissoes.md` (que ja tem 2 itens), ficam mais 2 itens com decisao de produto fechada, prontos para quando voce autorizar uma sessao de codigo:

3. RLS de `presencas` (e da `aulas` correspondente) para `professor`: exigir vinculo em `professores_aula` com o `aula_recorrente_id` da chamada, com `dono` como bypass total. UI: lista de turmas do dia so mostra ao professor as que ele assumiu.
4. Tratar violacao de unicidade (`23505`) em `getOuCriaAula` (`src/features/chamada/api.ts:104-126`) refazendo o `select` em vez de propagar o erro cru — mesmo padrao ja usado em `criarAulaParticular`.

Proximo documento, seguindo a ordem combinada: `docs/product/evolucao-vs-desempenho.md`.
