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

## 7. Refinamento de requisitos (2026-09-20): Aula Particular e Aula Teste

Retomada do modulo depois da implementacao das Fases 0-3 (ver `docs/product/arquitetura-tecnica.md`). O usuario trouxe requisitos mais especificos pra UC-03 (Aula Particular) e UC-05 (Aula Teste) do que o que estava documentado — auditoria do codigo atual (2026-09-20) confirmou que **nao sao so lacunas, sao divergencias reais** em relacao ao comportamento implementado.

### 7.1 Estado atual confirmado (antes desta mudanca)

**Aula particular:**
- `aula_leitura` (`0011_aula_particular.sql:26-30`) libera **qualquer** `eh_equipe()` a ver **todas** as particulares de **todos os professores** — nao ha escopo por professor responsavel.
- `aula_escrita` (pos `0022`) para `tipo = 'particular'` equivale a `eh_equipe()` puro — qualquer staff cria/edita/exclui qualquer particular, sem checagem de dono da reserva.
- `nova-particular.tsx:143-144` bloqueia explicitamente `meuPapel === 'aluno'` — autoatendimento nao existe, nem client nem RLS.
- Nao existe nenhum fluxo de edicao (so `criarAulaParticular` e exclusao) — editar e funcionalidade nova, nao ajuste de permissao.

**Aula teste:**
- `nova-teste.tsx` usa `Dropdown` alimentado por `getAlunos()` **ja matriculados e ativos** — o oposto do requisito (candidato ainda nao matriculado).
- `aulas_teste_alunos.aluno_id` (`0018_professor_modulos_e_aula_teste.sql:39-43`) e FK **not null** pra `alunos(id)` — hoje e impossivel cadastrar um candidato sem registro previo em `alunos`.
- `chamada/[id].tsx` nao tem nenhuma referencia a `aulas_teste` — candidatos nunca aparecem na chamada hoje.

### 7.2 Decisoes registradas (2026-09-20)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Escopo de edicao de aula particular | **So data/hora.** Aluno e professor da reserva permanecem os mesmos — trocar isso exige cancelar e criar de novo |
| 2 | Reserva self-service do aluno precisa de aprovacao? | **Nao — confirmada na hora**, mesma imediatidade que ja existe quando a equipe cria hoje |
| 3 | Presenca do candidato de aula teste | **So informativo.** Lista o nome na chamada com o rotulo "Aula Experimental", sem gravar presenca formal — candidato nao matriculado nao tem registro em `alunos`, entao nao ha onde guardar presenca sem redesenho maior (decisao evita esse redesenho) |
| 4 | Multiplos candidatos por aula teste | **Sim, continua permitindo varios** — so troca a fonte (texto livre em vez de dropdown de matriculados) |

### 7.3 Desenho tecnico — Aula Particular

**RLS de leitura (`aula_leitura`), nova versao para `tipo = 'particular'`:**

```sql
tipo <> 'particular'
or papel_atual() = 'dono'
or aulas.professor_id = auth.uid()
or exists (select 1 from alunos a where a.id = aulas.aluno_id and a.perfil_id = auth.uid())
```

Substitui o `eh_equipe()` atual, que hoje deixa qualquer professor ver a particular de qualquer colega.

**RLS de escrita (`aula_escrita`), nova versao para `tipo = 'particular'`:**

- **Insert:** continua liberado pra `eh_equipe()` (qualquer staff agenda pra qualquer aluno/professor, como hoje) **ou** para o proprio aluno reservando pra si (`exists (select 1 from alunos a where a.perfil_id = auth.uid() and a.id = new.aluno_id)`) — condicao de auto-servico segue o mesmo idioma ja usado em `contratos`/`pedidos_presenca`/etc. (checar o vinculo em `alunos`, nao o `papel`), coerente com o achado de `professor-como-aluno.md` de que esse e o padrao correto no restante do schema.
- **Update/Delete:** `papel_atual() = 'dono') or (eh_equipe() and professor_id = auth.uid()) or exists (select 1 from alunos a where a.perfil_id = auth.uid() and a.id = aluno_id)`.

**Edicao restrita a data/hora:** em vez de `update` direto via PostgREST (que exporia todas as colunas), seguir o padrao ja usado no projeto pra edicoes com escopo restrito (`atualizar_meus_dados_aluno`, `atualizar_meu_perfil`): nova RPC `remarcar_aula_particular(p_aula_id uuid, p_nova_data date, p_nova_hora time)` que valida a permissao (mesma condicao do `update` acima), reaproveita a validacao de conflito/disponibilidade ja usada na criacao (`horarios_livres_particular`) e so entao atualiza `data`/`hora`. Isso torna a restricao "so data/hora" uma garantia de codigo, nao so de UI.

**UI:**
- `nova-particular.tsx`: remover o bloqueio de `meuPapel === 'aluno'`; quando quem abre e aluno, pre-selecionar `aluno_id` como o proprio `meuAluno.id` (sem dropdown de aluno nesse caso) e manter a escolha de professor/data/hora como hoje.
- Nova tela ou secao de edicao (ex.: `chamada/editar-particular.tsx` ou modal a partir do detalhe da particular na Agenda): campos de data/hora apenas, chamando `remarcar_aula_particular`.
- Agenda (`chamada/index.tsx`): a lista de particulares do dia passa a refletir a visibilidade nova automaticamente (RLS ja filtra) — sem mudanca de logica de tela, so o dado que volta muda.

### 7.4 Desenho tecnico — Aula Teste

**Schema:** substituir `aulas_teste_alunos` (FK obrigatoria pra `alunos`) por uma tabela de candidatos com texto livre:

```sql
create table aulas_teste_candidatos (
  id            uuid primary key default gen_random_uuid(),
  aula_teste_id uuid not null references aulas_teste (id) on delete cascade,
  nome          text not null,
  telefone      text,
  criado_em     timestamptz not null default now()
);
```

Sem dado de producao em `aulas_teste_alunos` ainda (feature nao foi usada em uso real, banco recem-populado) — pode ser um `drop table` + criacao da nova, sem migracao de dados. RLS espelha a mesma regra ja existente de `aulas_teste` (`sou_responsavel_pela_aula`, staff-only) — nenhum papel de "candidato" acessa isso, ja que candidato nao tem login.

**UI (`nova-teste.tsx`):** trocar o `Dropdown` de alunos matriculados por uma lista de adicionar/remover candidatos (nome + telefone opcional), mesmo padrao de interacao ja usado em `disponibilidade.tsx` para a lista de horarios (adicionar item, remover item, nao busca em cadastro existente).

**Chamada (`chamada/[id].tsx`):** nova secao/consulta — ao abrir a chamada de um slot+data, buscar tambem `aulas_teste` (+ `aulas_teste_candidatos`) para o mesmo `aula_recorrente_id` e `data`, e listar cada candidato com um rotulo "Aula Experimental" junto da lista normal de alunos do modulo. Sem checkbox de presenca pra esses (decisao 3) — so o nome e o rotulo, informativo pro professor saber quem esperar.

### 7.5 Consequencia para o backlog

Dois itens novos, sem bloqueio de fase, junto aos ja registrados em `usuarios-e-convites.md` §7 e `professor-como-aluno.md` §5:

9. **Aula particular — escopo de visibilidade/edicao + autoatendimento do aluno:** RLS de `aula_leitura`/`aula_escrita` revisada (secao 7.3), RPC `remarcar_aula_particular`, ajuste em `nova-particular.tsx`, nova tela/modal de remarcacao.
10. **Aula teste — candidato nao matriculado:** nova tabela `aulas_teste_candidatos` substituindo `aulas_teste_alunos`, UI de lista livre em `nova-teste.tsx`, secao "Aula Experimental" nova em `chamada/[id].tsx`.
