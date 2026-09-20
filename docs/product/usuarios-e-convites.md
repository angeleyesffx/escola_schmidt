# Usuarios e Convites

Sexto e ultimo documento da rodada inicial. A maior parte da analise de permissao deste modulo ja foi feita e decidida em [papeis-e-permissoes.md](./papeis-e-permissoes.md) (secao 2.1) — este documento cobre os casos de uso e detalhes que aquele nao aprofundou, sem repetir o que ja esta resolvido.

## 1. Visao geral

Modulo de gestao de contas de staff (`dono`/`professor`) e canal de convite tambem para contas `aluno` avulsas (sem vinculo a um registro `alunos` — o convite vinculado a um aluno especifico e tratado pela function irma `convidar-aluno`, coberta em [alunos-e-responsaveis.md](./alunos-e-responsaveis.md)). Trelas em `app/(app)/usuarios/`, dados em `src/features/usuarios/api.ts`, criacao de conta via Edge Function `convidar-usuario` (precisa de `service_role`, por isso nao e um RPC comum).

## 2. Papeis e permissao

Ja detalhado e decidido em `papeis-e-permissoes.md` secao 2.1 — resumo:

| Acao | dono | professor | aluno |
|---|---|---|---|
| Ver lista de todos os usuarios | sim | nao | nao |
| Convidar novo usuario | sim, qualquer papel | sim, exceto `dono` | nao |
| Alterar papel/status de usuario existente | sim (exceto a propria conta, apos correcao ja decidida) | nao | nao |

## 3. Casos de uso

### UC-01 — Dono convida um novo usuario (staff ou aluno avulso)

- **Pre-condicoes:** `dono` autenticado.
- **Fluxo principal:** `usuarios/novo.tsx` -> nome, email, papel (dono/professor/aluno) -> Edge Function `convidar-usuario` valida o chamador, cria a conta via `auth.admin.inviteUserByEmail` (redireciona para `escolaschmidt://reset-password` para o convidado definir a propria senha) e corrige o `papel` da linha que o trigger padrao ja criou como `aluno`.
- **Pos-condicoes:** nova linha em `perfis` com o papel escolhido; convidado recebe email para definir senha.

### UC-02 — Professor convida um novo usuario (staff ou aluno avulso, exceto dono)

- **Pre-condicoes:** `professor` autenticado.
- **Fluxo principal:** identico ao UC-01, mas a lista de papeis disponiveis na tela ja exclui "Dono" (`papeisDisponiveis` filtrado em `novo.tsx`), e a Edge Function reforca a mesma regra no servidor (`if (perfilChamador.papel === 'professor' && papel === 'dono') return 403`).
- **Fluxos alternativos:** se por algum bug o client mandasse `papel: 'dono'` mesmo assim, a Edge Function bloqueia — a regra nao depende so da UI.

### UC-03 — Dono altera o papel ou status de um usuario existente

- **Pre-condicoes:** `dono` autenticado, abrindo `usuarios/[id].tsx` de outro usuario.
- **Fluxo principal:** troca o papel (chips) ou ativa/desativa (chips) — grava direto em `perfis` (`atualizarPapel`/`atualizarAtivo`), sem passar por Edge Function, protegido so pela RLS `perfil_dono_gerencia`.
- **Fluxo alternativo — tentativa de editar a propria conta:** bloqueado na UI (`editandoSiMesmo`); apos a correcao ja decidida em `papeis-e-permissoes.md`, tambem sera bloqueado na RLS.

## 4. Problemas confirmados no codigo

### 4.1 Duplicacao entre `convidar-usuario` e `convidar-aluno`

As duas Edge Functions (`supabase/functions/convidar-usuario/index.ts`, `supabase/functions/convidar-aluno/index.ts`) repetem quase o mesmo esqueleto: validar JWT do chamador, checar `papel in ('dono','professor')`, criar cliente `service_role`, chamar `inviteUserByEmail`. Nao e um bug, e uma oportunidade de reuso (ex.: extrair a validacao do chamador para um modulo compartilhado) — baixa prioridade, cosmetico.

### 4.2 Nenhuma visibilidade de convites enviados

Ja registrado em `papeis-e-permissoes.md` (decisao 4 daquele documento): um professor que erra um convite (email/papel errado) nao tem como saber que precisa pedir correcao ao dono, porque nao ha nenhuma lista de "convites que eu enviei" nem status (pendente/aceito). Nao repito a analise aqui, so sinalizo a dependencia.

### 4.3 Dependencia com a decisao do papel `responsavel`

A lista `PAPEIS_VALIDOS = ['dono', 'professor', 'aluno']`, tanto na Edge Function (`convidar-usuario/index.ts:10`) quanto no filtro de chips em `usuarios/novo.tsx`, vai precisar incluir `'responsavel'` quando a decisao registrada em [alunos-e-responsaveis.md](./alunos-e-responsaveis.md) for implementada — para o caso de um staff precisar convidar manualmente um responsavel que nao passou pelo autocadastro publico.

## 5. Decisao registrada (2026-09-19)

| # | Pergunta | Decisao |
|---|---|---|
| 1 | Visibilidade de convites enviados (achado 4.2) | **Registrar sem compromisso de prioridade.** Fica documentada como melhoria conhecida, fora do backlog priorizado do `plano-de-execucao.md` por enquanto — revisitar se o problema aparecer na pratica (ex.: se convites errados comecarem a gerar retrabalho real para o dono) |

## 6. Melhoria conhecida, sem prioridade atribuida

Nao entra no backlog priorizado, mas o desenho ja fica registrado para quando/se for revisitada:

- Tela/secao "Meus convites" para `professor`: lista os convites que ele mesmo enviou (precisa de uma coluna `convidado_por` em `perfis`, que hoje nao existe — nem `criado_em` diferencia quem convidou de quem se autocadastrou) com status (pendente = ainda nao logou, aceito = ja tem `criado_em` de sessao ou equivalente).

## 7. Fechamento da rodada inicial de documentacao

Com este documento, a serie de 6 planejada em [papeis-e-permissoes.md](./papeis-e-permissoes.md) esta completa:

1. [Papeis e Permissoes](./papeis-e-permissoes.md)
2. [Chamada, Agenda e Frequencia](./chamada-agenda-frequencia.md)
3. [Minha Evolucao vs Desempenho](./evolucao-vs-desempenho.md)
4. [Alunos e Responsaveis](./alunos-e-responsaveis.md)
5. [Eventos de Calendario](./eventos.md)
6. Este documento

### Backlog consolidado (todas as decisoes ja fechadas, por documento de origem)

| # | Item | Origem | Porte |
|---|---|---|---|
| 1 | RLS: dono nao pode alterar a propria linha em `perfis` | Papeis e Permissoes | Pequeno |
| 2 | Guarda de papel em `chamada/novo-evento.tsx` | Papeis e Permissoes | Pequeno |
| 3 | RLS: chamada regular respeita "Meus modulos" (exceto dono) | Chamada/Agenda | Medio |
| 4 | Tratar `23505` em `getOuCriaAula` | Chamada/Agenda | Pequeno |
| 5 | Migracao Evolucao <- Desempenho (5 passos, ver `evolucao-vs-desempenho.md` secao 5.2) | Evolucao vs Desempenho | Grande |
| 6 | Papel `responsavel` + signup unificado + consentimento persistido (ver `alunos-e-responsaveis.md` secao 6) | Alunos e Responsaveis | Grande |
| 7 | Concluir importacao automatica de feriados | Eventos | Medio |
Nao vou comecar a implementar nenhum item sem sua autorizacao explicita para entrar na fase de codigo — essa foi a combinacao inicial deste processo.

**Atualizacao (2026-09-19):** o sequenciamento final dos 7 itens acima (o item "Meus convites" foi registrado sem compromisso de prioridade, ver secao 6) esta em [plano-de-execucao.md](./plano-de-execucao.md), organizado em 4 fases por risco e dependencia.
