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
