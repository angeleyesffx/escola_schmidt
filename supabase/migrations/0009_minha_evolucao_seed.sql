-- Escola Schmidt — seed inicial e backfill para Minha Evolucao
-- Rodar em: Supabase > SQL Editor, depois de 0008_minha_evolucao_avaliacoes.sql

-- Objetivo desta migracao:
-- - criar uma metodologia inicial 2026 utilizavel no app
-- - mapear o catalogo simplificado legado para o catalogo novo
-- - atribuir uma metodologia/nivel atual aos alunos ativos
-- - importar avaliacoes antigas para a estrutura de evolucao
-- - registrar um historico inicial minimo

-- ---------------------------------------------------------------------------
-- Modalidade e categorias iniciais
-- ---------------------------------------------------------------------------

insert into modalidades_evolucao (nome, slug, descricao, ativo)
values ('Livre', 'livre', 'Trilha inicial da Escola Schmidt para evolucao tecnica geral.', true)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ativo = true;

with modalidade_livre as (
  select id from modalidades_evolucao where slug = 'livre'
)
insert into categorias_habilidade (modalidade_id, nome, slug, descricao, ordem, ativo)
select modalidade_livre.id, dados.nome, dados.slug, dados.descricao, dados.ordem, true
  from modalidade_livre
  cross join (
    values
      ('Fundamentos', 'fundamentos', 'Postura, equilibrio, impulsao e controle basico.', 1),
      ('Giros', 'giros', 'Controle de eixo e rotacoes.', 2),
      ('Saltos', 'saltos', 'Saltos e impulsos aereos.', 3),
      ('Passos', 'passos', 'Sequencias, transicoes e deslocamentos.', 4),
      ('Artistico', 'artistico', 'Apresentacao, musicalidade e extensao corporal.', 5)
  ) as dados(nome, slug, descricao, ordem)
on conflict (modalidade_id, slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  ativo = true;

-- ---------------------------------------------------------------------------
-- Catalogo novo a partir das habilidades legadas
-- ---------------------------------------------------------------------------

with mapa_habilidades as (
  select
    h.nome,
    h.ordem,
    case h.nome
      when 'Equilíbrio e postura' then 'equilibrio-postura'
      when 'Impulsos e propulsão' then 'impulsos-propulsao'
      when 'Giros e corrupios' then 'giros-corrupios'
      when 'Saltos' then 'saltos'
      when 'Sequência de passos' then 'sequencia-passos'
      when 'Figuras de alongamento' then 'figuras-alongamento'
      when 'Freio e controle de velocidade' then 'freio-controle-velocidade'
      when 'Musicalidade e apresentação' then 'musicalidade-apresentacao'
      else lower(replace(replace(replace(h.nome, ' ', '-'), 'ã', 'a'), 'ç', 'c'))
    end as slug,
    case h.nome
      when 'Giros e corrupios' then 'giros'
      when 'Saltos' then 'saltos'
      when 'Sequência de passos' then 'passos'
      when 'Musicalidade e apresentação' then 'artistico'
      else 'fundamentos'
    end as categoria_slug,
    case h.nome
      when 'Equilíbrio e postura' then 'Base de postura, eixo e estabilidade corporal.'
      when 'Impulsos e propulsão' then 'Capacidade de gerar velocidade e impulsao com tecnica.'
      when 'Giros e corrupios' then 'Dominio inicial de giros e centralizacao.'
      when 'Saltos' then 'Execucao global dos saltos trabalhados no nivel atual.'
      when 'Sequência de passos' then 'Sequencias de passos, turns e transicoes.'
      when 'Figuras de alongamento' then 'Extensao, linhas corporais e apresentacao tecnica.'
      when 'Freio e controle de velocidade' then 'Controle de velocidade, desaceleracao e seguranca.'
      when 'Musicalidade e apresentação' then 'Expressao, timing e leitura musical.'
      else null
    end as descricao
  from habilidades h
), categoria_alvo as (
  select ch.id, ch.slug
    from categorias_habilidade ch
    join modalidades_evolucao me on me.id = ch.modalidade_id
   where me.slug = 'livre'
)
insert into habilidades_catalogo (categoria_id, nome, slug, nome_internacional, descricao, origem, temporada_regra, ativo)
select
  ca.id,
  mh.nome,
  mh.slug,
  mh.nome,
  mh.descricao,
  'legado_desempenho',
  2026,
  true
from mapa_habilidades mh
join categoria_alvo ca on ca.slug = mh.categoria_slug
on conflict (categoria_id, slug) do update set
  nome = excluded.nome,
  nome_internacional = excluded.nome_internacional,
  descricao = excluded.descricao,
  origem = excluded.origem,
  temporada_regra = excluded.temporada_regra,
  ativo = true;

insert into criterios_habilidade (habilidade_id, nome, descricao, ordem, peso, ativo)
select hc.id, 'Execução geral', 'Critério inicial importado do modelo simplificado legado.', 1, 1, true
  from habilidades_catalogo hc
 where hc.origem = 'legado_desempenho'
on conflict (habilidade_id, nome) do update set
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  peso = excluded.peso,
  ativo = true;

-- ---------------------------------------------------------------------------
-- Metodologia e niveis iniciais
-- ---------------------------------------------------------------------------

insert into metodologias_evolucao (nome, slug, temporada, descricao, vigencia_inicio, vigencia_fim, ativa)
values (
  'Schmidt Base 2026',
  'schmidt-base-2026',
  2026,
  'Metodologia inicial derivada do acompanhamento tecnico atual da escola.',
  date '2026-01-01',
  null,
  true
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  temporada = excluded.temporada,
  vigencia_inicio = excluded.vigencia_inicio,
  vigencia_fim = excluded.vigencia_fim,
  ativa = true;

with metodologia as (
  select id from metodologias_evolucao where slug = 'schmidt-base-2026'
)
insert into niveis_evolucao (metodologia_id, nome, descricao, ordem, ativo)
select
  metodologia.id,
  dados.nome,
  dados.descricao,
  dados.ordem,
  true
from metodologia
cross join (
  values
    ('Nível 1', 'Fundamentos de base, postura, impulsao e seguranca.', 1),
    ('Nível 2', 'Transicoes, giros iniciais e consolidacao de controle.', 2),
    ('Nível 3', 'Combinacao de controle, sequencias e repertorio tecnico intermediario.', 3),
    ('Nível 4', 'Consolidacao tecnica e artistica para repertorio avancado da escola.', 4)
) as dados(nome, descricao, ordem)
on conflict (metodologia_id, nome) do update set
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  ativo = true;

with metodologia as (
  select id from metodologias_evolucao where slug = 'schmidt-base-2026'
), niveis as (
  select id, ordem from niveis_evolucao where metodologia_id = (select id from metodologia)
), habilidades_base as (
  select hc.id, hc.slug
    from habilidades_catalogo hc
   where hc.origem = 'legado_desempenho'
), requisitos as (
  select 1 as ordem_nivel, 'equilibrio-postura' as habilidade_slug, 2::numeric as peso, 'dominado'::status_habilidade_evolucao as status_minimo, 70::numeric as nota_minima union all
  select 1, 'impulsos-propulsao', 2, 'dominado', 70 union all
  select 1, 'freio-controle-velocidade', 1, 'em_desenvolvimento', 60 union all
  select 2, 'sequencia-passos', 2, 'em_desenvolvimento', 60 union all
  select 2, 'giros-corrupios', 2, 'em_desenvolvimento', 60 union all
  select 2, 'figuras-alongamento', 1, 'aprendendo', null union all
  select 3, 'saltos', 3, 'em_desenvolvimento', 65 union all
  select 3, 'musicalidade-apresentacao', 1, 'aprendendo', null union all
  select 4, 'equilibrio-postura', 1, 'consolidado', 80 union all
  select 4, 'giros-corrupios', 2, 'dominado', 75 union all
  select 4, 'saltos', 2, 'dominado', 75 union all
  select 4, 'sequencia-passos', 2, 'dominado', 75 union all
  select 4, 'musicalidade-apresentacao', 1, 'em_desenvolvimento', 65
)
insert into requisitos_nivel_evolucao (nivel_id, habilidade_id, obrigatorio, peso, nota_minima, status_minimo)
select n.id, hb.id, true, r.peso, r.nota_minima, r.status_minimo
  from requisitos r
  join niveis n on n.ordem = r.ordem_nivel
  join habilidades_base hb on hb.slug = r.habilidade_slug
on conflict (nivel_id, habilidade_id) do update set
  obrigatorio = excluded.obrigatorio,
  peso = excluded.peso,
  nota_minima = excluded.nota_minima,
  status_minimo = excluded.status_minimo;

-- ---------------------------------------------------------------------------
-- Alunos ativos entram na metodologia atual conforme o modulo ja existente
-- ---------------------------------------------------------------------------

with metodologia as (
  select id from metodologias_evolucao where slug = 'schmidt-base-2026'
), niveis as (
  select id, ordem from niveis_evolucao where metodologia_id = (select id from metodologia)
)
insert into aluno_metodologias (aluno_id, metodologia_id, nivel_atual_id, data_inicio, data_fim)
select
  a.id,
  (select id from metodologia),
  n.id,
  coalesce(a.criado_em::date, current_date),
  null
from alunos a
join niveis n on n.ordem = least(greatest(a.modulo, 1), 4)
where a.ativo = true
  and not exists (
    select 1 from aluno_metodologias am
     where am.aluno_id = a.id
       and am.data_fim is null
  );

insert into historico_nivel_evolucao (
  aluno_id,
  metodologia_id,
  nivel_id,
  tipo,
  data_evento,
  registrado_por,
  observacoes
)
select
  am.aluno_id,
  am.metodologia_id,
  am.nivel_atual_id,
  'atribuicao_inicial',
  am.data_inicio,
  null,
  'Importado automaticamente da estrutura legada de modulo do aluno.'
from aluno_metodologias am
join metodologias_evolucao me on me.id = am.metodologia_id and me.slug = 'schmidt-base-2026'
where am.nivel_atual_id is not null
  and not exists (
    select 1 from historico_nivel_evolucao hn
     where hn.aluno_id = am.aluno_id
       and hn.tipo = 'atribuicao_inicial'
       and hn.metodologia_id = am.metodologia_id
  );

insert into historico_nivel_evolucao (
  aluno_id,
  metodologia_id,
  nivel_id,
  tipo,
  data_evento,
  origem_teste_nivel_id,
  registrado_por,
  observacoes
)
select
  tn.aluno_id,
  am.metodologia_id,
  ne.id,
  case when tn.aprovado then 'aprovado' else 'reprovado' end,
  tn.data,
  tn.id,
  tn.professor_id,
  tn.observacoes
from testes_nivel tn
join aluno_metodologias am on am.aluno_id = tn.aluno_id and am.data_fim is null
join niveis_evolucao ne on ne.metodologia_id = am.metodologia_id and ne.ordem = least(greatest(tn.modulo_para, 1), 4)
where not exists (
  select 1 from historico_nivel_evolucao hn where hn.origem_teste_nivel_id = tn.id
);

-- ---------------------------------------------------------------------------
-- Importa avaliacoes antigas para a nova estrutura
-- ---------------------------------------------------------------------------

with metodologia as (
  select id from metodologias_evolucao where slug = 'schmidt-base-2026'
), legado_para_novo as (
  select
    h.id as habilidade_legada_id,
    hc.id as habilidade_nova_id
  from habilidades h
  join habilidades_catalogo hc on hc.nome = h.nome and hc.origem = 'legado_desempenho'
)
insert into avaliacoes_evolucao (
  aluno_id,
  habilidade_id,
  metodologia_id,
  professor_id,
  data_avaliacao,
  status,
  percentual_geral,
  precisa_atencao,
  prioridade_treinamento,
  observacoes,
  criado_em,
  atualizado_em
)
select
  ad.aluno_id,
  lpn.habilidade_nova_id,
  (select id from metodologia),
  ad.registrado_por,
  ad.data,
  case ad.nivel
    when 'precisa_melhorar' then 'aprendendo'::status_habilidade_evolucao
    when 'conforme_esperado' then 'dominado'::status_habilidade_evolucao
    when 'excelente' then 'consolidado'::status_habilidade_evolucao
  end,
  case ad.nivel
    when 'precisa_melhorar' then 45::numeric
    when 'conforme_esperado' then 75::numeric
    when 'excelente' then 92::numeric
  end,
  ad.nivel = 'precisa_melhorar',
  case when ad.nivel = 'precisa_melhorar' then 1 else null end,
  ad.observacoes,
  ad.criado_em,
  ad.criado_em
from avaliacoes_desempenho ad
join legado_para_novo lpn on lpn.habilidade_legada_id = ad.habilidade_id
where not exists (
  select 1
    from avaliacoes_evolucao ae
   where ae.aluno_id = ad.aluno_id
     and ae.habilidade_id = lpn.habilidade_nova_id
     and ae.data_avaliacao = ad.data
     and ae.metodologia_id = (select id from metodologia)
);

insert into avaliacao_criterios_evolucao (
  avaliacao_id,
  criterio_id,
  percentual,
  observacoes,
  criado_em,
  atualizado_em
)
select
  ae.id,
  ch.id,
  ae.percentual_geral,
  ae.observacoes,
  ae.criado_em,
  ae.atualizado_em
from avaliacoes_evolucao ae
join habilidades_catalogo hc on hc.id = ae.habilidade_id and hc.origem = 'legado_desempenho'
join criterios_habilidade ch on ch.habilidade_id = hc.id and ch.nome = 'Execução geral'
where not exists (
  select 1 from avaliacao_criterios_evolucao ace where ace.avaliacao_id = ae.id and ace.criterio_id = ch.id
);