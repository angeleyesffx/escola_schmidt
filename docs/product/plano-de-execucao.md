# Plano de Execucao

Consolida os itens de backlog gerados pelos documentos de produto em `docs/product/` num sequenciamento unico, priorizado por risco e dependencia. Nenhum item aqui e novo — cada um ja tem decisao de produto fechada e desenho tecnico no documento de origem (linkado em cada secao). Este documento so ordena a execucao; nao substitui os anteriores.

**Nota de atualizacao:** [arquitetura-tecnica.md](./arquitetura-tecnica.md) reauditou as Fases 0-3 abaixo contra o estado real do repositorio em 2026-09-20 (varias ja foram implementadas e aplicadas em producao, e a Fase 3 teve escopo reduzido — o papel `responsavel` formal deixou de ser necessario porque `0020_auto_vincula_aluno_por_email.sql` ja resolve o mesmo problema por um caminho mais barato). Para status de implementacao, aquele documento e a fonte da verdade; este documento continua valido como registro do sequenciamento e da logica de priorizacao original.

## 1. Criterios de priorizacao

Ordem de fase decidida por, nesta ordem de peso:

1. **Risco de bloqueio acidental primeiro que risco de feature faltando** — corrigir algo que pode travar a operacao da escola (ex.: lockout de dono) vem antes de adicionar algo que so falta.
2. **Isolamento antes de itens que mexem em RLS amplamente** — os itens pequenos e isolados (sem redesenho de schema) vao primeiro, para entregar valor rapido e validar o processo de deploy antes das mudancas maiores.
3. **Mudancas estruturais grandes cada uma em sua propria fase**, nunca combinadas no mesmo deploy — os itens 6 (papel `responsavel`) e 3 (RLS de "Meus modulos") mexem em RLS de tabelas parcialmente sobrepostas (`presencas`, `pedidos_presenca`); fazer as duas juntas dificultaria isolar a causa se algo quebrar.
4. **Itens aditivos (nao mexem em permissao de nada que ja funciona) podem entrar em qualquer momento** — ficam marcados como "sem bloqueio de fase" e podem ser intercalados conforme capacidade.

## 2. Observacao operacional importante antes de comecar

Confirmado no repositorio: nao existe `supabase/config.toml` (projeto Supabase local nao inicializado com a CLI) e os comentarios em todas as migrations dizem "Rodar em: Supabase > SQL Editor" — ou seja, **toda migration hoje e aplicada manualmente, direto no projeto de producao, sem ambiente de staging**. Isso nao e um problema dos itens abaixo, mas afeta como executa-los com seguranca:

- **Recomendacao:** antes de rodar qualquer migration nova (itens 1, 3, 5, 6, 8 abaixo mexem em schema/RLS) no SQL Editor de producao, rodar `select` de verificacao primeiro (ex.: contar quantas linhas seriam afetadas por uma mudanca de RLS) e manter a instrucao de rollback (`drop policy` / recriar a policy anterior) escrita e pronta antes de aplicar a nova.
- Isso vale especialmente para o item 3 (ver Fase 2), que se aplicado sem o passo de backfill descrito ali pode bloquear professores de fazer chamada de turmas que sempre deram.

## 3. Fase 1 — Correcoes pequenas e isoladas (sem decisao em aberto, sem redesenho de schema)

Podem ser feitas juntas, numa unica sessao/PR pequena. Baixo risco: nenhuma remove acesso que dependa de dado ainda nao existente.

| Item | Origem | O que muda |
|---|---|---|
| RLS: `dono` nao pode alterar a propria linha em `perfis` | [papeis-e-permissoes.md](./papeis-e-permissoes.md) §2.1 | Ajustar policy `perfil_dono_gerencia` para excluir `id = auth.uid()` |
| Guarda de papel em `chamada/novo-evento.tsx` | [papeis-e-permissoes.md](./papeis-e-permissoes.md) §2.3 | Adicionar redirect igual as telas irmas |
| Tratar `23505` em `getOuCriaAula` | [chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md) §4.1 | Capturar violacao de unicidade e refazer o `select` |

**Verificacao sugerida:** testar manualmente cada um dos 3 cenarios (dono tentando se auto-rebaixar, aluno abrindo a URL de novo-evento diretamente, dois toques quase simultaneos abrindo a mesma chamada nova) apos o deploy.

## 4. Fase 2 — Chamada respeita "Meus modulos" (exceto dono)

[chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md) §2, §5-6. Risco medio: e uma restricao de acesso que, se aplicada sem cuidado, pode impedir um professor de fazer a chamada de uma turma que ele sempre deu, se essa turma nunca foi formalmente "assumida" por ele em `professores_aula`.

**Passo obrigatorio antes da mudanca de RLS:** a tabela `aulas_recorrentes` ja guarda um `professor_id` "responsavel" por slot desde o schema original. Rodar uma migration de backfill que cria, para cada slot ativo com `professor_id` preenchido, uma linha em `professores_aula` (professor, slot, cada modulo do array `modulos` daquele slot) que ainda nao exista — assim nenhum professor que ja da aula regularmente perde acesso no dia em que a restricao entra em vigor.

**Depois do backfill:**
1. Ajustar a RLS de escrita em `presencas` (e leitura/escrita de `aulas` do tipo regular) para `professor` exigir vinculo em `professores_aula` com o `aula_recorrente_id`; `papel_atual() = 'dono'` continua com bypass total.
2. UI: lista de turmas do dia em `chamada/lista.tsx` e nos atalhos da Agenda so mostra ao professor as turmas que ele tem em `professores_aula`.

**Verificacao sugerida:** antes de aplicar a RLS, rodar um `select` comparando `aulas_recorrentes.professor_id` contra `professores_aula` para conferir que o backfill cobriu 100% dos slots ativos.

## 5. Fase 3 — Papel `responsavel`, signup unificado e consentimento formal

[alunos-e-responsaveis.md](./alunos-e-responsaveis.md) §5-6. O maior item em superficie de mudanca (enum, RLS de varias tabelas, `AuthProvider`, formulario de signup) — isolar numa fase propria, sem combinar com a Fase 2 mesmo ambas mexendo em RLS, para poder isolar a causa caso algo quebre.

Ordem interna (ja definida no documento de origem, repetida aqui por completude):

1. Migration: `responsavel` no enum `papel`; colunas de consentimento em `perfis` (`titular`, `consentimento_versao`, `consentimento_aceito_em`).
2. Atualizar todas as RLS que testam `papel_atual() = 'aluno'` escopadas ao aluno vinculado, para `in ('aluno', 'responsavel')`.
3. Atualizar `AuthProvider` e as checagens de `meuPapel === 'aluno'` nas telas (QuickMenu, Perfil, Frequencia, Evolucao).
4. Reescrever `signup.tsx` + `AuthProvider.signUp`: capturar nome do filho quando `titular === 'responsavel'`, criar `perfis` + `alunos` vinculado numa mesma operacao, persistir consentimento nos dois caminhos.
5. Remover o fluxo de "candidatos nao vinculados" para o caminho de responsavel (mantendo so para `titular === 'proprio'`).
6. **Dependencia adicional identificada em [usuarios-e-convites.md](./usuarios-e-convites.md) §4.3:** atualizar `PAPEIS_VALIDOS` na Edge Function `convidar-usuario` e o filtro de chips em `usuarios/novo.tsx` para incluir `responsavel`, para o caso de staff precisar convidar manualmente um responsavel que nao passou pelo autocadastro.

**Verificacao sugerida:** percorrer manualmente, com uma conta de teste `responsavel`, todas as telas que hoje um `aluno` acessa (Perfil, Frequencia, Minha Evolucao, pedir presenca) confirmando paridade de acesso antes de liberar.

## 6. Fase 4 — Migracao Minha Evolucao ← Desempenho

[evolucao-vs-desempenho.md](./evolucao-vs-desempenho.md) §5.1-5.2. Ordem interna ja definida no documento de origem:

1. Tela/fluxo minimo para atribuir metodologia+nivel a um aluno (acabar com o bloqueio de adocao para alunos novos — achado 4.2 daquele documento).
2. Evento "nivel conquistado" passa a atualizar `alunos.modulo` e `aluno_metodologias` automaticamente (equivalente ao `aplica_teste_nivel` legado).
3. Remover a secao inline de Desempenho de `alunos/[id]/index.tsx`.
4. Repropositar `alunos/[id]/desempenho.tsx` como tela de Jornada/timeline (Epico 5 do documento de visao).
5. Trocar a lista de barras por radar chart de verdade no `EvolucaoScreen`.

**Por que depois da Fase 3, nao antes:** nao ha dependencia tecnica direta, mas a Fase 3 desbloqueia contas `responsavel` que vao consumir a tela de Jornada e o radar chart desta fase — faz mais sentido o publico existir primeiro.

## 7. Itens aditivos — sem bloqueio de fase, encaixar quando houver capacidade

| Item | Origem | Observacao |
|---|---|---|
| Concluir importacao automatica de feriados | [eventos.md](./eventos.md) §5-6 | Totalmente aditivo, nao mexe em nada existente. Pode entrar em paralelo com qualquer fase acima. |
| Professor com dupla identidade (tambem aluno) | [professor-como-aluno.md](./professor-como-aluno.md) §4 | RLS ja suporta; ajuste e so em 3 pontos do cliente (`AuthProvider`, `QuickMenu`, `minha-evolucao.tsx`) + trava nova de autoavaliacao em `registrar_avaliacao_evolucao`. Nao depende de nenhuma fase acima nem da Fase 4 (migracao Evolucao). |
| Aula particular — visibilidade/edicao escopada + autoatendimento do aluno | [chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md) §7.3 | RLS de `aula_leitura`/`aula_escrita` revisada, RPC nova `remarcar_aula_particular`, ajuste em `nova-particular.tsx`. Independente das demais fases. |
| Aula teste — candidato nao matriculado | [chamada-agenda-frequencia.md](./chamada-agenda-frequencia.md) §7.4 | Troca `aulas_teste_alunos` (FK obrigatoria) por `aulas_teste_candidatos` (texto livre); nova secao "Aula Experimental" na chamada. Sem dado de producao a migrar. |

**"Meus convites" para professor** ([usuarios-e-convites.md](./usuarios-e-convites.md) §5-6) ficou **fora deste plano**, por decisao registrada em 2026-09-19: e uma melhoria conhecida, mas sem compromisso de prioridade — so entra numa fase futura se o problema (professor sem visibilidade de convite enviado com erro) comecar a gerar retrabalho real. Nao repetir a pergunta em revisoes futuras deste plano, a menos que o cenario mude.

## 8. Resumo visual da sequencia

```
Fase 1 (pequena, ~3 itens) -> Fase 2 (Meus modulos na chamada) -> Fase 3 (papel responsavel) -> Fase 4 (migracao Evolucao)
                                                                        ^
                              item aditivo (feriados) pode entrar em qualquer ponto acima
```

## 9. Proximo passo

Este plano ordena o que ja foi decidido; nao inicia a implementacao. Quando voce confirmar, posso comecar pela Fase 1 (os 3 itens pequenos), que e a mais segura para validar o fluxo de deploy manual descrito na secao 2 antes de avancar para as fases maiores.
