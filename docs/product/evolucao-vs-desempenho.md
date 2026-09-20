# Minha Evolucao vs Desempenho

Terceiro documento da serie. Depende de [papeis-e-permissoes.md](./papeis-e-permissoes.md) e [chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md). Existe um documento de visao previo para esta area, [docs/minha-evolucao.md](../minha-evolucao.md), escrito antes da implementacao — uso ele como referencia do que foi planejado, e confronto com o que existe de fato no codigo hoje.

## 1. Visao geral

Existem **dois sistemas de avaliacao pedagogica ao vivo, simultaneamente, para o mesmo aluno**:

1. **Desempenho** (legado) — `src/features/desempenho/api.ts`, tabelas `habilidades` e `avaliacoes_desempenho` (`supabase/migrations/0002_desempenho.sql`). Catalogo fixo de 8 habilidades, avaliadas numa escala de 3 niveis (precisa melhorar / conforme esperado / excelente) por data. Mais uma tabela separada, `testes_nivel`, para eventos de "passagem de nivel" (teste aprovado/reprovado, com trigger que atualiza `alunos.modulo`).
2. **Minha Evolucao** — `src/features/evolucao/`, o sistema novo descrito em `docs/minha-evolucao.md`. Catalogo configuravel (modalidade > categoria > habilidade > criterio), metodologias versionadas por temporada, niveis com requisitos ponderados, avaliacao rapida (status) e detalhada (criterios com nota 0-100), painel do aluno com progresso/foco/radar/historico.

`docs/minha-evolucao.md` e explicito: o objetivo e **substituir** o Desempenho, nao coexistir com ele ("Decisao recomendada... nao expandir a feature atual de desempenho por remendos"; "Fase 3... manter a tela atual de desempenho como fallback temporario para equipe"). O que existe hoje corresponde a essa "Fase 3" de transicao — mas sem nenhum passo executado das Fases 4 e 5 (migrar o fluxo do professor e congelar/remover a estrutura antiga).

## 2. Papeis e permissoes

Identico nos dois sistemas — nao ha diferenca de modelo de permissao entre Desempenho e Evolucao:

| Acao | dono | professor | aluno |
|---|---|---|---|
| Registrar avaliacao (Desempenho ou Evolucao) | sim | sim (`eh_equipe()`) | nao |
| Ver a propria avaliacao/evolucao | sim (qualquer aluno) | sim (qualquer aluno) | so a propria |
| Configurar catalogo (habilidades, niveis, metodologias, requisitos) | **nao existe UI para ninguem** — so via banco | nao | nao |
| Vincular um aluno a uma metodologia/nivel (pre-requisito para Evolucao funcionar) | **nao existe UI para ninguem** — so via banco | nao | nao |
| Ler auditoria de avaliacoes de evolucao (`auditoria_avaliacoes_evolucao`) | sim, exclusivo | nao | nao |

Sem divergencia RLS/UI aqui — a lacuna e de produto (funcionalidade sem tela), nao de seguranca.

## 3. Casos de uso

### UC-01 — Staff avalia aluno no Desempenho (legado)

- **Pre-condicoes:** staff autenticado; aluno cadastrado e ativo.
- **Fluxo principal:** abre `alunos/[id]`, na secao "Avaliar habilidades" (inline na mesma tela de detalhe do aluno) toca no nivel (!, ✓, ★) por habilidade do catalogo fixo de 8; grava em `avaliacoes_desempenho` para a data corrente.
- **Fluxos alternativos:** re-avaliar a mesma habilidade no mesmo dia sobrescreve o registro local ate confirmar — a constraint `unique(aluno_id, habilidade_id, data)` (0002) impede duas avaliacoes formais da mesma habilidade no mesmo dia.
- **Pos-condicoes:** timeline de avaliacoes do aluno atualizada, visivel na mesma tela.

### UC-02 — Staff registra teste de nivel (legado, ainda em uso)

- **Pre-condicoes:** staff autenticado.
- **Fluxo principal:** na mesma tela de detalhe do aluno, registra um teste de nivel (aprovado/reprovado). Se aprovado, um trigger (`aplica_teste_nivel`) atualiza `alunos.modulo` automaticamente.
- **Observacao:** este mecanismo **e o unico caminho hoje** para avancar o modulo de um aluno automaticamente — o novo sistema de Evolucao tem "aprovado para teste" e "nivel conquistado" como eventos de historico (`historico_nivel_evolucao`), mas nao ha integracao entre os dois: aprovar um nivel em Evolucao nao move `alunos.modulo`, e vice-versa.

### UC-03 — Staff faz avaliacao rapida em Minha Evolucao

- **Pre-condicoes:** staff autenticado; **o aluno precisa ja ter uma linha em `aluno_metodologias`** apontando metodologia/nivel atual — sem isso a tela mostra um estado vazio ("configure a metodologia") e nao ha nada para avaliar.
- **Fluxo principal:** abre `alunos/[id]/evolucao`, ve os requisitos do nivel atual do aluno, escolhe um status (nao iniciado / aprendendo / em desenvolvimento / dominado / consolidado) por habilidade exigida, opcionalmente marca "atencao prioritaria" e escreve observacao; RPC `registrar_avaliacao_evolucao` grava.
- **Fluxos alternativos:** staff pode expandir para "avaliacao detalhada", preenchendo nota 0-100 por criterio da habilidade; o sistema calcula a media ponderada.
- **Pos-condicoes:** `status_habilidade_aluno` atualizado (via trigger), progresso do nivel recalculado, evento pode ser adicionado a `historico_nivel_evolucao`.

### UC-04 — Aluno acompanha a propria evolucao

- **Pre-condicoes:** aluno autenticado e vinculado a um registro `alunos` com `aluno_metodologias` configurado.
- **Fluxo principal:** abre "Minha evolucao" (mesma tela `EvolucaoScreen` usada por staff, em modo leitura): ve nivel atual, percentual de frequencia (`calcularFrequenciaPorPlano`, calculo real sobre plano x aulas semanais x faltas, nao contagem ingenua), barra de progresso para o proximo nivel, "seu foco atual", uma lista de barras de percentual por categoria (nao um radar/spider chart — ver achado 4.3) e o que falta conquistar.
- **Fluxo alternativo — aluno sem metodologia atribuida:** mensagem amigavel "sua jornada esta prestes a comecar" em vez de erro — mas o aluno fica bloqueado ali indefinidamente ate um staff (via banco, nao via app) configurar `aluno_metodologias` para ele.

## 4. Problemas confirmados no codigo

### 4.1 Duplicidade real de avaliacao pedagogica (o achado mais critico do produto ate agora)

Confirmado lendo `app/(app)/alunos/[id]/index.tsx`: a secao "Avaliar habilidades" do Desempenho legado esta **inline, editavel, na mesma tela** que tem o atalho "Minha Evolucao" (linha 259, `router.push('/alunos/${id}/evolucao')`) para o sistema novo. Um staff pode preencher os dois para o mesmo aluno na mesma visita, sem nenhum aviso de que um deveria substituir o outro. Existe ainda uma **terceira** superficie: `app/(app)/alunos/[id]/desempenho.tsx`, que duplica a mesma logica do Desempenho legado (mesmas constantes `NIVEIS`, mesmo formulario) mas **nao e referenciada por nenhum link ou botao** no app — tela orfa.

### 4.2 Nao existe caminho, em nenhuma tela, para atribuir um aluno novo a uma metodologia/nivel de Evolucao

Confirmado: `src/features/evolucao/api.ts` so tem funcoes de **leitura** de `aluno_metodologias` (`getMetodologiaAtualAluno`); busca em todo `app/` e `src/` nao encontra nenhuma escrita nessa tabela fora de migration. A migracao `0009_minha_evolucao_seed.sql` fez um backfill **unico**, na epoca, para os alunos ja ativos naquele momento — nao existe trigger em `alunos` que replique isso para matriculas novas. **Na pratica, todo aluno cadastrado depois dessa migracao fica permanentemente preso no estado vazio de UC-04/alternativo ate alguem rodar SQL manualmente.** Isso e mais grave do que "falta UI de catalogo" (achado ja levantado no documento de visao) — falta o passo minimo de **matricular o aluno no sistema novo**, algo que a escola vai precisar fazer para 100% dos alunos novos, nao so ocasionalmente para ajustar o catalogo.

### 4.3 Radar pedagogico nao e um radar chart

O Epico 4 do documento de visao pede um "radar chart com 5 a 7 eixos". O que existe hoje em `EvolucaoScreen` e uma lista de barras de progresso horizontais por categoria — funcionalmente cobre o mesmo dado (percentual por categoria), mas nao a visualizacao pedida. Gap de forma, nao de dado.

### 4.4 Nenhuma integracao entre "teste de nivel" (Desempenho) e "nivel conquistado" (Evolucao)

Os dois sistemas tem conceitos de "avanco de nivel" que nao se comunicam: o legado move `alunos.modulo` via trigger; o novo so registra um evento de historico sem side-effect. Se a escola continuar usando o teste de nivel legado como o mecanismo real de promocao (o que parece ser o caso, ja que e o unico com efeito automatico), a secao de "nivel conquistado" da Evolucao vira so um registro narrativo, potencialmente incoerente com o `modulo` real do aluno.

## 5. Decisoes registradas (2026-09-19)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Direcao estrategica | **Descontinuar o Desempenho legado**, seguindo a Fase 4/5 de `docs/minha-evolucao.md` |
| 2 | Tela orfa `alunos/[id]/desempenho.tsx` | **Nao apagar — repropositar.** A tela "Desempenho" do aluno deve passar a mostrar a evolucao do aluno **ao longo da jornada** (historico/timeline), nao a grade de habilidades do sistema legado |
| 3 | Atribuicao de metodologia para alunos novos (achado 4.2) | Confirmado como prioridade, antes de qualquer refinamento visual |
| 4 | Radar chart (achado 4.3) | Confirmado, vale o esforco |
| 5 | Fonte da verdade para avanco de nivel (achado 4.4) | **"Nivel conquistado" (evento de Evolucao) e a timeline (`historico_nivel_evolucao`)** passam a ser a fonte da verdade — o `testes_nivel`/`aplica_teste_nivel` legado do Desempenho sai de uso junto com a descontinuacao decidida no item 1 |

Essas 5 decisoes sao interdependentes e formam, juntas, um plano de migracao coerente:

### 5.1 O que "descontinuar o Desempenho" implica concretamente

- Parar de oferecer a secao "Avaliar habilidades" (Desempenho legado) inline em `alunos/[id]/index.tsx` — staff passa a usar so a Evolucao dali para frente.
- `alunos/[id]/desempenho.tsx` deixa de ser a tela orfa duplicada e vira a nova tela de **"Jornada"**: uma timeline construida a partir de `historico_nivel_evolucao` (eventos: inicio da jornada, pronto para avaliacao, aprovado, reprovado, nivel conquistado) cruzada com o historico de avaliacoes por habilidade (`avaliacoes_evolucao`) — essencialmente implementando o Epico 5 ("Historico e Jornada") do documento de visao, que hoje so existe parcialmente (a secao "Historico" atual em `EvolucaoScreen` mostra so os ultimos 5 eventos; a nova tela de Jornada seria a versao completa/dedicada).
- O trigger `aplica_teste_nivel` (que hoje atualiza `alunos.modulo` quando um teste de nivel legado e aprovado) precisa de um equivalente novo: registrar um evento de "nivel conquistado" em `historico_nivel_evolucao` passa a atualizar `alunos.modulo` (e a atribuicao atual em `aluno_metodologias`) automaticamente, do mesmo jeito que o legado fazia. Sem isso, o avanco de modulo do aluno para de funcionar no momento em que o Desempenho for desligado.
- Dados historicos existentes em `avaliacoes_desempenho`/`testes_nivel` nao devem ser apagados (viram historico read-only), so o fluxo de escrita novo migra para Evolucao — coerente com a Fase 5 do documento de visao ("remover dependencias... quando nao houver mais uso", nao "apagar dados").

### 5.2 Ordem de execucao recomendada (para quando entrarmos na fase de implementacao)

Esta ordem existe porque os itens tem dependencia entre si — nao da para repropositar a tela de Jornada (2) nem trocar a fonte da verdade de modulo (5) sem antes garantir que todo aluno tem `aluno_metodologias` (3), e nao da para descontinuar o Desempenho (1) com seguranca sem o novo trigger de "nivel conquistado" (parte de 5) no lugar:

1. **Achado 4.2** — tela/fluxo minimo para atribuir metodologia+nivel a um aluno (novo ou existente sem atribuicao). Bloqueador de tudo o resto.
2. **Achado 4.4 + decisao 5** — nova funcao/trigger: evento "nivel conquistado" em `historico_nivel_evolucao` atualiza `alunos.modulo` e a atribuicao em `aluno_metodologias`. Só depois disso e seguro desligar o `aplica_teste_nivel` legado.
3. **Decisao 1** — remover a secao inline de Desempenho de `alunos/[id]/index.tsx` (staff passa a usar so Evolucao).
4. **Decisao 2** — repropositar `alunos/[id]/desempenho.tsx` como tela de Jornada/timeline.
5. **Decisao 4** — trocar a lista de barras por radar chart de verdade no `EvolucaoScreen`.

## 6. Observacao para o proximo documento

Nada deste modulo entra ainda no backlog "pronto para implementar" dos documentos anteriores, porque e um escopo maior (migracao de feature, nao correcao pontual) — fica registrado aqui como iniciativa propria, para priorizar quando voce decidir comecar a fase de implementacao.

Proximo documento, seguindo a ordem combinada: `docs/product/alunos-e-responsaveis.md`. Esse documento tambem vai retomar a pendencia ja registrada em `papeis-e-permissoes.md` sobre melhorar o modelo de "Responsavel", e a pergunta (ja respondida como aceitavel) sobre aula teste sem conversao automatica em matricula.
