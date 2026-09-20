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

## 7. Retomada (2026-09-20): tela de Alunos como ponto de entrada da avaliacao, e o conceito de "Figuras"

O usuario trouxe dois pontos novos sobre como a avaliacao (Fase 4 deste documento) deve funcionar na pratica, a partir da tela `alunos/index.tsx`:

### 7.1 Achado confirmado: a tela de Alunos nao explica seu proprio proposito

Conferido em `app/(app)/alunos/index.tsx`: a tela e um Kanban por modulo com busca/filtro, sem nenhum texto explicativo. Segundo o usuario, **e nessa tela que o professor deve selecionar o aluno que vai avaliar** — hoje isso nao fica claro pra quem usa (falta contexto/instrucao), e ao clicar num aluno (`router.push('/alunos/${item.id}')`) o destino ainda e a tela de detalhe com a secao inline de Desempenho legado + atalho pra Evolucao (o que a secao 5 deste documento ja decidiu descontinuar) — nao uma experiencia dedicada de "avaliar habilidades e figuras".

### 7.2 Decisao parcial: "Figuras" e uma categoria propria, distinta de "Habilidades"

Investiguei se "Figuras" ja existia no catalogo atual antes de perguntar: existe um item legado chamado **"Figuras de alongamento"** (`supabase/migrations/0002_desempenho.sql:26`, migrado em `0009` pra a categoria "Fundamentos" por um `case` sem tratamento especifico — um default automatico da migracao, nao uma decisao deliberada de categorizacao). Perguntei se era isso que o usuario queria dizer.

**Decisao registrada:** nao. "Figuras" e um **conceito mais amplo que o item legado**, e deve virar **sua propria categoria** no catalogo (`categorias_habilidade`), distinta de "Habilidades" — nao uma reclassificacao do item existente.

### 7.3 Documentacao oficial recebida (2026-09-20): sintese estrutural

O usuario forneceu 4 documentos oficiais: o Regulamento Tecnico Novato/Iniciante 2021 (FCPA/FGP/FPPA/FPP), o Regulamento Tecnico CSB 2026 (Confederacao Skate Brasil, Classe Internacional/Nacional/Aspirantes), o Regulamento do Torneio Estadual 2025 (FCPA/FGP/FHPERJ/FPP/FPPA) e a tabela de valores RollArt (World Skate, elementos de precisao/grupo). Sao regulamentos de **competicao**, nao de currículo escolar — trazem a taxonomia tecnica do esporte, mas tambem muito aparato que nao serve a um tracker interno de progresso (paineis de juizes, sistemas BASYS/RollArt/White, deducoes de nota, criterio de desempate, premiacao). Separei o que e reutilizavel do que fica de fora.

**Confirmacao da decisao 7.2:** os regulamentos confirmam, de forma independente, que "Figura de Alongamento" (ou so "Figura") **e mesmo uma categoria tecnica formal, distinta de Saltos/Giros/Passos** em toda a documentacao — aparece como elemento obrigatorio proprio em toda categoria de Novato/Iniciante/Basico ("Uma (01) figura de alongamento", com codigo `FigA`), com sua propria tabela de bonificacao por posicao (Camel Forward/Sideways/Layover/Inverted, Upright Forward/Layback/Split/Biellmann/Torso Sideways, posicoes especiais Spread Eagle/Charlotte/Sonja/Fan Spiral). Isso bate exatamente com a decisao ja registrada — nao precisa mudar nada ali, so ficou mais concreto.

**Categorias tecnicas identificadas nos 3 regulamentos de Livre/Novato/Iniciante** (a base relevante para uma escola, ignorando Dupla de Danca/Solo Dance/Quarteto/Grupo de Show, que sao modalidades proprias e so caberiam no catalogo se a escola tambem treinar essas disciplinas especificamente):

**Correcao (2026-09-20):** a primeira versao desta tabela renomeava a categoria "Fundamentos" (ja existente desde `0009_minha_evolucao_seed.sql`, cobrindo hoje Equilibrio e postura / Impulsos e propulsao / Freio e controle de velocidade) para "Impulsos" — o que deixava "Equilibrio e postura" e "Freio e controle de velocidade" sem categoria clara. O usuario apontou isso ao listar os 8 itens legados. Correcao: **manter "Fundamentos"** como categoria propria (nao substituir por "Impulsos"), reconciliando as 8 habilidades legadas (`supabase/migrations/0002_desempenho.sql:20-28`) com as 5 categorias que ja existem no banco + a nova "Figuras":

| Categoria (ja existe em `0009`, exceto Figuras) | Habilidades legadas que pertencem aqui | Elementos-exemplo dos regulamentos novos |
|---|---|---|
| **Fundamentos** | Equilibrio e postura, Impulsos e propulsao, Freio e controle de velocidade | Lobe de impulso externo/cruzado (frente/costas), Abre e Fecha (`LoIF`, `LoICF`, `LoIC`, `LoICC`, `AFc`) |
| **Giros** | Giros e corrupios | Heel and Toe, Upright (4 eixos), Sit, Camel, combinacoes (`HT`, `U1`-`U4`) |
| **Saltos** | Saltos | Waltz Jump, Toeloop, Salchow, Loop, Flip, Lutz, Axel — por rotacao (`1W` e demais) |
| **Passos** | Sequencia de passos | Footwork Sequence por nivel — cruzado na frente, mohawk, virada de tres, choctaw, traveling (`FoSqNB`, `FoSqN1`...) |
| **Figuras** (nova, decisao 7.2) | **Figuras de alongamento** — precisa sair de "Fundamentos" (achado 4.3 abaixo) | Camel (Forward/Sideways/Layover/Inverted), Upright (Forward/Layback/Split/Biellmann/Torso Sideways), especiais (Spread Eagle, Charlotte, Sonja, Fan Spiral) — `FigA` + posicao |
| **Artistico** | Musicalidade e apresentacao | Sequencia Coreografica, Sequencia Artistica, Traveling (`ChSt`, `TrB`/`Tr1`) |

### 7.3.1 Achado: dado hoje inconsistente com a decisao 7.2 — precisa de migration de correcao

Confirmado no `case` de categorizacao de `0009_minha_evolucao_seed.sql` (linha ~67): qualquer habilidade legada sem mapeamento explicito cai no `else -> 'fundamentos'`, e **"Figuras de alongamento" cai nesse `else`** — ou seja, o dado que ja esta em producao tem essa habilidade categorizada como "Fundamentos", nao como "Figuras". Isso e exatamente o achado que motivou a decisao 7.2 (Figuras deveria ser categoria propria), mas o dado em si ainda nao foi corrigido. **Acao pendente, entra no backlog da Fase 4:** nova migration que (a) cria a categoria "Figuras" em `categorias_habilidade` e (b) faz `update habilidades_catalogo set categoria_id = <id-figuras> where slug = 'figuras-alongamento'` — sem isso, a tela de catalogo do dono (secao 8.1) vai mostrar "Figuras de alongamento" dentro de Fundamentos, contradizendo a decisao ja tomada.

O campo `habilidades_catalogo.nome_internacional` (ja existe desde `0007_minha_evolucao_base.sql`) e exatamente o lugar certo pra guardar esses codigos oficiais (`FigA`, `U1`, `LoIF`...) — nao precisa de coluna nova, so popular o que ja existe.

**Sobre modulo vs. nivel:** os regulamentos confirmam que a progressao oficial do esporte (Novato -> Iniciante -> Basico -> Aspirante -> Nacional -> Internacional, cada uma com Categoria por idade dentro) e **bem mais granular** que o `modulo` simples (1-4) que a escola usa hoje — nao ha correspondencia direta 1-para-1. Isso significa que o `modulo` da escola continua sendo uma banda **interna e mais simples**, curricular, não a classificacao oficial de competicao — a documentacao oficial serve pra dar **vocabulario e criterio tecnico** aos elementos que compoe cada modulo interno, nao pra substituir o `modulo` pela classe/nivel oficial.

### 7.4 Rascunho de mapeamento modulo -> elementos (proposta, para sua validacao)

Baseado na progressao de dificuldade ja evidente nos proprios regulamentos (Novato e o nivel de entrada, Iniciante exige o primeiro salto e corrupios, Basico exige combinacoes), este e um **primeiro rascunho** pra voce corrigir — nao é uma decisao, é ponto de partida pra discussao com a equipe tecnica:

- **Modulo 1** (~ pre-Novato): impulsos de base (`LoIF`/`LoIC` versao Base), abre-e-fecha, 1 figura de alongamento simples (upright forward), sem saltos nem giros.
- **Modulo 2** (~ equivalente a Novato): 2 lobes de impulso confirmados, combinacao aviao-carrinho, footwork sequence base, 1 figura de alongamento (sem exigir bonificacao).
- **Modulo 3** (~ equivalente a Iniciante): Waltz Jump, corrupio Heel and Toe e um Upright, footwork sequence nivel 1, figura de alongamento com eixo mais trabalhado.
- **Modulo 4** (~ pronto pra Basico/primeira competicao): saltos simples adicionais (toeloop/salchow), giro combinado incluindo sit, footwork nivel 2, figura de alongamento bonificada (biellmann, camel sideways, etc.).

**O que fica fora do catalogo interno**, por ser aparato de competicao e nao de treino/avaliacao pedagogica: sistemas de julgamento (BASYS/RollArt/Sistema White), tabelas de deducao de nota, criterio de desempate, categorias por idade pra elegibilidade de prova, regras de premiacao/classificacao por clube. Se a escola precisar preparar alunos para competicao especifica no futuro, isso e uma tela/funcionalidade separada (algo como "elegibilidade de prova"), nao faz parte de Minha Evolucao.

## 8. Decisao registrada (2026-09-20): rascunho aceito, mais 2 requisitos novos

O usuario aceitou o rascunho da secao 7.4 como esta por enquanto ("essa definicao por enquanto esta bom") e trouxe dois requisitos novos: (1) o dono precisa poder editar/adicionar/excluir qualquer habilidade ou figura nos modulos pela propria UI, nao so via migration; (2) a avaliacao do aluno deve compor um "score", inspirado no mesmo tipo de avaliacao oficial dos regulamentos (base + ajuste de qualidade = pontuacao do elemento, somada).

### 8.1 Achado: a RLS do catalogo ja e dono-only — falta so a tela

Conferido em `supabase/migrations/0007_minha_evolucao_base.sql:205-241`: **todas** as tabelas do catalogo (`categorias_habilidade`, `habilidades_catalogo`, `criterios_habilidade`, `prerequisitos_habilidade`, `metodologias_evolucao`, `niveis_evolucao`, `requisitos_nivel_evolucao`) ja tem policy de escrita `using (papel_atual() = 'dono')` — isso foi decidido desde a migracao fundacional da Evolucao, so nunca ganhou uma tela em cima. O requisito do usuario nao exige nenhuma mudanca de RLS, so a UI de CRUD que nunca foi construida.

**Desenho da tela (dono-only, nova secao "Catalogo de Evolucao"):**
- Lista de categorias por modalidade (nome, ordem, ativo/inativo) com CRUD.
- Dentro de cada categoria, lista de habilidades/figuras (nome, codigo oficial em `nome_internacional` — ja existe a coluna, so faltava popular/editar, descricao, ativo) com CRUD.
- Dentro de cada nivel/modulo (`niveis_evolucao`, ja modelado como "Nivel 1/2/3/4" na seed de `0009`), gestao de `requisitos_nivel_evolucao`: adicionar/remover quais habilidades/figuras pertencem aquele nivel, com peso e status minimo — e exatamente o mecanismo que viabiliza editar "quais habilidades e figuras estao em cada modulo" que o usuario pediu.
- Acesso: novo item de menu "Catalogo" no `QuickMenu.tsx`, visivel so quando `souDono`.

### 8.2 Desenho da "nota de execucao" — score inspirado no sistema oficial, simplificado

Os regulamentos (`ROLLART - Precision values` e as tabelas de valores dos regulamentos estaduais/CSB) usam o mesmo principio em todo lugar: **cada elemento tem um valor base, ajustado por um grau de confirmacao/qualidade (de reprovado a bonificado), gerando uma pontuacao do elemento; a soma das pontuacoes vira a nota do programa.** Proponho o equivalente simplificado, reaproveitando ao maximo o que ja existe (a avaliacao detalhada com nota 0-100 por criterio ja calcula algo parecido a um ajuste de qualidade — nao e uma mecanica nova, e uma composicao do que ja esta la):

1. **Nova coluna `valor_base` (numeric) em `habilidades_catalogo`.** Editavel na mesma tela de catalogo do dono (secao 8.1) — e o equivalente ao "BASE" das tabelas oficiais: quanto vale essa habilidade/figura na pontuacao, independente de quem a executa.
2. **Fator de qualidade por avaliacao:**
   - Avaliacao rapida (so status): mapear os 5 status existentes pra um fator, equivalente simplificado ao "confirmado/nao confirmado" oficial — `nao_iniciado` = 0, `aprendendo` = 0.25, `em_desenvolvimento` = 0.5, `dominado` = 0.85, `consolidado` = 1.0. Nao precisa de coluna nova: e uma funcao pura sobre o `status` que ja e gravado.
   - Avaliacao detalhada (por criterio): o fator de qualidade **ja e** `percentual_geral / 100`, calculado pela propria RPC `registrar_avaliacao_evolucao` a partir dos criterios — nao precisa de nada novo aqui, so usar o numero que ja existe.
3. **Pontuacao do elemento** = `valor_base * fator_qualidade`. **Pontuacao do aluno** (por periodo/nivel) = soma das pontuacoes das habilidades/figuras avaliadas nesse periodo — uma funcao nova (`calcularPontuacaoAluno`, em `src/features/evolucao/selectors.ts`, mesmo arquivo que ja calcula `calcularResumoCategorias`), sem RPC nova: le os dados que `getStatusHabilidadesAluno`/`getRequisitosNivel` ja trazem, so precisa que `habilidades_catalogo` (achado 8.1) venha junto com `valor_base`.
4. **Onde aparece:** um numero novo em `EvolucaoScreen`, ao lado do percentual de progresso ja existente — ex.: "Pontuacao atual: 18.4" — nao substitui a barra de progresso (que mede "pronto pro proximo nivel"), e um indicador complementar de desempenho/qualidade, mais proximo do espirito de nota de campeonato.

**Deliberadamente fora do escopo** (mesma linha de corte da secao 7.4): nao vou importar a escala completa de -3 a +3 nem as tabelas de deducao por erro especifico (queda, aterrissagem incorreta, etc.) — isso exige um arbitro tecnico em tempo real assistindo a execucao, incompativel com o fluxo de avaliacao em sala de aula que a Evolucao ja foi desenhada pra suportar ("registrar uma avaliacao em menos de 30 segundos", `docs/minha-evolucao.md`).

### 8.3 Consequencia para o backlog

Estes dois itens se somam ao passo 1 da Fase 4 (`evolucao-vs-desempenho.md` §5.2 — "tela/fluxo de atribuicao de metodologia", que ja era o bloqueador de tudo o resto): a tela de catalogo do dono (8.1) e maior do que so "atribuir metodologia a um aluno" — vira uma area de administracao completa do catalogo pedagogico. A pontuacao (8.2) e aditiva, nao bloqueia nada. Mais um item, achado na secao 7.3.1: migration de correcao movendo "Figuras de alongamento" de "Fundamentos" pra "Figuras" — pequeno, mas deve rodar **antes** da tela de catalogo do dono ficar visivel pra equipe, senao a primeira coisa que o dono ve la e um dado categorizado errado.

Nao vou implementar nenhum dos tres sem autorizacao explicita pra fase de codigo — mesma combinacao do processo ate aqui.
