# Minha Evolucao

## Objetivo

Substituir a visao atual de desempenho por uma feature orientada a evolucao esportiva do aluno.

A area do aluno deve responder de forma visual e historica:

- o que ja domino
- o que estou aprendendo
- onde tenho dificuldade
- o que preciso conquistar para avancar

O nome funcional da nova area sera `Minha Evolucao`.

## Problema atual

O modelo atual em [supabase/migrations/0002_desempenho.sql](../supabase/migrations/0002_desempenho.sql) e insuficiente para a proposta porque:

- usa um catalogo fixo e reduzido de habilidades
- nao separa modalidade, categoria tecnica, criterio e temporada
- nao suporta requisitos configuraveis por nivel
- nao modela pre-requisitos
- a avaliacao e simplificada por habilidade, sem criterios internos
- a restricao `unique (aluno_id, habilidade_id, data)` impede historico detalhado no mesmo dia

## Principios do dominio

- `skill` nao e avaliacao
- habilidade existe uma vez no catalogo
- avaliacao pertence a `aluno + habilidade + data + professor`
- progresso de nivel nao e media arbitraria; e calculo sobre requisitos configurados
- metodologia deve ser configuravel sem alterar codigo
- mudancas de uma temporada nao podem reescrever historico de temporadas anteriores

## Perfis e permissoes

### Professor

- pode avaliar aluno
- pode registrar observacoes
- pode marcar prioridade de treinamento
- pode acompanhar historico e progresso

### Aluno

- visualiza apenas a propria evolucao
- nao pode editar avaliacoes

### Responsavel

- visualiza os dados autorizados do aluno vinculado
- deve suportar multiplos alunos por conta

### Administrador

- administra catalogo, niveis, requisitos, modalidades e permissoes

## Backlog

### Epico 1 - Catalogo pedagogico

Objetivo: permitir que a escola configure metodologia, taxonomia e regras sem deploy.

Features:

- cadastro de modalidades
- cadastro de categorias tecnicas
- cadastro de habilidades
- cadastro de criterios por habilidade
- configuracao de pre-requisitos
- configuracao de niveis e requisitos
- versionamento por temporada

User stories:

- como administrador, quero cadastrar uma habilidade para usa-la em uma ou mais trilhas tecnicas
- como administrador, quero configurar criterios por habilidade para orientar avaliacoes detalhadas
- como administrador, quero vincular uma habilidade a niveis diferentes com pesos e obrigatoriedade
- como administrador, quero versionar a metodologia por temporada para preservar historico

Critrios de aceite:

- habilidade pode estar ativa ou inativa
- habilidade pode aparecer em multiplos niveis
- requisito aceita peso, status minimo e nota minima opcional
- metodologia de uma temporada nao altera calculos historicos de outra

### Epico 2 - Avaliacao tecnica

Objetivo: dar ao professor um fluxo rapido de registro pedagogico.

Features:

- avaliacao por habilidade
- avaliacao por criterio
- status da habilidade
- flag de atencao/prioridade
- observacoes do professor
- historico completo

User stories:

- como professor, quero registrar uma avaliacao por habilidade em menos de 30 segundos
- como professor, quero avaliar criterios internos para indicar o ponto exato de melhoria
- como professor, quero marcar uma habilidade como prioridade do mes

Critrios de aceite:

- avaliacao simples deve ser salva em menos de 30 segundos
- cada habilidade pode ter criterios proprios
- nenhuma avaliacao antiga pode ser sobrescrita silenciosamente
- toda avaliacao registra professor e data

### Epico 3 - Minha Evolucao

Objetivo: transformar o perfil do aluno em painel de progresso esportivo.

Features:

- cabecalho do aluno com turma, professora, nivel e frequencia
- progresso para proximo nivel
- resumo de habilidades dominadas vs pendentes
- foco atual
- detalhamento por categoria e habilidade

User stories:

- como aluno, quero ver meu percentual real para o proximo nivel
- como aluno, quero saber quais habilidades faltam para avancar
- como responsavel, quero compreender de forma simples os gargalos do aluno

Critrios de aceite:

- percentual usa requisitos configurados e pesos
- tela exibe faltantes por categoria
- tela destaca foco atual
- aluno nunca pode editar a avaliacao

### Epico 4 - Radar e analise

Objetivo: destacar gargalos e pontos fortes de forma imediata.

Features:

- radar chart com 5 a 7 eixos
- foco atual baseado no menor desempenho elegivel
- comparativo por macroarea

User stories:

- como aluno, quero enxergar rapidamente qual macroarea e meu maior gargalo

Critrios de aceite:

- eixos devem ser configuraveis
- calculo deve agregar habilidades por categoria
- foco atual deve ser derivado de regra clara e reproduzivel

### Epico 5 - Historico e jornada

Objetivo: preservar a narrativa de evolucao do aluno.

Features:

- historico por habilidade
- linha do tempo
- conquistas
- passagem de nivel confirmada pela escola

User stories:

- como aluno, quero acompanhar minha evolucao por habilidade ao longo do tempo
- como professor, quero validar se o aluno esta pronto para teste de nivel

Critrios de aceite:

- avaliacoes antigas permanecem acessiveis
- sistema pode indicar prontidao, mas nao promover automaticamente
- conquista de nivel fica registrada com data

## Modelo conceitual

Entidades principais:

- `users`
- `students`
- `guardians`
- `teachers`
- `guardian_students`
- `classes`
- `enrollments`
- `modalities`
- `skill_categories`
- `skills`
- `skill_criteria`
- `levels`
- `methodology_versions`
- `level_requirements`
- `skill_prerequisites`
- `student_assessments`
- `assessment_criteria`
- `student_skill_status`
- `level_histories`
- `achievements`
- `attendances`
- `events`
- `event_participations`
- `competition_results`

## Proposta de dados

### modalities

- `id`
- `nome`
- `slug`
- `ativo`

### skill_categories

- `id`
- `modalidade_id`
- `nome`
- `slug`
- `ordem`
- `ativo`

### skills

- `id`
- `categoria_id`
- `nome`
- `nome_internacional`
- `descricao`
- `origem`
- `temporada_regra`
- `ativo`

### skill_criteria

- `id`
- `skill_id`
- `nome`
- `ordem`
- `peso`
- `ativo`

### methodology_versions

- `id`
- `nome`
- `temporada`
- `vigencia_inicio`
- `vigencia_fim`
- `ativa`

### levels

- `id`
- `nome`
- `ordem`
- `metodologia_id`
- `ativo`

### level_requirements

- `id`
- `level_id`
- `skill_id`
- `obrigatorio`
- `peso`
- `nota_minima`
- `status_minimo`

### skill_prerequisites

- `id`
- `skill_id`
- `prerequisite_skill_id`

### student_assessments

- `id`
- `student_id`
- `skill_id`
- `teacher_id`
- `data_avaliacao`
- `status`
- `nota_geral`
- `needs_attention`
- `observacoes`
- `metodologia_id`
- `criado_em`

### assessment_criteria

- `id`
- `assessment_id`
- `criterion_id`
- `nota`
- `observacoes`

### student_skill_status

- `id`
- `student_id`
- `skill_id`
- `status_atual`
- `ultima_avaliacao_id`
- `percentual_estimado`
- `prioridade`
- `atualizado_em`

## Status sugeridos

Status lineares:

- `not_started`
- `learning`
- `developing`
- `mastered`
- `consolidated`

Flag paralela:

- `needs_attention`

## Regras de calculo

### Progresso para o nivel

`progresso = soma_dos_pesos_atingidos / soma_dos_pesos_totais`

Um requisito conta como atingido quando:

- status atual da habilidade e maior ou igual ao `status_minimo`
- e, se configurada, a `nota_minima` foi atingida

### Radar por macroarea

- cada eixo agrega habilidades da categoria correspondente
- agregacao deve usar pesos dos requisitos elegiveis para o nivel/metodologia
- foco atual e a menor macroarea entre as elegiveis ou a com maior concentracao de itens em `developing` e `needs_attention`

## Estrategia de migracao

### Fase 1

- manter a tela atual funcionando
- nao reaproveitar diretamente a estrutura fixa de `habilidades` como modelo final
- criar novas tabelas lado a lado com a estrutura atual

### Fase 2

- popular modalidades, categorias, skills e criterios iniciais
- mapear as habilidades antigas para categorias novas onde houver equivalencia

### Fase 3

- criar APIs novas em `src/features/evolucao/`
- montar tela `Minha Evolucao` para aluno/responsavel
- manter a tela atual de desempenho como fallback temporario para equipe

### Fase 4

- migrar o fluxo do professor para a nova avaliacao
- congelar a estrutura antiga

### Fase 5

- remover dependencias da modelagem simplificada quando nao houver mais uso

## Estrutura tecnica sugerida

No app:

- `app/(app)/alunos/[id]/evolucao.tsx`
- `app/(app)/minha-evolucao.tsx`
- `src/features/evolucao/api.ts`
- `src/features/evolucao/selectors.ts`
- `src/features/evolucao/types.ts`
- `src/features/evolucao/__tests__/`

No Supabase:

- nova migracao para metodologia e catalogo
- nova migracao para avaliacoes detalhadas
- politicas RLS para aluno, responsavel, professor e dono

## MVP recomendado

### MVP

- catalogo configuravel de habilidades
- categorias tecnicas
- requisitos por nivel
- avaliacao do professor por habilidade e criterio
- status atual por habilidade
- painel do aluno com progresso, faltantes e foco atual

### P1

- radar chart
- historico por habilidade
- conquistas e prontidao para teste de nivel
- vinculo de responsavel com multiplos alunos

### P2

- arvore de pre-requisitos
- competicoes e resultados
- timeline esportiva completa
- videos de referencia

## Decisao recomendada

Nao expandir a feature atual de `desempenho` por remendos.

O melhor caminho e:

1. fechar modelagem nova
2. criar migracoes novas lado a lado
3. implementar `Minha Evolucao` como nova feature
4. migrar gradualmente o uso da tela atual