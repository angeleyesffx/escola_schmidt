# Papeis e Permissoes

Documento transversal. Base para todos os outros documentos de produto em `docs/product/`. Toda afirmacao aqui e rastreavel a um arquivo real do repositorio (migrations, edge functions, telas) — nao ha suposicao de requisito nao verificado no codigo.

## 1. Papeis que existem hoje

O enum real, definido em [supabase/migrations/0001_schema.sql](../../supabase/migrations/0001_schema.sql), tem apenas 3 valores:

- `dono` — dono/administrador da escola
- `professor` — equipe pedagogica
- `aluno` — aluno ou responsavel logado em nome do aluno

Nao existe `responsavel` nem `admin` como papel. Quando um responsavel precisa de login, a conta recebe `papel = 'aluno'` e e vinculada ao registro do aluno via `alunos.perfil_id`. "Responsavel" hoje e apenas texto livre (`alunos.responsavel_nome`, `alunos.responsavel_telefone`), nao uma identidade com login proprio e permissoes distintas.

Existe ainda um estado ortogonal ao papel: `perfis.ativo` (boolean, `supabase/migrations/0015_perfis_ativo.sql`). Uma conta inativa e barrada no login independente do papel.

### Divergencia com o documento de visao

[docs/minha-evolucao.md](../minha-evolucao.md) (secao "Perfis e permissoes") descreve **4** perfis — Professor, Aluno, Responsavel e Administrador — com Responsavel podendo "suportar multiplos alunos por conta" e Administrador "administrando catalogo, niveis, requisitos, modalidades e permissoes". Isso nunca foi implementado dessa forma: hoje `dono` acumula o papel de Administrador, e Responsavel nao existe como identidade separada de Aluno.

**RESOLVIDO em [alunos-e-responsaveis.md](./alunos-e-responsaveis.md) (2026-09-19):** o enum `papel` vai ganhar um 4º valor, `responsavel`, formalizando o modelo do documento de visao. Detalhes completos, incluindo o novo fluxo de cadastro e o alcance de acesso, estao naquele documento (secao 5).

## 2. Matriz de permissoes por area

Convencao: **RLS** = o que o Postgres realmente permite (fonte da verdade, `supabase/migrations/`). **UI** = o que a tela mostra/permite hoje. Quando os dois nao batem, a linha esta marcada com ⚠️.

### 2.1 Gestao de contas (`perfis`)

| Acao | dono | professor | aluno |
|---|---|---|---|
| Ver lista de todos os usuarios | RLS+UI: sim | RLS+UI: nao (tela redireciona) | RLS+UI: nao |
| Ver perfil de outro usuario especifico | so o proprio + professor da propria turma (RLS `perfil_leitura_professor_da_minha_aula`) | so o proprio | so o proprio + professor da propria turma |
| Convidar novo usuario (qualquer papel) | RLS+UI: sim | RLS+UI: sim, **exceto** convidar como `dono` (bloqueado na edge function e na UI) | nao |
| Alterar papel de um usuario existente | RLS+UI: sim (`perfil_dono_gerencia`) | nao | nao |
| Ativar/desativar um usuario existente | RLS+UI: sim | nao | nao |
| Alterar o proprio papel/status | ⚠️ RLS permite (`perfil_dono_gerencia` nao exclui `id = auth.uid()`), **UI bloqueia** (`editandoSiMesmo` em `usuarios/[id].tsx`) | nao | nao |
| Editar o proprio nome/telefone | sim, via RPC `atualizar_meu_perfil` | sim | sim |

**Achado ⚠️ — RESOLVIDO (decisao registrada em 2026-09-19):** o auto-bloqueio (dono nao pode rebaixar/desativar a si mesmo) existe **só na tela**, nao no banco. Decisao: isso nunca deveria ser possivel, nem por acidente nem por chamada direta a API — a regra precisa virar protecao real de RLS, nao so uma checagem de UI. **Acao recomendada:** nova migracao ajustando a policy `perfil_dono_gerencia` para excluir `id = auth.uid()` do `update` (ex.: `using (papel_atual() = 'dono' and id <> auth.uid())`), mantendo o bloqueio da tela como reforço de UX (mensagem amigavel) em vez de unica barreira.

**Achado ⚠️ (assimetria) — RESOLVIDO (decisao registrada em 2026-09-19):** `professor` pode criar novas contas (inclusive novos `professor`) mas nao pode ver a lista de usuarios nem editar ninguem depois de convidado. Confirmado como **intencional** (reduzir atrito de onboarding sem dar poder de gestao a professor), mas marcado para melhoria futura — a lacuna concreta e que um convite com erro (email errado, papel errado) so pode ser corrigido pelo `dono`, sem nenhuma fila ou aviso para ele saber que precisa agir. **Sugestao a validar depois:** dar ao professor, no minimo, visibilidade dos convites que ele mesmo enviou (status pendente/aceito) para poder pedir correcao ao dono, sem lhe dar poder de gestao sobre as demais contas.

### 2.2 Cadastro de alunos (`alunos`, `contratos`)

| Acao | dono | professor | aluno/responsavel |
|---|---|---|---|
| Ver lista de alunos | sim | sim | nao (tela redireciona) |
| Cadastrar novo aluno / editar modulo, plano, contrato | sim | sim (desde `0014_professor_cadastra_aluno.sql`) | nao |
| Editar dados basicos do proprio filho (nome, nascimento, nome/telefone do responsavel) | sim | sim | sim, via RPC `atualizar_meus_dados_aluno` — **nao inclui** modulo nem plano |
| Vincular uma conta autocadastrada a um registro de aluno existente | sim | sim | nao |
| Convidar responsavel/aluno para acessar (edge function `convidar-aluno`) | sim | sim | nao |

Nenhuma divergencia RLS/UI encontrada nesta area.

### 2.3 Chamada, agenda e particulares (`aulas`, `aulas_recorrentes`, `presencas`, `pedidos_presenca`, `disponibilidade_particular`, `professores_aula`, `aulas_teste`)

| Acao | dono | professor | aluno |
|---|---|---|---|
| Ver grade semanal fixa (`aulas_recorrentes`) | ver e editar | ver | ver (indireto, via agenda) |
| Fazer chamada (marcar presenca/falta) de uma turma | sim, qualquer turma | sim, mas so aprova pedidos da propria turma (`professores_aula`) | nao |
| Pedir a propria presenca (autocheckin) | n/a | n/a | sim, so no dia e modulo da propria aula (`pedidos_presenca`) |
| Agendar aula particular | sim, para qualquer professor | sim | nao |
| Declarar disponibilidade para particular | sim, para qualquer professor (via dropdown) | sim, so a propria | nao |
| Agendar aula teste | sim, qualquer slot | sim, so slots que assumiu em "Meus modulos" | nao |
| Assumir responsabilidade por um slot/modulo ("Meus modulos") | sim, para qualquer professor | sim, so para si mesmo | nao |
| Criar/editar/excluir evento de calendario | sim | sim | nao (UI esconde o botao) |

**Achado ⚠️ — RESOLVIDO (decisao registrada em 2026-09-19):** a tela `chamada/novo-evento.tsx` (criar/editar evento) **nao le `meuPapel` em nenhum momento** — diferente de toda tela irma do modulo, que redireciona aluno para a home. Modelo de permissao confirmado: **aluno e responsavel tem acesso somente de visualizacao a eventos; so `dono` e `professor` podem criar/editar/excluir**. Isso confirma que a ausencia de guarda nesta tela e uma lacuna real a corrigir, nao um comportamento aceitavel. **Acao recomendada:** adicionar a mesma guarda usada nas telas irmas (`if (meuPapel !== 'dono' && meuPapel !== 'professor') return <Redirect href="/" />`) e confirmar que a RLS de `eventos_calendario`/`tipos_evento` ja nega escrita para `aluno` (a leitura de tabela indica que sim, mas vale um teste manual apos o fix de UI).

### 2.4 Avaliacao pedagogica (Desempenho legado + Minha Evolucao)

| Acao | dono | professor | aluno |
|---|---|---|---|
| Registrar avaliacao (Desempenho ou Evolucao) | sim | sim (`eh_equipe()`) | nao |
| Ver a propria evolucao/desempenho | sim (de qualquer aluno) | sim (de qualquer aluno) | sim, so a propria |
| Configurar catalogo (habilidades, niveis, metodologias, requisitos) | so via banco — **nao existe tela para isso**, nem para `dono` | nao | nao |
| Ler auditoria de avaliacoes (`auditoria_avaliacoes_evolucao`) | sim, exclusivo | nao | nao |

**Achado ⚠️:** nao ha divergencia RLS/UI aqui, mas ha uma lacuna de produto relevante para permissoes: hoje **nem o `dono`** tem uma tela para configurar o catalogo de Minha Evolucao. Na pratica, o papel "Administrador de catalogo" previsto no documento de visao nao tem UI para nenhum papel — isso sera aprofundado no documento de Minha Evolucao vs Desempenho.

## 3. Decisoes registradas (2026-09-19)

| # | Pergunta | Decisao | Status |
|---|---|---|---|
| 1 | Modelo de 3 papeis (dono/professor/aluno) vs. 4 papeis do documento de visao | **Fechado em `alunos-e-responsaveis.md`:** o enum ganha `responsavel` como 4º papel, distinto de `aluno`. Acesso a features (frequencia, evolucao, autocheckin) permanece igual ao que `aluno` ja tem hoje — muda a identidade/rotulo do papel, nao o que e visto | Detalhado e pronto para desenho tecnico em `alunos-e-responsaveis.md` |
| 2 | Auto-bloqueio de dono | Nunca deveria ser possivel rebaixar/desativar a propria conta, por acidente ou API direta — precisa virar regra de RLS, nao so checagem de UI | Pronto para implementar (ver acao recomendada na secao 2.1) |
| 3 | Guarda de papel em `novo-evento.tsx` | Confirmado: aluno/responsavel so podem visualizar eventos; so dono e professor criam/editam. A tela sem guarda e uma lacuna real | Pronto para implementar (ver acao recomendada na secao 2.3) |
| 4 | Assimetria professor convida / nao gerencia | Confirmado como intencional | Melhoria futura registrada (visibilidade de convites enviados) |

**Nota:** as matrizes de permissao nas secoes 2.1 a 2.4 deste documento, e as dos documentos seguintes, ainda usam a coluna `aluno` para cobrir tambem o caso de responsavel — isso reflete o estado do codigo no momento em que foram escritas (antes da decisao acima). Quando a implementacao do papel `responsavel` acontecer, essas matrizes devem ser revisadas para desdobrar a coluna `aluno` em `aluno` e `responsavel` (hoje identicas em permissao, por decisao registrada acima).

## 4. Backlog de implementacao gerado por este documento

Estes dois itens estao com decisao de produto fechada e sao pequenos e isolados — ficam registrados aqui como prontos para implementar quando voce autorizar uma sessao de codigo (fora do escopo deste levantamento, que e so documentacao):

1. Migration nova: policy `perfil_dono_gerencia` passa a negar update na propria linha (`id <> auth.uid()` na clausula `using`/`with check`).
2. `app/(app)/chamada/novo-evento.tsx`: adicionar guarda `if (meuPapel !== 'dono' && meuPapel !== 'professor') return <Redirect href="/" />`, igual as telas irmas do modulo.

## 5. Pendencia levada para o proximo documento

O ponto 1 (melhorar o modelo de "Responsavel") nao tem decisao de solucao ainda — so a decisao de que o estado atual e insuficiente. Vou aprofundar isso em `docs/product/alunos-e-responsaveis.md`, quando chegar a vez desse modulo na ordem combinada, propondo opcoes concretas (papel formal `responsavel` vs. tabela de vinculo N:N aluno-responsavel mantendo o papel `aluno`).

Proximo documento: `docs/product/chamada-agenda-frequencia.md`.
