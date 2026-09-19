import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { PageHeader } from '../../components/PageHeader';
import { Footer } from '../../components/Footer';
import { colors, radius, spacing, type } from '../../constants/theme';
import { uiAssets } from '../../constants/uiAssets';
import { getAluno, getContratoAtual, getFrequenciaAluno, type Aluno } from '../alunos/api';
import { getGradeSemanal } from '../chamada/api';
import {
  getCriteriosHabilidades,
  getHistoricoNivelAluno,
  getMetodologiaAtualAluno,
  getRequisitosNivel,
  hojeISO,
  registrarAvaliacaoDetalhadaEvolucao,
  registrarAvaliacaoRapidaEvolucao,
  getStatusHabilidadesAluno,
} from './api';
import { calcularFrequenciaPorPlano, calcularPercentualCriterios, calcularProgressoNivel } from './selectors';
import type {
  CriterioHabilidadeEvolucao,
  HistoricoNivelEvolucao,
  MetodologiaAtualAluno,
  ProgressoNivelEvolucao,
  RequisitoNivelEvolucao,
  StatusAtualHabilidade,
  StatusHabilidadeEvolucao,
} from './types';

// Dimensões reais do arquivo — o patim e o texto script ficam do lado direito
// da imagem, então o recorte (quando a tela é estreita) é ancorado na direita
// pra não sumir com eles, no mesmo esquema do banner da Home.
const HERO_BANNER = uiAssets.banner.secundario;
const HERO_BANNER_LARGURA = 2156;
const HERO_BANNER_ALTURA = 729;

type EvolucaoScreenProps = {
  alunoId: string;
  tituloPagina: string;
  nomeFallback: string;
  podeEditar?: boolean;
  professorId?: string | null;
};

const STATUS_AVALIACAO_RAPIDA: { valor: StatusHabilidadeEvolucao; label: string; percentual: number }[] = [
  { valor: 'nao_iniciado', label: 'Não iniciado', percentual: 0 },
  { valor: 'aprendendo', label: 'Aprendendo', percentual: 30 },
  { valor: 'em_desenvolvimento', label: 'Em desenvolvimento', percentual: 65 },
  { valor: 'dominado', label: 'Dominado', percentual: 82 },
  { valor: 'consolidado', label: 'Consolidado', percentual: 95 },
];

function formatarDataBR(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function labelTipoHistorico(tipoHistorico: HistoricoNivelEvolucao['tipo']) {
  switch (tipoHistorico) {
    case 'atribuicao_inicial':
      return 'Início da jornada';
    case 'pronto_para_avaliacao':
      return 'Pronto para avaliação';
    case 'aprovado':
      return 'Aprovado';
    case 'reprovado':
      return 'Reprovado';
    case 'promovido':
      return 'Nível conquistado';
    default:
      return 'Atualização';
  }
}

export function EvolucaoScreen({ alunoId, tituloPagina, nomeFallback, podeEditar = false, professorId = null }: EvolucaoScreenProps) {
  const { width } = useWindowDimensions();
  const heroAltura = 168;
  const heroCardLargura = width - spacing.xl * 2;
  const heroEscala = Math.max(heroCardLargura / HERO_BANNER_LARGURA, heroAltura / HERO_BANNER_ALTURA);
  const heroImagemLargura = HERO_BANNER_LARGURA * heroEscala;
  const heroImagemAltura = HERO_BANNER_ALTURA * heroEscala;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [metodologiaAtual, setMetodologiaAtual] = useState<MetodologiaAtualAluno | null>(null);
  const [nomeNivel, setNomeNivel] = useState<string | null>(null);
  const [nomeMetodologia, setNomeMetodologia] = useState<string | null>(null);
  const [frequencia, setFrequencia] = useState<number | null>(null);
  const [progresso, setProgresso] = useState<ProgressoNivelEvolucao | null>(null);
  const [historico, setHistorico] = useState<HistoricoNivelEvolucao[]>([]);
  const [requisitos, setRequisitos] = useState<RequisitoNivelEvolucao[]>([]);
  const [statusHabilidades, setStatusHabilidades] = useState<StatusAtualHabilidade[]>([]);
  const [criteriosPorHabilidade, setCriteriosPorHabilidade] = useState<Record<string, CriterioHabilidadeEvolucao[]>>({});
  const [salvandoHabilidadeId, setSalvandoHabilidadeId] = useState<string | null>(null);
  const [observacoesRapidas, setObservacoesRapidas] = useState<Record<string, string>>({});
  const [habilidadeDetalhadaAberta, setHabilidadeDetalhadaAberta] = useState<string | null>(null);
  const [valoresCriterios, setValoresCriterios] = useState<Record<string, Record<string, string>>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);

    try {
      const [dadosAluno, registrosFrequencia, contratoAtual, gradeSemanal, metodologiaAtual, historicoNivel] = await Promise.all([
        getAluno(alunoId),
        getFrequenciaAluno(alunoId),
        getContratoAtual(alunoId),
        getGradeSemanal(),
        getMetodologiaAtualAluno(alunoId),
        getHistoricoNivelAluno(alunoId),
      ]);

      setAluno(dadosAluno);
      setHistorico(historicoNivel);

      const aulasPorSemana = gradeSemanal.filter((aula) => aula.modulos.includes(dadosAluno.modulo)).length;
      setFrequencia(
        contratoAtual
          ? calcularFrequenciaPorPlano({
              dataInicio: contratoAtual.data_inicio,
              dataFim: contratoAtual.data_fim,
              aulasPorSemana,
              registros: registrosFrequencia,
              hojeISO: hojeISO(),
            })
          : null
      );
      setMetodologiaAtual(metodologiaAtual ?? null);
      setNomeMetodologia(metodologiaAtual?.metodologiaNome ?? null);
      setNomeNivel(metodologiaAtual?.nivelAtualNome ?? null);

      if (!metodologiaAtual?.nivelAtualId) {
        setProgresso(null);
        setRequisitos([]);
        setStatusHabilidades([]);
        setCriteriosPorHabilidade({});
        return;
      }

      const [requisitosNivel, statusAtual] = await Promise.all([
        getRequisitosNivel(metodologiaAtual.nivelAtualId),
        getStatusHabilidadesAluno(alunoId),
      ]);

      const criterios = await getCriteriosHabilidades(requisitosNivel.map((item) => item.habilidadeId));
      const agrupados = criterios.reduce<Record<string, CriterioHabilidadeEvolucao[]>>((acumulado, criterio) => {
        acumulado[criterio.habilidadeId] = [...(acumulado[criterio.habilidadeId] ?? []), criterio];
        return acumulado;
      }, {});

      setRequisitos(requisitosNivel);
      setStatusHabilidades(statusAtual);
      setCriteriosPorHabilidade(agrupados);
      setProgresso(calcularProgressoNivel(requisitosNivel, statusAtual));
    } catch (error) {
      console.error(error);
      setErro(
        podeEditar
          ? 'Não foi possível carregar a Evolução deste aluno. Confirme se a metodologia e o nível dele já foram configurados e tente novamente.'
          : 'Sua jornada está prestes a começar! Assim que seu professor configurar seu nível, tudo o que você for conquistando vai aparecer aqui.'
      );
    } finally {
      setLoading(false);
    }
  }, [alunoId, podeEditar]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function salvarAvaliacaoRapida(habilidadeId: string, status: StatusHabilidadeEvolucao, precisaAtencao = false) {
    if (!metodologiaAtual?.metodologiaId) {
      setErro('O aluno precisa ter uma metodologia ativa antes da avaliação.');
      return;
    }

    const preset = STATUS_AVALIACAO_RAPIDA.find((item) => item.valor === status);
    setSalvandoHabilidadeId(habilidadeId);
    setErro(null);

    try {
      await registrarAvaliacaoRapidaEvolucao({
        alunoId,
        habilidadeId,
        metodologiaId: metodologiaAtual.metodologiaId,
        professorId,
        status,
        percentualGeral: preset?.percentual ?? null,
        precisaAtencao,
        prioridadeTreinamento: precisaAtencao ? 1 : null,
        observacoes: observacoesRapidas[habilidadeId]?.trim() || null,
      });
      await carregar();
    } catch (error) {
      console.error(error);
      setErro('Erro ao salvar avaliação rápida. Tente novamente.');
    } finally {
      setSalvandoHabilidadeId(null);
    }
  }

  async function salvarAvaliacaoDetalhada(habilidadeId: string, precisaAtencao = false) {
    if (!metodologiaAtual?.metodologiaId) {
      setErro('O aluno precisa ter uma metodologia ativa antes da avaliação.');
      return;
    }

    const criterios = criteriosPorHabilidade[habilidadeId] ?? [];
    const valoresBrutos = valoresCriterios[habilidadeId] ?? {};
    const valoresNumericos: Record<string, number> = {};

    for (const criterio of criterios) {
      const bruto = valoresBrutos[criterio.id]?.trim();
      const numero = Number(bruto);
      if (!bruto || Number.isNaN(numero) || numero < 0 || numero > 100) {
        setErro(`Preencha ${criterio.nome} com um valor entre 0 e 100.`);
        return;
      }
      valoresNumericos[criterio.id] = numero;
    }

    const percentualGeral = calcularPercentualCriterios(criterios, valoresNumericos);
    if (percentualGeral == null) {
      setErro('Cadastre critérios ativos para salvar a avaliação detalhada.');
      return;
    }

    setSalvandoHabilidadeId(habilidadeId);
    setErro(null);

    try {
      await registrarAvaliacaoDetalhadaEvolucao({
        alunoId,
        habilidadeId,
        metodologiaId: metodologiaAtual.metodologiaId,
        professorId,
        observacoes: observacoesRapidas[habilidadeId]?.trim() || null,
        precisaAtencao,
        prioridadeTreinamento: precisaAtencao ? 1 : null,
        criterios: criterios.map((criterio) => ({
          criterioId: criterio.id,
          percentual: valoresNumericos[criterio.id],
          observacoes: null,
        })),
        dataAvaliacao: undefined,
      });

      setHabilidadeDetalhadaAberta(null);
      await carregar();
    } catch (error) {
      console.error(error);
      setErro('Erro ao salvar avaliação detalhada. Tente novamente.');
    } finally {
      setSalvandoHabilidadeId(null);
    }
  }

  const nomeExibicaoAluno = aluno?.nome ?? nomeFallback;
  const statusPorHabilidade = new Map(statusHabilidades.map((item) => [item.habilidadeId, item]));

  return (
    <>
      <PageHeader titulo={tituloPagina} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, { height: heroAltura }]}>
          <Image
            source={HERO_BANNER}
            style={[
              styles.heroIlustracao,
              {
                width: heroImagemLargura,
                height: heroImagemAltura,
                top: (heroAltura - heroImagemAltura) / 2,
              },
            ]}
          />
          <View style={styles.heroTextoWrap}>
            <Text style={styles.heroTag}>Minha jornada</Text>
            <Text style={styles.heroTitulo}>{nomeExibicaoAluno}</Text>
            <Text style={styles.heroTexto}>
              {nomeNivel
                ? `${nomeNivel}${frequencia != null ? ` · Frequência ${frequencia}%` : ''}`
                : podeEditar
                  ? 'Configure a metodologia e o nível deste aluno para começar a acompanhar a evolução dele.'
                  : 'Sua jornada está prestes a começar. Em breve você vai ver aqui tudo o que já domina e o que ainda vai conquistar.'}
            </Text>
            {nomeMetodologia ? <Text style={styles.heroSubtexto}>{nomeMetodologia}</Text> : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.cardBase}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!loading && erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {!loading && !erro ? (
          <>
            <View style={styles.cardBase}>
              <Text style={styles.cardTag}>Progresso para o próximo nível</Text>
              <Text style={styles.cardTitulo}>
                {nomeNivel ?? (podeEditar ? 'Nível ainda não configurado' : 'Sua jornada está começando')}
              </Text>
              <Text style={styles.progressoValor}>{progresso?.percentual ?? 0}%</Text>
              <View style={styles.barraFundo}>
                <View style={[styles.barraPreenchida, { width: `${progresso?.percentual ?? 0}%` }]} />
              </View>
              <Text style={styles.cardTexto}>
                {progresso
                  ? `${progresso.habilidadesAtingidas} de ${progresso.habilidadesTotais} habilidades atendidas.`
                  : podeEditar
                    ? 'Nenhuma habilidade vinculada a este nível ainda. Cadastre os requisitos para começar a acompanhar o progresso.'
                    : 'Assim que seu professor organizar as habilidades desse nível, seu progresso vai aparecer bem aqui.'}
              </Text>
            </View>

            {progresso?.focoAtual ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Seu foco atual</Text>
                <Text style={styles.cardTitulo}>{progresso.focoAtual.categoriaNome}</Text>
                <Text style={styles.cardTexto}>
                  {progresso.focoAtual.emDesenvolvimento} habilidade(s) em desenvolvimento e {progresso.focoAtual.emAtencao} com atenção prioritária.
                </Text>
              </View>
            ) : null}

            {progresso?.resumoCategorias.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Radar pedagógico</Text>
                <Text style={styles.cardTexto}>Resumo por macroárea</Text>
                {progresso.resumoCategorias.map((categoria) => (
                  <View key={categoria.categoriaId} style={styles.linhaCategoria}>
                    <View style={styles.linhaCategoriaTopo}>
                      <Text style={styles.categoriaNome}>{categoria.categoriaNome}</Text>
                      <Text style={styles.categoriaPercentual}>{categoria.percentual}%</Text>
                    </View>
                    <View style={styles.barraFundoPequena}>
                      <View style={[styles.barraPreenchida, { width: `${categoria.percentual}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {progresso?.faltantes.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>O que falta conquistar</Text>
                {progresso.faltantes.map((faltante) => (
                  <View key={faltante.habilidadeId} style={styles.faltanteItem}>
                    <Text style={styles.faltanteNome}>{faltante.habilidadeNome}</Text>
                    <Text style={styles.faltanteMeta}>{faltante.categoriaNome}</Text>
                    <Text style={styles.cardTexto}>
                      {faltante.statusAtual ? `Status atual: ${faltante.statusAtual.replaceAll('_', ' ')}.` : 'Ainda sem avaliação registrada.'}{' '}
                      Meta: {faltante.statusMinimo.replaceAll('_', ' ')}
                      {faltante.notaMinima != null ? ` · ${faltante.notaMinima}% mínimo` : ''}.
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {podeEditar && requisitos.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Avaliação rápida</Text>
                <Text style={styles.cardTexto}>Registre o status atual das habilidades do nível.</Text>
                {requisitos.map((requisito) => {
                  const statusAtual = statusPorHabilidade.get(requisito.habilidadeId);
                  const salvando = salvandoHabilidadeId === requisito.habilidadeId;
                  const criterios = criteriosPorHabilidade[requisito.habilidadeId] ?? [];
                  const detalhadaAberta = habilidadeDetalhadaAberta === requisito.habilidadeId;
                  return (
                    <View key={requisito.habilidadeId} style={styles.avaliacaoItem}>
                      <View style={styles.avaliacaoCabecalho}>
                        <View style={styles.avaliacaoTextoWrap}>
                          <Text style={styles.faltanteNome}>{requisito.habilidadeNome}</Text>
                          <Text style={styles.faltanteMeta}>{requisito.categoriaNome}</Text>
                          <Text style={styles.cardTexto}>
                            Atual: {statusAtual ? statusAtual.statusAtual.replaceAll('_', ' ') : 'sem avaliação'} · Meta: {requisito.statusMinimo.replaceAll('_', ' ')}
                          </Text>
                        </View>
                        {salvando ? <ActivityIndicator color={colors.primary} /> : null}
                      </View>

                      <View style={styles.statusGrid}>
                        {STATUS_AVALIACAO_RAPIDA.map((opcao) => {
                          const ativo = statusAtual?.statusAtual === opcao.valor;
                          return (
                            <TouchableOpacity
                              key={opcao.valor}
                              style={[styles.statusChip, ativo && styles.statusChipAtivo]}
                              onPress={() => salvarAvaliacaoRapida(requisito.habilidadeId, opcao.valor)}
                              disabled={salvando}
                            >
                              <Text style={[styles.statusChipTexto, ativo && styles.statusChipTextoAtivo]}>{opcao.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TextInput
                        style={styles.inputObservacao}
                        value={observacoesRapidas[requisito.habilidadeId] ?? ''}
                        onChangeText={(texto) => {
                          setObservacoesRapidas((atual) => ({ ...atual, [requisito.habilidadeId]: texto }));
                        }}
                        placeholder="Observação rápida do professor"
                        multiline
                      />

                      {criterios.length ? (
                        <TouchableOpacity
                          style={[styles.botaoDetalhado, salvando && styles.botaoSecundarioDesabilitado]}
                          onPress={() => {
                            setHabilidadeDetalhadaAberta((atual) =>
                              atual === requisito.habilidadeId ? null : requisito.habilidadeId
                            );
                          }}
                          disabled={salvando}
                        >
                          <Text style={styles.botaoDetalhadoTexto}>
                            {detalhadaAberta ? 'Fechar avaliação detalhada' : 'Abrir avaliação detalhada'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {detalhadaAberta ? (
                        <View style={styles.detalheBox}>
                          {criterios.map((criterio) => (
                            <View key={criterio.id} style={styles.criterioLinha}>
                              <View style={styles.criterioTextoWrap}>
                                <Text style={styles.criterioNome}>{criterio.nome}</Text>
                                <Text style={styles.criterioPeso}>Peso {criterio.peso}</Text>
                                {criterio.descricao ? <Text style={styles.cardTexto}>{criterio.descricao}</Text> : null}
                              </View>
                              <TextInput
                                style={styles.inputCriterio}
                                value={valoresCriterios[requisito.habilidadeId]?.[criterio.id] ?? ''}
                                onChangeText={(texto) => {
                                  setValoresCriterios((atual) => ({
                                    ...atual,
                                    [requisito.habilidadeId]: {
                                      ...(atual[requisito.habilidadeId] ?? {}),
                                      [criterio.id]: texto,
                                    },
                                  }));
                                }}
                                keyboardType="numeric"
                                placeholder="0-100"
                              />
                            </View>
                          ))}

                          <View style={styles.detalheAcoes}>
                            <TouchableOpacity
                              style={[styles.botaoSalvarDetalhado, salvando && styles.botaoSecundarioDesabilitado]}
                              onPress={() => salvarAvaliacaoDetalhada(requisito.habilidadeId)}
                              disabled={salvando}
                            >
                              <Text style={styles.botaoSalvarDetalhadoTexto}>Salvar avaliação detalhada</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.botaoAtencao, salvando && styles.botaoSecundarioDesabilitado]}
                              onPress={() => salvarAvaliacaoDetalhada(requisito.habilidadeId, true)}
                              disabled={salvando}
                            >
                              <Text style={styles.botaoAtencaoTexto}>Salvar e marcar atenção</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.botaoAtencao, salvando && styles.botaoSecundarioDesabilitado]}
                        onPress={() => salvarAvaliacaoRapida(requisito.habilidadeId, 'em_desenvolvimento', true)}
                        disabled={salvando}
                      >
                        <Text style={styles.botaoAtencaoTexto}>Marcar como precisa de atenção</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {historico.length ? (
              <View style={styles.cardBase}>
                <Text style={styles.cardTag}>Histórico</Text>
                {historico.slice(0, 5).map((evento) => (
                  <View key={evento.id} style={styles.historicoItem}>
                    <Text style={styles.historicoTitulo}>{labelTipoHistorico(evento.tipo)}</Text>
                    <Text style={styles.historicoData}>{formatarDataBR(evento.dataEvento)}</Text>
                    {evento.observacoes ? <Text style={styles.cardTexto}>{evento.observacoes}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroCard: {
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    overflow: 'hidden',
  },
  heroIlustracao: {
    position: 'absolute',
    right: 0,
  },
  heroTextoWrap: {
    maxWidth: '62%',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    zIndex: 1,
  },
  heroTag: {
    ...type.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  heroTitulo: {
    ...type.title,
    color: colors.text,
  },
  heroTexto: {
    ...type.body,
    color: colors.textMuted,
  },
  heroSubtexto: {
    ...type.caption,
    color: colors.textMuted,
  },
  cardBase: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTag: {
    ...type.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  cardTitulo: {
    ...type.subtitle,
    color: colors.text,
  },
  cardTexto: {
    ...type.body,
    color: colors.textMuted,
  },
  progressoValor: {
    fontFamily: type.display.fontFamily,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  barraFundo: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barraFundoPequena: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  linhaCategoria: {
    gap: spacing.xs,
  },
  linhaCategoriaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoriaNome: {
    ...type.body,
    color: colors.text,
  },
  categoriaPercentual: {
    ...type.subtitle,
    color: colors.primary,
  },
  faltanteItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  faltanteNome: {
    ...type.subtitle,
    color: colors.text,
  },
  faltanteMeta: {
    ...type.caption,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  avaliacaoItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  avaliacaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  avaliacaoTextoWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipTexto: {
    ...type.caption,
    color: colors.primary,
  },
  statusChipTextoAtivo: {
    color: colors.onPrimary,
  },
  inputObservacao: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    textAlignVertical: 'top',
  },
  botaoDetalhado: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  botaoDetalhadoTexto: {
    ...type.caption,
    color: colors.primary,
  },
  detalheBox: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  criterioLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  criterioTextoWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  criterioNome: {
    ...type.body,
    color: colors.text,
  },
  criterioPeso: {
    ...type.caption,
    color: colors.primary,
  },
  inputCriterio: {
    width: 82,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    textAlign: 'center',
  },
  detalheAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  botaoSalvarDetalhado: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  botaoSalvarDetalhadoTexto: {
    ...type.caption,
    color: colors.onPrimary,
  },
  botaoAtencao: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  botaoAtencaoTexto: {
    ...type.caption,
    color: colors.danger,
  },
  botaoSecundarioDesabilitado: {
    opacity: 0.6,
  },
  historicoItem: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  historicoTitulo: {
    ...type.subtitle,
    color: colors.text,
  },
  historicoData: {
    ...type.caption,
    color: colors.textMuted,
  },
  erro: {
    ...type.body,
    color: colors.danger,
  },
});