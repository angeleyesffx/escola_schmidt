# Alunos e Responsaveis

Quarto documento da serie. Depende de [papeis-e-permissoes.md](./papeis-e-permissoes.md) (pendencia sobre o papel "Responsavel", registrada la e retomada aqui) e de [chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md) (pergunta sobre conversao de aula teste em matricula, ja respondida como aceitavel).

## 1. Visao geral

O modelo de dados separa deliberadamente **aluno** (registro na tabela `alunos`, a crianca/atleta) de **login** (registro em `perfis`, uma conta de acesso). A maioria dos alunos nunca tem login proprio — `alunos.perfil_id` fica nulo. Quando um responsavel precisa acessar o app (ver frequencia, evolucao, editar dados), ele recebe uma conta com `papel = 'aluno'` vinculada ao registro do filho. Essa secao cobre: cadastro pelo staff, autocadastro publico, e o processo manual de ligar as duas pontas.

## 2. Papeis e permissoes

| Acao | dono | professor | aluno/responsavel |
|---|---|---|---|
| Ver lista de alunos | sim | sim | nao |
| Cadastrar aluno / editar modulo, plano, contrato | sim | sim | nao |
| Editar dados basicos do proprio filho (nome, nascimento, nome/telefone do responsavel) | sim | sim | sim, via RPC `atualizar_meus_dados_aluno` — nao inclui modulo nem plano |
| Vincular conta autocadastrada a um aluno | sim | sim | nao |
| Desvincular conta de um aluno | sim | sim | nao |
| Convidar responsavel/aluno (edge function `convidar-aluno`) | sim | sim | nao |
| Se autocadastrar (signup publico) | n/a | n/a | sim, qualquer pessoa |

Sem divergencia RLS/UI encontrada aqui.

## 3. Casos de uso

### UC-01 — Staff cadastra um aluno diretamente

- **Pre-condicoes:** staff autenticado.
- **Fluxo principal:** `alunos/novo.tsx` — nome, nascimento, modulo (1-4), nome/telefone do responsavel, plano (mensal/trimestral/semestral/anual, com data de fim do contrato calculada automaticamente), datas de inicio/fim de contrato. Grava em `alunos` + `contratos`.
- **Fluxos alternativos:**
  - **FA-1 (convite opcional no mesmo formulario):** se o staff preencher um "email de acesso", o sistema dispara o convite (`convidar-aluno`) assim que o aluno e salvo.
  - **FE-1 (aluno salvo, convite falha):** a tela mostra mensagem recuperavel ("aluno salvo mas convite falhou") — o cadastro do aluno nao e desfeito, so o convite pode ser reenviado depois.
- **Pos-condicoes:** aluno aparece no Kanban de `alunos/index.tsx`, agrupado por modulo.

### UC-02 — Autocadastro publico (signup)

- **Pre-condicoes:** nenhuma — tela publica.
- **Fluxo principal:** pessoa preenche nome/email/senha, escolhe "para mim mesmo" ou "para meu filho(a) menor de idade", marca a caixa de consentimento (texto varia conforme a escolha) e envia. Uma conta e criada com `papel = 'aluno'` e **sem nenhum vinculo** a um registro em `alunos`.
- **Achado confirmado no codigo:** a escolha "para mim / para meu filho" (`titular`) e o texto de consentimento aceito **sao coletados na tela mas nunca enviados a lugar nenhum** — `signUp(nome, email, senha)` (`src/features/auth/AuthProvider.tsx:186`) so recebe nome/email/senha. Nao ha registro de qual consentimento foi aceito, nem se a pessoa se identificou como titular ou responsavel, em nenhuma tabela do banco. Nao e um bug de funcionamento (o cadastro funciona), mas e uma lacuna de conformidade/auditoria: se a escola precisar comprovar que consentimento foi coletado (ex.: LGPD, dados de menor de idade), hoje nao ha como.
- **Pos-condicoes:** conta criada, mas o usuario cai em um estado de espera (ver UC-03/UC-04).

### UC-03 — Aluno autocadastrado fica esperando vinculo

- **Pre-condicoes:** conta criada via UC-02, `alunos.perfil_id` ainda nao aponta para ela.
- **Fluxo principal:** ao logar, `perfil.tsx` mostra "Seu cadastro ainda nao foi vinculado a um aluno. Fale com a escola." O usuario fica nesse estado ate um staff agir.
- **Pos-condicoes:** nenhuma, ate UC-04.

### UC-04 — Staff vincula uma conta autocadastrada a um aluno

- **Pre-condicoes:** staff autenticado, abrindo o registro de um aluno especifico em `alunos/[id]`.
- **Fluxo principal:** a secao de vinculo de conta chama `getPerfisNaoVinculados()`, que busca **todas** as contas com `papel = 'aluno'` que nao aparecem em nenhum `alunos.perfil_id` — e mostra essa lista completa como "candidatos" para vincular a **este** aluno especifico. Staff reconhece o nome certo na lista e toca para vincular.
- **Achado confirmado no codigo:** a consulta (`src/features/alunos/api.ts:78-92`) nao filtra por nenhuma relacao entre a conta candidata e o aluno da tela — e a mesma lista completa de "todas as contas aluno sem vinculo em qualquer lugar da escola", repetida identica em cada pagina de aluno que o staff abrir. Nao ha correspondencia por nome, telefone ou qualquer heuristica; o staff precisa reconhecer visualmente a pessoa certa numa lista que cresce conforme mais gente se autocadastra sem vinculo. Tambem **nao existe uma tela central** que liste "cadastros pendentes de vinculo" — a unica forma de saber que ha candidatos pendentes e abrir algum aluno e ver a lista (que, sendo global, aparece em todos).
- **Pos-condicoes:** `alunos.perfil_id` preenchido; usuario deixa o estado de espera do UC-03.

### UC-05 — Responsavel edita os proprios dados

- Ja coberto no vinculo com Evolucao/Perfil: RPC `atualizar_meus_dados_aluno` permite editar nome, nascimento, nome/telefone do responsavel — deliberadamente **exclui** modulo e plano, que continuam exclusivos do staff.

## 4. Problemas confirmados no codigo

### 4.1 Lista de vinculo pendente e global, nao filtrada, e sem tela central (achado principal desta area)

Detalhado no UC-04 acima. Impacto cresce com o numero de autocadastros simultaneos sem vinculo — hoje a escola e pequena o suficiente para o staff reconhecer nomes, mas isso nao escala.

### 4.2 Consentimento de titular/responsavel coletado na UI mas nunca persistido

Detalhado no UC-02. Risco de conformidade, nao de funcionamento.

### 4.3 Um responsavel = uma conta = um aluno (sem suporte a multiplos filhos)

Confirmado: `alunos.perfil_id` e `unique` (`supabase/migrations/0001_schema.sql:31`), e `AuthProvider` resolve `meuAluno` com `.maybeSingle()` sobre `alunos.perfil_id = auth.uid()` — estruturalmente so pode haver um aluno vinculado por login. Um responsavel com dois filhos matriculados precisa de duas contas separadas (ou compartilhar uma conta e alternar manualmente, o que a UI nao oferece). Isso e a mesma pendencia ja registrada em `papeis-e-permissoes.md` (item 1 daquele documento: "melhorar o modelo de Responsavel").

### 4.4 Conversao de aula teste em matricula (fechado, sem acao)

Ja perguntado e respondido em `chamada-agenda-frequencia.md`: aceitavel como esta, recadastro manual pelo staff. Mencionado aqui so para registro de que essa pendencia entre os dois documentos esta encerrada.

## 5. Decisoes registradas (2026-09-19)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Modelo de Responsavel | **O enum `papel` ganha um 4º valor: `responsavel`**, distinto de `aluno`. No autocadastro em que a pessoa se identifica como responsavel, o nome do filho informado **cria diretamente um registro em `alunos`** (em vez de so criar uma conta solta esperando vinculo manual). Acesso a features (frequencia, evolucao, autocheckin em nome do filho) permanece **identico** ao que o papel `aluno` ja tem hoje — a mudanca e de identidade/modelagem, nao de funcionalidade visivel |
| 2 | Fila de vinculo pendente (achado 4.1) | **Unificar em vez de criar uma tela nova.** A solucao e a propria decisao 1: eliminando a etapa de "conta solta esperando match manual", a lista de candidatos repetida deixa de existir — o vinculo acontece no proprio signup |
| 3 | Consentimento (achado 4.2) | **Precisa de comprovacao formal.** Vira prioridade de correcao, nao so risco registrado |

### 5.1 Desenho decorrente (para a fase de implementacao)

**Papel `responsavel` (decisao 1):**

- Adicionar `'responsavel'` ao enum `papel` (nova migration `alter type papel add value`).
- Toda RLS que hoje testa `papel_atual() = 'aluno'` para liberar leitura/escrita escopada ao proprio aluno vinculado (contratos, testes_nivel, avaliacoes, status_habilidade_aluno, historico_nivel_evolucao, pedidos_presenca, presencas, disponibilidade de editar dados basicos, leitura do perfil do professor da propria turma) precisa aceitar tambem `papel_atual() = 'responsavel'`, com a mesma condicao de vinculo (`alunos.perfil_id = auth.uid()`). Na pratica: em toda policy, trocar a condicao de `papel_atual() = 'aluno'` por `papel_atual() in ('aluno', 'responsavel')`.
- `AuthProvider` (`meuPapel`) e todas as telas que hoje checam `meuPapel === 'aluno'` para liberar UI (QuickMenu, Perfil, Frequencia, Evolucao) precisam da mesma troca para `['aluno', 'responsavel'].includes(meuPapel)`.
- **Novo fluxo de signup:** quando `titular === 'responsavel'`, o formulario passa a pedir tambem o nome do filho (hoje so pede isso implicitamente e nao usa); ao concluir, cria a conta com `papel = 'responsavel'` **e** cria a linha em `alunos` (nome do filho, sem modulo/plano ainda — esses continuam exclusivos do staff) ja com `perfil_id` apontando pra essa conta recem-criada. Isso substitui o UC-02/UC-03/UC-04 atuais (conta solta -> espera -> staff vincula manualmente) por um fluxo direto. O staff continua responsavel por completar o cadastro (modulo, plano, contrato) depois, mas nao precisa mais "achar" o registro certo numa lista.
- Quando `titular === 'proprio'` (aluno que se cadastra sozinho, ex. adolescente), mantem `papel = 'aluno'`, sem criar `alunos` automaticamente — segue precisando do vinculo manual do staff, ja que nesse caso nao ha, no cadastro, nenhum dado que identifique a qual aluno existente aquela conta pertence.
- Isso ainda **nao resolve multiplos filhos por conta** (uma conta `responsavel` continua apontando para 1 `alunos.perfil_id`, pela mesma restricao `unique` de hoje) — essa parte do achado 4.3 fica registrada como fora de escopo desta rodada, ja que nao foi perguntada nem decidida explicitamente; posso trazer de volta se voce quiser tratar tambem agora.

**Retomada (2026-09-21) — achado 4.3 volta ao escopo, com um caso a mais**

Pedido direto do usuario: o mesmo perfil pode ser, ao mesmo tempo, aluno matriculado **e** responsavel por outros alunos matriculados (ex.: pai/mae que tambem pratica, com filho(s) tambem na escola). Isso e mais amplo que "responsavel com dois filhos" — sao 3 formatos de identidade que o modelo de hoje nao distingue:

1. **Responsavel puro** — 1+ filhos matriculados, sem matricula propria.
2. **Aluno-responsavel** — matriculado por conta propria **e** responsavel por 1+ outros matriculados.
3. **Aluno adulto sem filhos** — caso unico que ja funciona hoje.

Causa raiz confirmada: `alunos.perfil_id unique` + `AuthProvider` resolvendo `meuAluno` com `.maybeSingle()` — estruturalmente 1 login so pode apontar pra 1 `alunos`. `aluno` e `responsavel` ja tem acesso identico no RLS/UI (decisao 1 acima), entao o problema nao e o enum `papel` — e essa relacao 1-pra-1.

| # | Pergunta | Decisao |
|---|---|---|
| 4 | Multiplos alunos por conta (achado 4.3, retomado) | **Trocar `alunos.perfil_id` (FK unica) por uma tabela de vinculo `perfil_id ↔ aluno_id` muitos-pra-muitos**, com uma `relacao` (`proprio` ou `responsavel`) por vinculo — a propria matricula da pessoa vira so mais uma linha dessa relacao, unificando os 3 formatos acima |
| 5 | Navegacao entre alunos vinculados | **Seletor no topo das telas** (Frequencia, Evolucao, autocheckin em `chamada/[id].tsx`) — "Vendo dados de: [nome ▾]" — lembrando a ultima escolha, visivel so quando ha mais de 1 vinculo |
| 6 | Como adicionar um vinculo extra a uma conta existente | **Automatico por e-mail tambem**, reaproveitando o padrao de `vincula_aluno_por_email` (0020/0030) — se o e-mail do responsavel usado numa conta ja existente bater com o `responsavel_email` de outro aluno cadastrado depois, vincula sozinho. Mesmo risco de falso-match por e-mail reaproveitado que esse fluxo ja tem hoje, agora valendo tambem pra vinculos adicionais (nao so o primeiro) |

### 5.2 Desenho decorrente da decisao 4-6

- **Migration**: nova tabela `vinculos_aluno (id, perfil_id references perfis, aluno_id references alunos, relacao text check in ('proprio','responsavel'), criado_em, unique(perfil_id, aluno_id))`. Backfill a partir de `alunos.perfil_id` existente: `relacao = 'proprio'` quando `perfis.papel = 'aluno'`, `relacao = 'responsavel'` quando `perfis.papel = 'responsavel'` (infere da semantica do fluxo de signup da decisao 1: `titular = 'proprio'` sempre resultou em `papel = 'aluno'`; `titular = 'responsavel'` sempre resultou em `papel = 'responsavel'`). Depois do backfill, `alunos.perfil_id` e removida — banco de producao ainda esta na janela em que isso e seguro (mesmo raciocinio ja aplicado em 0027).
- **RLS**: nova funcao `sou_vinculado_ao_aluno(aluno_id uuid) returns boolean` (`exists (select 1 from vinculos_aluno where aluno_id = $1 and perfil_id = auth.uid())`), substituindo toda policy que hoje testa `alunos.perfil_id = auth.uid()` — a lista completa esta no bullet 2 da decisao 1 acima (contratos, testes_nivel, avaliacoes, status_habilidade_aluno, historico_nivel_evolucao, pedidos_presenca, presencas, `atualizar_meus_dados_aluno`, leitura do professor da propria turma).
- **`vincula_aluno_por_email`/trigger (0020/0030)**: passam a fazer `insert into vinculos_aluno (perfil_id, aluno_id, relacao) values (p_perfil_id, v_aluno_id, 'responsavel')` em vez de `update alunos set perfil_id = ...` — sem a restricao de "so se `perfil_id is null`" que hoje limita a 1 vinculo; a checagem correta vira "esse `aluno_id` especifico ainda nao tem nenhum vinculo" (evita o mesmo aluno cair em duas contas por coincidencia de e-mail, mas nao limita quantos alunos uma conta pode acumular).
- **`AuthProvider`**: `meuAluno` (singular) vira `meusAlunos: VinculoAluno[]`; novo estado `alunoSelecionadoId` (persistido, ex. AsyncStorage) + setter, default pro primeiro vinculo com `relacao = 'proprio'` se existir, senao o primeiro da lista. `meuAlunoCarregado` mantem o nome, agora cobrindo o carregamento da lista inteira.
- **UI**: novo componente compartilhado `SeletorAluno` (mostrado so quando `meusAlunos.length > 1`) no topo de Frequencia, Evolucao/Minha Evolucao e do ramo autocheckin de `chamada/[id].tsx`; essas telas trocam a leitura direta de `meuAluno` pelo aluno selecionado no seletor.

### 5.3 Backlog gerado pela retomada

1. Migration: `vinculos_aluno`, backfill, remocao de `alunos.perfil_id`, funcao `sou_vinculado_ao_aluno`.
2. Migration: reescrever as policies RLS listadas na decisao 1 (bullet 2) pra usar `sou_vinculado_ao_aluno`.
3. Migration: `vincula_aluno_por_email`/trigger (0020/0030) passam a inserir em `vinculos_aluno` em vez de fazer `update` de `perfil_id`.
4. `AuthProvider`: `meuAluno` → `meusAlunos` + `alunoSelecionadoId`.
5. Novo componente `SeletorAluno`; adotado em Frequencia, Evolucao/Minha Evolucao, `AutocheckinAluno` (`chamada/[id].tsx`).
6. Staff: tela de vinculo em `alunos/[id]/index.tsx` passa a permitir vincular uma conta ja vinculada a outro aluno (hoje a query de candidatos provavelmente assume vinculo unico — revisar `getPerfisNaoVinculados`/fluxo de vinculo manual).

**Consentimento (decisao 3):**

- Persistir, no momento do signup: `titular` escolhido (`proprio`/`responsavel`) e uma referencia a versao do texto de consentimento aceito, carimbados com data — coluna nova em `perfis` (ex.: `titular`, `consentimento_versao`, `consentimento_aceito_em`) e o texto de cada versao versionado em codigo (constante `CONSENTIMENTO`, ja existe em `signup.tsx`, so falta persistir qual foi aceita).
- `signUp()` em `AuthProvider.tsx:186` precisa receber esses dados extras e grava-los na criacao do `perfis` (ajuste no trigger `cria_perfil_novo_usuario` ou update logo apos o `insert`, dentro da mesma transacao logica que ja cria o registro em `alunos` quando for responsavel).

## 6. Backlog de implementacao gerado por este documento

Este e o escopo mais amplo entre os documentos ate agora — nao e uma correcao pontual, e uma mudanca de modelagem que atravessa auth, RLS e o formulario de signup. Fica registrado como iniciativa propria (como o documento de Evolucao vs Desempenho), para priorizar na fase de implementacao, com esta ordem sugerida:

1. Migration: adicionar `responsavel` ao enum `papel`; colunas de consentimento em `perfis`.
2. Atualizar todas as RLS policies que testam `papel_atual() = 'aluno'` escopadas a aluno vinculado, para incluir `responsavel`.
3. Atualizar `AuthProvider` e as checagens de `meuPapel === 'aluno'` nas telas (QuickMenu, Perfil, Frequencia, Evolucao) para tratar os dois papeis como equivalentes de acesso.
4. Reescrever `signup.tsx` + `AuthProvider.signUp`: capturar nome do filho quando `titular === 'responsavel'`, criar `perfis` com `papel = 'responsavel'` + `alunos` vinculado numa mesma operacao, e persistir consentimento em ambos os caminhos (`proprio` e `responsavel`).
5. Remover o fluxo de "candidatos nao vinculados" (`getPerfisNaoVinculados`, secao de vinculo em `alunos/[id]/index.tsx`) para o caminho de responsavel — mantendo-o so para o caso remanescente de `titular === 'proprio'` sem vinculo (aluno que se cadastra sozinho).

Proximo documento, seguindo a ordem combinada: `docs/product/eventos.md`.

### 5.4 Retomada (2026-09-21) — responsavel cadastra os proprios filhos, no signup e depois

Pedido direto do usuario, complementar a decisao 4 (§5.2): ate aqui, mesmo com `alunos.perfil_id` deixando de ser `unique` (0033), **nenhum caminho de self-service criava uma linha nova em `alunos`** — o autocadastro publico so criava a conta em `perfis`; todo vinculo dependia da equipe preencher `responsavel_email` numa ficha ja existente (0020/0033/0037) ou de convite explicito. Ou seja, o proprio filho *tinha* que ja estar cadastrado pela equipe antes de qualquer vinculo acontecer. Dois caminhos novos fecham essa lacuna, os dois criando o vinculo ja **confirmado** (diferente do vinculo por e-mail de 0037 — aqui e a propria conta autenticada digitando o nome, sem risco de "e-mail errado" digitado por outra pessoa):

- **No cadastro:** `signup.tsx`, quando `titular === 'responsavel'`, ganha uma lista dinamica de campos "nome do filho" (0, 1 ou mais — opcional, pode ficar em branco). Os nomes preenchidos viajam em `raw_user_meta_data.filhos` (array) e `cria_perfil_novo_usuario()` (0038) cria uma linha em `alunos` por nome nao vazio, promovendo `papel` pra `responsavel` se ao menos um filho foi informado.
- **Depois de registrado:** novo card "Adicionar filho(a)" em `app/(app)/perfil.tsx`, sempre visivel (papel e vinculo sao independentes — um dono/professor que tambem e pai/mae pode usar o mesmo caminho), chamando a RPC `adicionar_meu_filho` (0038) a qualquer momento.

Os dois reaproveitam o mesmo helper interno (`adiciona_filho_confirmado`), evitando duplicar a logica de insert + promocao de papel. Isso nao substitui a decisao 4 (join table `vinculos_aluno`) nem a decisao 5 (`SeletorAluno` persistido) — **so adiciona a origem que faltava pros alunos que passam a existir por essas duas RPCs, sem exigir que a equipe cadastre a crianca primeiro.**

**Correcao no mesmo dia:** a primeira versao do formulario de cadastro so perguntava pelos filhos, cobrindo o caso 1 (responsavel puro) mas nao o caso 2 (aluno-responsavel) — ninguem perguntava se a propria pessoa tambem treina na escola. Adicionado um checkbox "Eu tambem sou aluno(a) matriculado(a)..." (so visivel quando `titular === 'responsavel'`); quando marcado, `signup.tsx` inclui o proprio `nome` no mesmo array `filhos` enviado a `cria_perfil_novo_usuario()` — sem migration nova, ja que da perspectiva da trigger um nome nessa lista e so "mais um aluno pra vincular a essa conta", nao importa se e a propria pessoa ou um filho dela.
