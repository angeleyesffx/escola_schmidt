# Eventos de Calendario

Quinto e ultimo documento da rodada inicial. Modulo pequeno: sobreposicao informativa no calendario (feriados, competicoes, reunioes) — nao interfere em frequencia, contratos ou avaliacao. Depende de [papeis-e-permissoes.md](./papeis-e-permissoes.md), que ja registrou e decidiu o achado de permissao desta area.

## 1. Visao geral

Duas tabelas simples (`tipos_evento`, `eventos_calendario`, `supabase/migrations/0003_eventos_calendario.sql`): um evento tem tipo (cor + nome, ex. feriado/competicao/reuniao), titulo, intervalo de datas e descricao opcional. Aparece como marcacao colorida na Agenda (`chamada/index.tsx`) e tem suas proprias telas de lista/detalhe em `app/(app)/eventos/`.

## 2. Papeis e permissao

RLS (`supabase/migrations/0003_eventos_calendario.sql:47-55`): leitura liberada para qualquer usuario autenticado (`auth.uid() is not null`); escrita (criar/editar/excluir, tanto em `tipos_evento` quanto em `eventos_calendario`) restrita a `eh_equipe()` (`dono` ou `professor`).

| Acao | dono | professor | aluno/responsavel |
|---|---|---|---|
| Ver eventos na Agenda e na lista | sim | sim | sim |
| Criar/editar/excluir evento | sim | sim | nao (RLS bloqueia mesmo que a UI permita abrir o formulario) |
| Criar/editar tipo de evento (cor/nome) | sim | sim | nao |

**Achado ja registrado e decidido em `papeis-e-permissoes.md` (secao 2.3):** `chamada/novo-evento.tsx` nao le `meuPapel`, diferente de toda tela irma do modulo de Chamada. A RLS ja impede a escrita por aluno/responsavel (confirmado acima), entao nao ha risco de dado incorreto — mas um aluno que abrir a tela por link direto veria o formulario e so levaria um erro ao tentar salvar, em vez de ser redirecionado como em qualquer outra tela do app. Correcao ja esta no backlog daquele documento; nao repito aqui.

## 3. Casos de uso

### UC-01 — Staff cria ou edita um evento

- **Pre-condicoes:** staff autenticado.
- **Fluxo principal:** Eventos -> "+ Evento" (ou Editar num evento existente) -> escolhe tipo (cor), titulo, intervalo de datas (`DateRangePicker`), descricao opcional -> salva em `eventos_calendario`.
- **Pos-condicoes:** evento aparece imediatamente na Agenda para todos os papeis (leitura liberada a qualquer autenticado).

### UC-02 — Staff exclui um evento

- **Pre-condicoes:** staff autenticado, evento existente.
- **Fluxo principal:** tela de detalhe do evento (`eventos/[id].tsx`) -> Excluir -> confirmacao -> remove de `eventos_calendario`.

### UC-03 — Qualquer usuario visualiza eventos

- **Pre-condicoes:** usuario autenticado (qualquer papel).
- **Fluxo principal:** Agenda mostra marcacoes coloridas por tipo nos dias com evento; lista de Eventos mostra por mes com legenda de cores; toque abre o detalhe (sem opcoes de edicao para quem nao e staff).

## 4. Problemas confirmados no codigo

### 4.1 Feature morta: importacao automatica de feriados

`src/features/eventos/feriados.ts` (29 linhas) implementa `buscarFeriadosEstado(uf, ano)`, que chamaria a API publica `feriadosapi.com` usando uma chave lida de `process.env.EXPO_PUBLIC_FERIADOS_API_KEY`. Confirmado por busca em todo o repositorio: **nenhuma tela ou funcao chama essa funcao** — ela nao e importada em lugar nenhum fora do proprio arquivo. A variavel de ambiente tambem **nao aparece em `.env.example`** (que so lista `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`), entao mesmo que alguem tentasse ligar essa funcao, faltaria saber que a variavel existe e onde consegui-la.

Isso parece um recurso planejado (importar feriados automaticamente para o calendario, evitando cadastro manual um a um) que foi implementado ate a chamada de API mas nunca teve a tela/botao que o dispara.

## 5. Decisao registrada (2026-09-19)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Importacao automatica de feriados (achado 4.1) | **Terminar a feature** |

### 5.1 Desenho decorrente (para a fase de implementacao)

- Documentar `EXPO_PUBLIC_FERIADOS_API_KEY` em `.env.example`, com comentario indicando que a chave e gratuita em feriadosapi.com.
- Novo botao em `eventos/index.tsx` (staff-only, mesma guarda que ja existe para "+ Evento"): "Importar feriados de [ano selecionado]".
- Fluxo: chama `buscarFeriadosEstado(uf, ano)` (`src/features/eventos/feriados.ts:13`) -> para cada feriado retornado, usa o `tipo_id` do tipo "Feriado" (ja existe no seed de `tipos_evento`, `supabase/migrations/0003_eventos_calendario.sql:19`) -> chama `criarEvento(tipoId, nome, data, data, null, criadoPor)` (`src/features/eventos/api.ts`) para cada um, com `data_inicio = data_fim` (feriado e um dia so).
- Evitar duplicar em reimportacoes: antes de criar, checar se ja existe um evento com o mesmo `tipo_id` + `titulo` + `data_inicio` naquele periodo (nova funcao `getEventosPorPeriodo` ja existe e pode ser reaproveitada para essa checagem antes do import).
- Tratar `ConfiguracaoFeriadosError` (ja definida no arquivo) com uma mensagem amigavel pro dono/professor se a chave nao estiver configurada, em vez de um erro tecnico.
- `uf` (estado): a escola precisa de um lugar para configurar isso (nao ha campo de "estado da escola" hoje em nenhuma tabela) — solucao mais simples: pedir o UF no proprio momento de importar (um seletor de estado no modal de importacao), sem precisar de nova coluna de configuracao.

## 6. Backlog de implementacao gerado por este documento

Mais um item pronto para a fase de implementacao, junto aos dos documentos anteriores:

8. Terminar `src/features/eventos/feriados.ts`: variavel de ambiente documentada, botao de importacao em `eventos/index.tsx`, deduplicacao por tipo+titulo+data, tratamento de `ConfiguracaoFeriadosError`.

## 7. Fechamento da rodada inicial de documentacao

Confirmado: vou escrever `docs/product/usuarios-e-convites.md` para fechar a serie de 6 documentos por completo.
