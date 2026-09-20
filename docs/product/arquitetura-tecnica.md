# Arquitetura Tecnica das Melhorias

Setimo documento da serie, escrito do ponto de vista de arquitetura de software. Os 6 documentos anteriores (`papeis-e-permissoes.md`, `chamada-agenda-frequencia.md`, `evolucao-vs-desempenho.md`, `alunos-e-responsaveis.md`, `eventos.md`, `usuarios-e-convites.md`) e o `plano-de-execucao.md` levantaram achados, tomaram decisao de produto e ordenaram por fase. Este documento reaudita esse backlog contra o estado real do repositorio **hoje** (working tree, nao so o que estava commitado quando os documentos anteriores foram escritos) e estrutura o desenho tecnico de cada item pendente.

## 1. Achado preliminar: o working tree avancou depois que os 6 documentos foram escritos

Os documentos de produto descrevem o codigo como se `supabase/migrations/` terminasse em `0016` (disponibilidade particular fixa por dia da semana) e o modulo `usuarios/` fosse o unico ponto de gestao de conta. O `git status` atual mostra 4 migrations novas (`0017`-`0020`) e telas inteiras (`chamada/agendar.tsx`, `chamada/modulos.tsx`, `chamada/nova-teste.tsx`, `app/(app)/usuarios/`) ainda **nao commitadas** e **nao refletidas** em nenhum dos 6 documentos. Antes de estruturar melhorias novas, preciso registrar o que ja mudou, porque parte do backlog ja fechado nos documentos anteriores foi parcialmente resolvida por essas migrations — de formas que nem sempre batem com o desenho que os documentos recomendaram.

| Migration/arquivo novo | O que implementa | Relacao com o backlog dos documentos anteriores |
|---|---|---|
| `0017_perfis_gestao_dono.sql` | Fecha brecha de auto-promocao via `raw_user_meta_data` (cadastro publico sempre nasce `aluno`); RPC `atualizar_meu_perfil` restrita a nome/telefone; `perfil_dono_gerencia` para `update` de outros perfis | Endurece `perfis`, mas **nao** implementa o item 1 do backlog (auto-bloqueio de dono) — a policy nova ainda nao exclui `id = auth.uid()` (ver secao 2.1) |
| `0018_professor_modulos_e_aula_teste.sql` | Professor passa a se auto-atribuir em `professores_aula` (antes so o dono); cria `aulas_teste`/`aulas_teste_alunos` com RLS por `sou_responsavel_pela_aula` | Implementa a mecanica de dados por tras de UC-05/UC-06 de `chamada-agenda-frequencia.md` (que os documentos ja descreviam como existente — bate). **Nao** implementa o item 3 do backlog (RLS de `presencas` respeitando "Meus modulos") — so mexeu na escrita de `professores_aula`, nao na leitura/escrita de `presencas` (ver secao 2.2) |
| `0019_disponibilidade_particular_flexivel.sql` | Recria `disponibilidade_particular` com `data_inicio/data_fim/tipo_recorrencia/horas[]`, funcao `ocorre_na_data`, recalculo de `horarios_livres_particular` | Corresponde exatamente ao UC-04 de `chamada-agenda-frequencia.md` (que ja descrevia esse comportamento como existente) — migration confirma, nao contradiz |
| `0020_auto_vincula_aluno_por_email.sql` | Adiciona `alunos.responsavel_email`; vincula `perfil_id` automaticamente por e-mail, nos dois sentidos (conta chega depois da matricula, ou matricula chega depois da conta) | **Resolve o achado 4.1 de `alunos-e-responsaveis.md`** (fila de vinculo pendente global e nao filtrada) por um caminho **diferente** do decidido na secao 5 daquele documento (papel `responsavel` formal + criacao de `alunos` no signup). Isso e uma bifurcacao de arquitetura real — tratada em detalhe na secao 3 |
| `app/(app)/chamada/agendar.tsx`, `modulos.tsx`, `nova-teste.tsx` | Telas para os fluxos de `aulas_teste` e "Meus modulos" descritos acima | UI correspondente as migrations 0018 |
| `app/(app)/usuarios/` (`index.tsx`, `novo.tsx`, `[id].tsx`) | Telas de gestao de conta descritas em `usuarios-e-convites.md` como ja existentes | Bate com a documentacao — sem divergencia |

**Consequencia pratica:** os 6 documentos de produto precisam de um passo de atualizacao (marcar UC-05/UC-06/UC-04 de `chamada-agenda-frequencia.md` e o modulo `usuarios/` como implementados neste working tree, nao "existentes" de forma generica) antes da proxima rodada de leitura por outra pessoa/IA. Isso fica registrado como item de manutencao de documentacao, nao tecnico — nao entra no plano de fases abaixo.

### 1.1 Achado mais serio do que o esperado: o banco de producao nunca tinha sido populado

Confirmado em 2026-09-20, na tentativa de aplicar `0018_professor_modulos_e_aula_teste.sql`: o erro `relation "professores_aula" does not exist` (tabela criada em `0005_pedido_presenca_professor.sql`) revelou que o projeto Supabase de producao **nunca rodou nenhuma migration** — nem `0001_schema.sql`. Os 6 documentos de produto (escritos lendo so o codigo-fonte) descreveram telas e RLS como "existentes"/"em uso" quando, de fato, nada disso tinha schema por tras em producao. Isso nao invalida a analise de codigo dos documentos (o codigo em si esta correto), mas invalida qualquer leitura deles como descricao do **sistema em producao** — eram, na pratica, descricao do repositorio. Ver secao 4.0 para o runbook de bootstrap que resultou disso, ja executado.

## 2. Reauditoria do backlog consolidado (7 itens de `usuarios-e-convites.md` §7)

Status confirmado lendo o codigo atual, nao o que os documentos registravam.

### 2.1 Item 1 — RLS: dono nao pode alterar a propria linha em `perfis`

**Resolvido em 2026-09-20.** Migration `0021_perfil_dono_nao_auto_gerencia.sql` criada e aplicada em producao: `perfil_dono_gerencia` agora exige `id <> auth.uid()` tanto em `using` quanto em `with check`. Arquivo ainda sem commit (ver Fase 0).

### 2.2 Item 2 — Guarda de papel em `chamada/novo-evento.tsx`

**Resolvido em 2026-09-20.** `app/(app)/chamada/novo-evento.tsx` agora le `meuPapel` do `useAuth()` e retorna `<Redirect href="/" />` quando `meuPapel === 'aluno'`, mesmo padrao das telas irmas. Ainda sem commit.

### 2.3 Item 3 — RLS: chamada regular respeita "Meus modulos" (exceto dono)

**Resolvido em 2026-09-20, com desenho mais simples do que o planejado.** Ao escrever a migration, descobri que a premissa do `plano-de-execucao.md` §4 (backfill a partir de `aulas_recorrentes.professor_id`) estava desatualizada: essa coluna existia no schema original (`0001`) mas foi **removida** em `0005_pedido_presenca_professor.sql` quando `professores_aula` virou a fonte da verdade — não sobra nenhum dado legado pra migrar. Combinado ao achado da secao 1.1 (banco recem-populado, sem nenhum professor com aula em andamento), a migration de backfill deixou de ser necessaria — essa e a janela mais segura possivel pra essa RLS entrar em vigor, exatamente por nao haver uso real ainda a proteger.

Migration `0022_presenca_respeita_meus_modulos.sql`: `aula_escrita` (para `tipo = 'regular'`) e `presenca_escrita` agora exigem `sou_responsavel_pela_aula(aula_recorrente_id)` (funcao ja existente, criada em `0018` para `aulas_teste`, reaproveitada aqui) — `dono` mantem bypass total (embutido na propria funcao). UI: `chamada/lista.tsx` e os atalhos de `chamada/index.tsx` (Agenda) agora filtram a lista de turmas do dia por `getResponsabilidadesProfessor(professorId)` quando `meuPapel === 'professor'`; `dono` continua vendo a grade inteira. Cobertura de teste nova em `chamada/__tests__/lista.test.tsx` (5 casos: dono ve tudo, professor so ve o que assumiu, lista vazia quando nao assumiu nada, navegacao, guarda de aluno).

**Consequencia operacional:** a partir da aplicacao desta migration, todo professor precisa passar por "Meus modulos" (`chamada/modulos.tsx`) e assumir seus horarios antes de conseguir abrir a primeira chamada — vale avisar a equipe antes de convidar os primeiros professores reais.

### 2.4 Item 4 — Tratar `23505` em `getOuCriaAula`

**Resolvido em 2026-09-20.** `src/features/chamada/api.ts` agora captura `erroInsert.code === '23505'` na corrida de criacao e refaz o `select`, reaproveitando a aula que o outro staff criou, em vez de propagar o erro cru. Ainda sem commit.

### 2.5 Item 5 — Migracao Minha Evolucao <- Desempenho

**Nao iniciado.** Nenhum arquivo tocado corresponde a essa migracao (nem tabela `aluno_metodologias` com trigger de escrita, nem tela de Jornada, nem radar chart). Plano de `evolucao-vs-desempenho.md` §5.2 continua o desenho valido — ver secao 4.4 deste documento para o detalhamento tecnico por passo.

### 2.6 Item 6 — Papel `responsavel` + signup unificado + consentimento persistido

**Escopo reduzido fechado em 2026-09-20 (Fase 3, migration `0023`).** Ver secao 3 para a decisao de nao seguir com o papel `responsavel` completo — `0020` (vinculo automatico por e-mail) ja resolve o achado 4.1, e a parte de consentimento (achado 4.2) foi implementada isoladamente, sem enum novo. Residual, deliberadamente fora de escopo: multiplos filhos por conta (achado 4.3) e o enum `responsavel` em si — so entram se surgir necessidade real de permissao diferenciada.

### 2.7 Item 7 — Concluir importacao automatica de feriados

**Nao iniciado.** `buscarFeriadosEstado` (`src/features/eventos/feriados.ts:13`) continua sem nenhuma chamada fora do proprio arquivo. Desenho de `eventos.md` §5.1 continua valido.

### 2.8 Item novo (2026-09-20) — Professor com dupla identidade (tambem aluno)

**Nao iniciado, decisao de produto fechada em [professor-como-aluno.md](./professor-como-aluno.md).** Auditoria confirmou que a RLS ja suporta um `perfis.papel = 'professor'` com `alunos.perfil_id` vinculado a si mesmo — as policies self-service em `contratos`, `pedidos_presenca`, `avaliacoes_evolucao`, `status_habilidade_aluno` etc. testam `eh_equipe() or exists (... a.perfil_id = auth.uid())`, nunca `papel_atual() = 'aluno'`. O que bloqueia sao 3 checagens client-side (`AuthProvider.tsx:139`, `QuickMenu.tsx:79`, `minha-evolucao.tsx:19`) que assumem papel `aluno` e `professor` mutuamente exclusivos, mais uma trava nova a adicionar (autoavaliacao bloqueada em `registrar_avaliacao_evolucao`, hoje sem nenhuma checagem de `p_aluno_id <> auth.uid()`). Sem dependencia de nenhuma fase abaixo.

## 3. Decisao arquitetural necessaria: papel `responsavel` vs. vinculo automatico por e-mail

`alunos-e-responsaveis.md` (decisao 1, 2026-09-19) fechou em: adicionar `'responsavel'` ao enum `papel`, reescrever o signup para criar `alunos` diretamente quando a pessoa se identifica como responsavel, e propagar `in ('aluno', 'responsavel')` por toda RLS que hoje testa `= 'aluno'`. Essa decisao foi tomada porque o unico jeito de resolver o achado 4.1 (fila de vinculo pendente, global e sem filtro) parecia ser eliminar a etapa de "conta solta esperando match manual".

`0020_auto_vincula_aluno_por_email.sql`, ja no working tree, resolve o **mesmo sintoma** (conta solta esperando vinculo manual) por um caminho mais barato: a equipe informa `responsavel_email` na ficha do aluno (na matricula ou depois) e um trigger liga a conta automaticamente por e-mail, nos dois sentidos, sem precisar de papel novo, sem RLS nova em nenhuma outra tabela, sem mexer no `AuthProvider`. Isso muda o calculo de custo/beneficio da decisao registrada:

| | Papel `responsavel` (decisao registrada) | Vinculo automatico por e-mail (`0020`, ja implementado) |
|---|---|---|
| Resolve achado 4.1 (fila global sem filtro) | sim | sim — ja resolvido |
| Resolve achado 4.3 (1 conta = 1 aluno, multiplos filhos) | nao (mesma limitacao de `perfil_id` unico) | nao (mesma limitacao, documentado explicitamente no comentario da migration) |
| Resolve achado 4.2 (consentimento nao persistido) | sim, como efeito colateral do redesenho do signup | nao — fora do escopo da migration |
| Superficie de mudanca | grande: enum novo, RLS de ~6-8 tabelas, `AuthProvider`, `signup.tsx`, `Edge Function convidar-usuario` | ja paga: 1 coluna, 2 triggers |
| Risco de deploy | alto (mudanca estrutural, RLS ampla) — por isso o `plano-de-execucao.md` isolou como fase propria | ja em producao potencial (so falta aplicar a migration) |

**Recomendacao de arquitetura:** nao prosseguir com o redesenho completo do papel `responsavel` como estava decidido. Manter `0020` como o mecanismo de vinculo (ja resolve o achado mais caro, com fracao do risco) e **reduzir o escopo do item 6** a apenas o que `0020` deixa aberto:

1. **Consentimento (achado 4.2, ainda critico — risco de conformidade, nao so de produto):** persistir `titular` e `consentimento_versao`/`consentimento_aceito_em` em `perfis` no momento do signup, independente de existir ou nao papel `responsavel` novo. Nao depende do enum.
2. **Multiplos filhos por conta (achado 4.3):** registrar como decisao adiada, nao como bloqueador — nem o desenho antigo nem o `0020` resolvem isso; se vier a ser priorizado, a solucao correta e uma tabela de vinculo N:N (`responsaveis_alunos`) em vez de sobrecarregar `alunos.perfil_id`, o que tambem tornaria o enum `responsavel` desnecessario (a distincao vira "tem `alunos` vinculados" em vez de um papel proprio).
3. O enum `papel` **so** precisa ganhar `'responsavel'` se a escola tiver uma necessidade concreta de tratar responsavel e aluno-adolescente-autocadastrado com permissoes diferentes no futuro — hoje nenhum dos 6 documentos registra essa necessidade (a propria decisao original dizia "acesso a features permanece identico ao que aluno ja tem"). Sem diferenca de permissao a exercer, o enum novo so adiciona RLS para manter sem beneficio funcional. Fica fora do escopo priorizado.

Isso substitui os passos 2, 3, 5 e 6 do desenho original de `alunos-e-responsaveis.md` §5.1 (RLS `in ('aluno','responsavel')`, `AuthProvider`, remocao do fluxo de candidatos, `PAPEIS_VALIDOS`) — nenhum deles e mais necessario se o enum nao muda. Os passos 1 e 4 (que criavam o papel e reescreviam o signup) ficam reduzidos so a persistencia de consentimento, sem o enum novo.

## 4. Plano tecnico por fase (revisao de `plano-de-execucao.md` a luz das secoes 1-3)

### Fase 0 — Consolidar o que ja esta no working tree (nova, nao existia no plano anterior)

**Status em 2026-09-20: schema aplicado em producao.** O achado da secao 1.1 mudou o tamanho real desta fase — nao eram so `0017`-`0020` faltando, era a cadeia inteira. Executado nesta data:

- [x] Rodadas em ordem, no SQL Editor de producao, as 21 migrations (`0001_schema.sql` ate `0021_perfil_dono_nao_auto_gerencia.sql`) — banco que nunca tinha sido populado agora tem o schema completo.
- [x] Bootstrap do primeiro `dono`: como `cria_perfil_novo_usuario()` sempre cria conta nova como `papel = 'aluno'` (nao ha caminho de app para o primeiro admin), a conta inicial foi criada por autocadastro publico e promovida manualmente via `update perfis set papel = 'dono' where id = (...)`. Documentado aqui porque nao existia em nenhum dos 6 documentos de produto nem em `plano-de-execucao.md` — e um passo de bootstrap **especifico de projeto novo/recriado**, nao um item de backlog recorrente.

Pendente, ainda dentro da Fase 0:

- [x] Commit `4b73760` (2026-09-20): migrations `0017`-`0021`, telas correspondentes (`chamada/agendar.tsx`, `modulos.tsx`, `nova-teste.tsx`, `usuarios/`, `chamada/novo-evento.tsx`, `src/features/chamada/api.ts`) e o restante do working tree que dependia delas (`AuthProvider.tsx`, `alunos/api.ts`, `QuickMenu.tsx`, componentes `Chip`/`Dropdown`, hook `useAsyncData`, etc. — tudo validado com `tsc --noEmit` e a suite completa de testes, 15 suites/123 testes, antes do commit). `.expo/` (cache local) adicionado ao `.gitignore` e excluido do commit.
- [x] Deploy das Edge Functions `convidar-usuario` e `convidar-aluno` — confirmado em 2026-09-20.
- [x] `.env` local apontando para o mesmo projeto Supabase que recebeu as migrations — confirmado em 2026-09-20.
- [ ] Atualizar os 6 documentos de produto para nao descrever esses fluxos como "ja existentes" de forma ambigua — sao implementacoes deste ciclo, agora tambem aplicadas, mas ainda sem uso real registrado (banco recem-populado, sem dados).

**Fase 0 fechada** (2026-09-20), com excecao do item de manutencao de documentacao acima, que nao bloqueia nada tecnico. Base de producao esta consistente com o codigo commitado em `4b73760`.

### Fase 1 — Correcoes pequenas e isoladas (revisao do plano original)

Sem mudanca de escopo, so renumeracao de migration:

| Item | Migration |
|---|---|
| RLS: dono nao altera a propria linha (§2.1) | `0021_perfil_dono_nao_auto_gerencia.sql` |
| Guarda em `novo-evento.tsx` (§2.2) | sem migration, so mudanca de tela |
| Tratar `23505` em `getOuCriaAula` (§2.4) | sem migration, so mudanca de `src/features/chamada/api.ts` |

### Fase 2 — Chamada respeita "Meus modulos" (revisao do plano original, ver §2.3)

**Status: fechada em 2026-09-20** — migration `0022_presenca_respeita_meus_modulos.sql` aplicada em producao, filtro de UI em `lista.tsx`/`index.tsx` e testes novos implementados, sem a migration de backfill originalmente prevista (ver §2.3 para o motivo). Falta so o commit e avisar a equipe que professores precisam confirmar "Meus modulos" antes de fazer a primeira chamada.

### Fase 3 — Consentimento formal no signup (escopo reduzido, ver secao 3)

**Status: fechada em 2026-09-20**, exatamente no escopo reduzido da secao 3 — sem mudanca de enum, RLS adicional, ou remocao do fluxo de candidatos nao vinculados (esses continuam existindo para o caso residual de `titular === 'proprio'`, coberto so parcialmente por `0020`).

1. Migration `0023_consentimento_signup.sql`: colunas `titular`, `consentimento_versao`, `consentimento_aceito_em` em `perfis` (nulas — convite via `convidar-usuario`/`convidar-aluno` nao passa pela tela de consentimento, so autocadastro publico preenche). `cria_perfil_novo_usuario()` (`0001`, ja reescrita em `0017`/`0020`) atualizada mais uma vez pra ler `titular`/`consentimento_versao` de `raw_user_meta_data` e gravar `consentimento_aceito_em = now()` na mesma insercao — sem passo separado de "salvar depois".
2. `AuthProvider.signUp()` ganhou dois parametros novos (`titular: Titular`, `consentimentoVersao: string`) — tipo `Titular` agora exportado de `AuthProvider.tsx` (mesmo padrao de `Papel`), `signup.tsx` importa em vez de declarar localmente. `supabase.auth.signUp` passa `titular`/`consentimento_versao` em `options.data`.
3. `signup.tsx`: nova constante `CONSENTIMENTO_VERSAO = '2026-09-20'` (versao do texto `CONSENTIMENTO`, ja existente) passada pro `signUp()`.
4. Testes atualizados/novos: `AuthProvider.test.tsx` (metadata inclui `titular`/`consentimento_versao`), `signup.test.tsx` (novo caso cobrindo `titular === 'responsavel'`).

### Fase 4 — Migracao Minha Evolucao <- Desempenho (sem mudanca de escopo, detalhamento tecnico abaixo)

Ordem de `evolucao-vs-desempenho.md` §5.2, com desenho tecnico por passo:

1. **Tela/fluxo de atribuicao de metodologia** — **fechado em 2026-09-20.** Migration `0024_atribuir_metodologia_aluno.sql`: RPC `atribuir_metodologia_aluno(p_aluno_id, p_metodologia_id, p_nivel_id, p_data_inicio)`, **dono-only** (nao `security definer` — respeita a RLS existente `aluno_metodologia_escrita`, ja restrita a dono desde `0007`; decisao de manter assim, nao abrir pra professor, registrada como julgamento de arquitetura nesta sessao, revisitavel). Novo bloco em `EvolucaoScreen.tsx`, visivel só pra staff quando `!metodologiaAtual`: escolhe metodologia (se houver mais de uma ativa) e nivel via chips, chama a RPC, recarrega. Novas funcoes `getMetodologiasAtivas`/`atribuirMetodologiaAluno` em `src/features/evolucao/api.ts`. **Sem teste de componente novo** (`EvolucaoScreen.tsx` tem 800+ linhas sem nenhum teste dedicado ainda — gap preexistente, nao introduzido agora, mas tambem nao fechado).
2. **Trigger de "nivel conquistado" -> `alunos.modulo`** — **fechado em 2026-09-20, com escopo maior do que o previsto originalmente.** Confirmado que `historico_nivel_evolucao.tipo` usa `'promovido'` (nao `'nivel_conquistado'` — `EvolucaoScreen.tsx` ja usava o valor certo em `labelTipoHistorico`), e que nao existia nenhum caminho de escrita pra essa tabela (so leitura). Migration `0025_registrar_promocao_nivel.sql` entrega as duas partes: RPC `registrar_promocao_nivel(p_aluno_id, p_nivel_id, ...)` (`eh_equipe()`, nao security definer — mesmo padrao de `registrar_avaliacao_evolucao`, valida que o nivel pertence a metodologia ativa do aluno) e o trigger `aplica_promocao_nivel_evolucao` (**security definer** — necessario porque `aluno_metodologias` so aceita escrita direta de `dono`, e quem dispara o evento pode ser professor; mesmo padrao ja usado em `audita_avaliacoes_evolucao`/`sincroniza_status_habilidade_aluno`, `0013`), que atualiza `aluno_metodologias.nivel_atual_id` e `alunos.modulo` (mesma correspondencia ordem-de-nivel -> modulo ja usada no backfill de `0009`). UI: novo bloco em `EvolucaoScreen.tsx`, visivel pra staff quando o aluno tem metodologia ativa, com chips dos niveis restantes da mesma metodologia. `aplica_teste_nivel` legado **continua ligado** — desliga-lo e decisao separada, so depois de validar este caminho em uso real (nao feito nesta sessao).
3. **Remover secao inline de Desempenho** de `alunos/[id]/index.tsx` (staff passa a usar so `evolucao.tsx`) — nao iniciado.
4. **Repropositar `alunos/[id]/desempenho.tsx`** como tela de Jornada: query sobre `historico_nivel_evolucao` + `avaliacoes_evolucao` ordenada por data, timeline completa (a secao "Historico" atual de `EvolucaoScreen` so mostra os ultimos 5 eventos) — nao iniciado.
5. **Radar chart** em `EvolucaoScreen`: substituir a lista de barras horizontais por um componente de radar (5-7 eixos = categorias elegiveis do nivel atual), mesma fonte de dado (`percentual` por categoria) ja calculada — nao iniciado.

Dados legados (`avaliacoes_desempenho`, `testes_nivel`) nao sao apagados — viram historico read-only, consistente com a Fase 5 do documento de visao original (`docs/minha-evolucao.md`).

### Itens aditivos — sem bloqueio de fase

- **Feriados** (`eventos.md` §5.1): documentar `EXPO_PUBLIC_FERIADOS_API_KEY` em `.env.example`, botao de importacao staff-only em `eventos/index.tsx`, deduplicacao por `tipo_id`+`titulo`+`data_inicio` via `getEventosPorPeriodo`, tratamento de `ConfiguracaoFeriadosError`.
- **Professor como aluno** (`professor-como-aluno.md` §4, decisao fechada em 2026-09-20): trocar a condicao de carregar `meuAluno` em `AuthProvider.tsx:139` de `meuPapel === 'aluno'` para "existe `alunos` vinculado", independente de papel; trocar `souAluno` por `!!meuAluno` em `QuickMenu.tsx:79` e `app/(app)/index.tsx`; trocar a guarda de `app/(app)/minha-evolucao.tsx:19` de `meuPapel !== 'aluno'` para `!meuAluno`; adicionar trava de autoavaliacao em `registrar_avaliacao_evolucao` (nova migration, `raise exception` quando `p_aluno_id` aponta pro proprio `auth.uid()`); atualizar `getPerfisNaoVinculados()` (`src/features/alunos/api.ts:78`) para nao filtrar por `papel = 'aluno'`.

## 5. Riscos tecnicos transversais (nao amarrados a nenhum item especifico)

- **Sem ambiente de staging** (`plano-de-execucao.md` §2, ainda verdadeiro: nao existe `supabase/config.toml`). Toda migration desta lista, sem excecao, precisa do passo de `select` de verificacao antes de aplicar em producao. **Materializado em 2026-09-20:** a ausencia de staging (e de qualquer registro de "o que ja foi aplicado onde") foi exatamente o que permitiu o achado da secao 1.1 passar despercebido ate a tentativa de aplicar `0018` — sem um `supabase/config.toml`/CLI versionando o estado do banco, nao ha como saber o que esta aplicado em producao sem consultar `information_schema` diretamente. Recomendacao adicional decorrente: apos a Fase 0, rodar `supabase link` + `supabase db pull` (ou equivalente) para o projeto passar a ter um registro de estado de migration versionado, em vez de depender de memoria/documentacao para saber o que ja foi aplicado.
- **Cobertura de teste baseline ~20-22%** (`README.md`): os fluxos com mais logica de negocio pura — `ocorre_na_data`/`horarios_livres_particular` (0019), `vincula_aluno_por_email` (0020), o calculo de progresso de Evolucao — sao os que mais se beneficiariam de teste dedicado antes de qualquer refatoracao em cima deles. Nenhum teste novo foi encontrado para as migrations 0017-0020 nem para as telas `agendar.tsx`/`modulos.tsx`/`nova-teste.tsx`.
- **Expo 57**: `AGENTS.md` na raiz do repo exige checar a documentacao versionada (`https://docs.expo.dev/versions/v57.0.0/`) antes de escrever qualquer codigo — relevante para a Fase 4 (radar chart pode exigir biblioteca de grafico compativel com Expo 57/RN 0.86.3, verificar antes de escolher dependencia).
- **Numeracao de migration**: a partir daqui, toda nova migration deste plano continua a sequencia numerica a partir de `0021` (a proxima livre apos as 4 ja presentes no working tree). Os numeros usados nas tabelas acima (`0021`-`0024`) sao sugestao de ordem, nao definitivos — dependem da Fase 0 (commit) acontecer primeiro sem outras migrations serem inseridas no meio.

## 6. Proximo passo

**Status em 2026-09-20:** Fase 0, Fase 1, Fase 2 e Fase 3 fechadas — schema aplicado em producao (`0001`-`0023`), bootstrap do `dono` feito, Edge Functions deployadas, `.env` conferido, RLS de "Meus modulos" em vigor, consentimento persistido no signup. Unico residual sem bloqueio tecnico e o item de manutencao de documentacao da Fase 0. Ordem recomendada daqui pra frente: commit da Fase 3 -> Fase 4 (migracao Evolucao <- Desempenho, o maior item restante) -> item aditivo de feriados (pode entrar em paralelo a qualquer momento).

A decisao da secao 3 (nao expandir para papel `responsavel` completo) e a unica divergencia deste documento em relacao a uma decisao ja registrada anteriormente — se voce quiser manter o desenho original de `alunos-e-responsaveis.md` mesmo com `0020` ja resolvendo o sintoma principal, essa parte do plano muda; o resto (Fases 0, 1, 2, 4 e o item de feriados) nao depende dessa escolha.
