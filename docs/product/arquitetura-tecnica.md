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

**Parcialmente aberto — metade da base ja existe.** `0018` ja da ao professor autogestao de `professores_aula` (pre-requisito operacional para o backfill funcionar sem o dono precisar atribuir tudo manualmente). Mas a policy de fato bloqueante, `presenca_escrita` (`supabase/migrations/0001_schema.sql:267-268`), continua `using (eh_equipe()) with check (eh_equipe())` — qualquer professor ainda faz chamada de qualquer turma. O desenho de `plano-de-execucao.md` Fase 2 (backfill de `professores_aula` a partir de `aulas_recorrentes.professor_id`, depois trocar a policy para exigir o vinculo) continua valido como esta. Unico ajuste: como `0018` ja deu ao professor o direito de se auto-atribuir, o backfill pode ser complementado por um convite na propria UI ("Meus modulos" ja existe em `chamada/modulos.tsx`) pedindo que cada professor confirme seus modulos **antes** de apertar a RLS — reduz o risco operacional descrito no `plano-de-execucao.md` §2.

### 2.4 Item 4 — Tratar `23505` em `getOuCriaAula`

**Resolvido em 2026-09-20.** `src/features/chamada/api.ts` agora captura `erroInsert.code === '23505'` na corrida de criacao e refaz o `select`, reaproveitando a aula que o outro staff criou, em vez de propagar o erro cru. Ainda sem commit.

### 2.5 Item 5 — Migracao Minha Evolucao <- Desempenho

**Nao iniciado.** Nenhum arquivo tocado corresponde a essa migracao (nem tabela `aluno_metodologias` com trigger de escrita, nem tela de Jornada, nem radar chart). Plano de `evolucao-vs-desempenho.md` §5.2 continua o desenho valido — ver secao 4.4 deste documento para o detalhamento tecnico por passo.

### 2.6 Item 6 — Papel `responsavel` + signup unificado + consentimento persistido

**Parcialmente superado por `0020`, com desenho diferente do decidido.** Ver secao 3 — decisao arquitetural que precisa ser re-tomada antes de qualquer implementacao aqui, porque o codigo ja andou num caminho que os documentos anteriores nao prev(iam.

### 2.7 Item 7 — Concluir importacao automatica de feriados

**Nao iniciado.** `buscarFeriadosEstado` (`src/features/eventos/feriados.ts:13`) continua sem nenhuma chamada fora do proprio arquivo. Desenho de `eventos.md` §5.1 continua valido.

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

- [ ] Commit das migrations `0017`-`0021` e das telas correspondentes (`chamada/agendar.tsx`, `modulos.tsx`, `nova-teste.tsx`, `usuarios/`, `chamada/novo-evento.tsx`, `src/features/chamada/api.ts`) — nada disso foi commitado ainda, so aplicado/editado localmente.
- [ ] Deploy das Edge Functions `convidar-usuario` e `convidar-aluno` (`supabase functions deploy`) — SQL Editor nao instala codigo de function, so migration; nao ha confirmacao de que isso ja rodou.
- [ ] Conferir que `.env` local aponta para o mesmo projeto Supabase que recebeu as migrations (`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- [ ] Atualizar os 6 documentos de produto para nao descrever esses fluxos como "ja existentes" de forma ambigua — sao implementacoes deste ciclo, agora tambem aplicadas, mas ainda sem uso real registrado (banco recem-populado, sem dados).

### Fase 1 — Correcoes pequenas e isoladas (revisao do plano original)

Sem mudanca de escopo, so renumeracao de migration:

| Item | Migration |
|---|---|
| RLS: dono nao altera a propria linha (§2.1) | `0021_perfil_dono_nao_auto_gerencia.sql` |
| Guarda em `novo-evento.tsx` (§2.2) | sem migration, so mudanca de tela |
| Tratar `23505` em `getOuCriaAula` (§2.4) | sem migration, so mudanca de `src/features/chamada/api.ts` |

### Fase 2 — Chamada respeita "Meus modulos" (revisao do plano original, ver §2.3)

1. Migration `0022_backfill_professores_aula.sql`: para cada `aulas_recorrentes` ativo com `professor_id` preenchido, inserir em `professores_aula` (professor, slot, cada modulo do array) se ainda nao existir.
2. Comunicar aos professores para conferirem "Meus modulos" (`chamada/modulos.tsx`, ja existe) antes do corte.
3. Migration `0023_presenca_respeita_meus_modulos.sql`: trocar `presenca_escrita` para `professor` exigir `exists (select 1 from professores_aula pa where pa.professor_id = auth.uid() and pa.aula_recorrente_id = aulas.aula_recorrente_id)` via join com `aulas`, com `papel_atual() = 'dono'` como bypass total. Mesmo tratamento para a policy de `aula_escrita` do tipo regular.
4. UI: `chamada/lista.tsx` e os atalhos da Agenda filtram a lista de turmas do dia por `professores_aula` quando `meuPapel === 'professor'`.

### Fase 3 — Consentimento formal no signup (escopo reduzido, ver secao 3)

1. Migration `0024_consentimento_signup.sql`: colunas `titular`, `consentimento_versao`, `consentimento_aceito_em` em `perfis`.
2. `AuthProvider.signUp()` (`src/features/auth/AuthProvider.tsx:186`) passa a receber `titular` e a versao do texto de consentimento (constante `CONSENTIMENTO` ja existe em `signup.tsx`) e grava-los logo apos o `insert` de `perfis` (mesma transacao logica do trigger `cria_perfil_novo_usuario`, ou update imediato depois).
3. **Sem** mudanca de enum, RLS adicional, ou remocao do fluxo de candidatos nao vinculados — esses continuam existindo para o caso residual de conta autocadastrada sem `responsavel_email` preenchido em nenhum aluno (0020 so cobre o caso com e-mail casando).

### Fase 4 — Migracao Minha Evolucao <- Desempenho (sem mudanca de escopo, detalhamento tecnico abaixo)

Ordem de `evolucao-vs-desempenho.md` §5.2, com desenho tecnico por passo:

1. **Tela/fluxo de atribuicao de metodologia** (bloqueador de tudo o resto): nova funcao `atribuir_metodologia_aluno(p_aluno_id, p_metodologia_id, p_nivel_id)` (RPC `security definer`, staff-only via RLS/`eh_equipe()`), chamada a partir de um novo bloco em `alunos/[id]/evolucao.tsx` quando `getMetodologiaAtualAluno` retorna vazio. Sem isso, todo aluno matriculado depois de `0009_minha_evolucao_seed.sql` fica preso no estado vazio permanentemente (achado 4.2 confirmado).
2. **Trigger de "nivel conquistado" -> `alunos.modulo`**: nova funcao equivalente a `aplica_teste_nivel` (`0002_desempenho.sql`), disparada por insercao em `historico_nivel_evolucao` com `tipo_evento = 'nivel_conquistado'`, atualizando `alunos.modulo` e a linha corrente de `aluno_metodologias`. So depois disso e seguro desligar `aplica_teste_nivel` legado.
3. **Remover secao inline de Desempenho** de `alunos/[id]/index.tsx` (staff passa a usar so `evolucao.tsx`).
4. **Repropositar `alunos/[id]/desempenho.tsx`** como tela de Jornada: query sobre `historico_nivel_evolucao` + `avaliacoes_evolucao` ordenada por data, timeline completa (a secao "Historico" atual de `EvolucaoScreen` so mostra os ultimos 5 eventos).
5. **Radar chart** em `EvolucaoScreen`: substituir a lista de barras horizontais por um componente de radar (5-7 eixos = categorias elegiveis do nivel atual), mesma fonte de dado (`percentual` por categoria) ja calculada.

Dados legados (`avaliacoes_desempenho`, `testes_nivel`) nao sao apagados — viram historico read-only, consistente com a Fase 5 do documento de visao original (`docs/minha-evolucao.md`).

### Itens aditivos — sem bloqueio de fase

- **Feriados** (`eventos.md` §5.1): documentar `EXPO_PUBLIC_FERIADOS_API_KEY` em `.env.example`, botao de importacao staff-only em `eventos/index.tsx`, deduplicacao por `tipo_id`+`titulo`+`data_inicio` via `getEventosPorPeriodo`, tratamento de `ConfiguracaoFeriadosError`.

## 5. Riscos tecnicos transversais (nao amarrados a nenhum item especifico)

- **Sem ambiente de staging** (`plano-de-execucao.md` §2, ainda verdadeiro: nao existe `supabase/config.toml`). Toda migration desta lista, sem excecao, precisa do passo de `select` de verificacao antes de aplicar em producao. **Materializado em 2026-09-20:** a ausencia de staging (e de qualquer registro de "o que ja foi aplicado onde") foi exatamente o que permitiu o achado da secao 1.1 passar despercebido ate a tentativa de aplicar `0018` — sem um `supabase/config.toml`/CLI versionando o estado do banco, nao ha como saber o que esta aplicado em producao sem consultar `information_schema` diretamente. Recomendacao adicional decorrente: apos a Fase 0, rodar `supabase link` + `supabase db pull` (ou equivalente) para o projeto passar a ter um registro de estado de migration versionado, em vez de depender de memoria/documentacao para saber o que ja foi aplicado.
- **Cobertura de teste baseline ~20-22%** (`README.md`): os fluxos com mais logica de negocio pura — `ocorre_na_data`/`horarios_livres_particular` (0019), `vincula_aluno_por_email` (0020), o calculo de progresso de Evolucao — sao os que mais se beneficiariam de teste dedicado antes de qualquer refatoracao em cima deles. Nenhum teste novo foi encontrado para as migrations 0017-0020 nem para as telas `agendar.tsx`/`modulos.tsx`/`nova-teste.tsx`.
- **Expo 57**: `AGENTS.md` na raiz do repo exige checar a documentacao versionada (`https://docs.expo.dev/versions/v57.0.0/`) antes de escrever qualquer codigo — relevante para a Fase 4 (radar chart pode exigir biblioteca de grafico compativel com Expo 57/RN 0.86.3, verificar antes de escolher dependencia).
- **Numeracao de migration**: a partir daqui, toda nova migration deste plano continua a sequencia numerica a partir de `0021` (a proxima livre apos as 4 ja presentes no working tree). Os numeros usados nas tabelas acima (`0021`-`0024`) sao sugestao de ordem, nao definitivos — dependem da Fase 0 (commit) acontecer primeiro sem outras migrations serem inseridas no meio.

## 6. Proximo passo

**Status em 2026-09-20:** Fase 0 (schema aplicado + bootstrap) e Fase 1 (itens 1, 2 e 4) estao com o trabalho tecnico feito, pendente so de commit e dos passos remanescentes da Fase 0 (deploy das Edge Functions, conferencia de `.env`, atualizacao dos 6 documentos de produto). Ordem recomendada daqui pra frente: fechar os pendentes de Fase 0 -> commit -> Fase 2 (RLS de "Meus modulos" em `presencas`, precisa de backfill antes) -> Fase 3 (escopo reduzido) -> Fase 4, com o item aditivo de feriados podendo entrar em paralelo a qualquer momento.

A decisao da secao 3 (nao expandir para papel `responsavel` completo) e a unica divergencia deste documento em relacao a uma decisao ja registrada anteriormente — se voce quiser manter o desenho original de `alunos-e-responsaveis.md` mesmo com `0020` ja resolvendo o sintoma principal, essa parte do plano muda; o resto (Fases 0, 1, 2, 4 e o item de feriados) nao depende dessa escolha.
