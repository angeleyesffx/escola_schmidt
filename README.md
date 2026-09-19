# Escola Schmidt — App

Controle de presença e desempenho dos alunos da escola de patinação artística.
Roda em Android, iOS e navegador a partir do mesmo código.

## Stack

- **Expo + React Native + Expo Router** — app nativo e build web
- **TypeScript**
- **Supabase** — autenticação, banco Postgres e permissões por perfil
- **SheetJS (xlsx)** — exportação da chamada para Excel

## Perfis

| Perfil | O que faz |
| --- | --- |
| Dono | Cadastra turmas e professores, vê tudo |
| Professor | Faz a chamada das suas turmas, avalia alunos |
| Aluno | Vê a própria presença e evolução |

## Rodando pela primeira vez

```bash
npm install
cp .env.example .env   # preencha com os dados do Supabase
npx expo start
```

Tecle `a` para Android, `i` para iOS, `w` para o navegador.

## Testes

```bash
npm test
npm run test:coverage
npm run typecheck
```

Escopo da fase 1 de qualidade:

- testes unitarios para modulos criticos e telas estaveis
- mocks para isolar Supabase e runtime nativo
- cobertura medida sobre o app inteiro (nao so os arquivos ja testados); piso
  atual e o baseline real (~20-22%), sobe conforme mais telas ganham testes

## Estrutura de pastas

```
app/                      rotas (Expo Router: cada arquivo é uma tela)
  (auth)/
    login.tsx
    cadastro.tsx
  (app)/
    _layout.tsx           guarda de sessão + navegação por abas
    index.tsx             turmas de hoje
    chamada/[turmaId].tsx lista de presença
    turmas/
    alunos/
  _layout.tsx             carrega fontes e provider de sessão

src/
  components/             botões, campos, linha de aluno — nada de tela inteira
  features/
    chamada/              hooks e lógica de presença
    turmas/
    alunos/
  lib/
    supabase.ts           cliente único do Supabase
    exportarExcel.ts      geração do .xlsx
  constants/
    theme.ts              cores, tipografia, espaçamento
  types/
    database.ts           tipos gerados pelo Supabase CLI

supabase/
  migrations/             schema versionado em SQL

assets/
  fonts/
  images/
```

Regra que vale a pena manter desde o começo: tela fica em `app/`, lógica fica em
`src/features/`. Quando a avaliação de movimentos entrar, ela vira mais uma
pasta em `features/` sem mexer no resto.

## Especificacoes

- [Minha Evolucao](docs/minha-evolucao.md) — backlog, modelagem e estrategia da nova feature de evolucao esportiva do aluno.

## Estado do projeto

- [x] Identidade visual definida
- [x] Estrutura do projeto
- [ ] Modelagem do banco e perfis
- [ ] Login e cadastro
- [ ] Tela de chamada
- [ ] Exportação para Excel
- [ ] Desempenho por módulo/semestre
- [ ] Avaliação para competição
