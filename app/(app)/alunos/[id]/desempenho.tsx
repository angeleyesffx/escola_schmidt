import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { getAluno, type Aluno } from '../../../../src/features/alunos/api';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { getAvaliacoesEvolucaoAluno, getHistoricoNivelAluno } from '../../../../src/features/evolucao/api';
import type {
  AvaliacaoEvolucaoResumo,
  HistoricoNivelEvolucao,
  StatusHabilidadeEvolucao,
} from '../../../../src/features/evolucao/types';
import { paraBR } from '../../../../src/lib/dataBR';
import { PageHeader } from '../../../../src/components/PageHeader';
import { Footer } from '../../../../src/components/Footer';
import { uiAssets } from '../../../../src/constants/uiAssets';
import { colors, radius, spacing, type } from '../../../../src/constants/theme';

// Repropositada em 2026-09-20 (Fase 4, passo 4 de
// docs/product/evolucao-vs-desempenho.md): esta tela era um duplicata órfã
// da grade de habilidades do Desempenho legado (achado 4.1 daquele
// documento) — nenhuma tela linkava pra ela. Vira a Jornada: timeline
// completa cruzando historico_nivel_evolucao (nível/promoção) com
// avaliacoes_evolucao (avaliação por habilidade), só leitura. A versão
// resumida (últimos 5 eventos de nível) continua em EvolucaoScreen; aqui é
// a completa, com as avaliações por habilidade também.

const STATUS_LABEL: Record<StatusHabilidadeEvolucao, string> = {
  nao_iniciado: 'Não iniciado',
  aprendendo: 'Aprendendo',
  em_desenvolvimento: 'Em desenvolvimento',
  dominado: 'Dominado',
  consolidado: 'Consolidado',
};

const STATUS_COR: Record<StatusHabilidadeEvolucao, 'absent' | 'onTrack' | 'present'> = {
  nao_iniciado: 'absent',
  aprendendo: 'absent',
  em_desenvolvimento: 'onTrack',
  dominado: 'present',
  consolidado: 'present',
};

function labelTipoHistorico(tipo: HistoricoNivelEvolucao['tipo']) {
  switch (tipo) {
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

type EventoJornada =
  | { tipo: 'nivel'; data: string; evento: HistoricoNivelEvolucao }
  | { tipo: 'avaliacao'; data: string; itens: AvaliacaoEvolucaoResumo[] };

function montarJornada(historico: HistoricoNivelEvolucao[], avaliacoes: AvaliacaoEvolucaoResumo[]): EventoJornada[] {
  const porData = new Map<string, AvaliacaoEvolucaoResumo[]>();
  for (const a of avaliacoes) {
    const lista = porData.get(a.dataAvaliacao) ?? [];
    lista.push(a);
    porData.set(a.dataAvaliacao, lista);
  }

  const eventos: EventoJornada[] = [];
  historico.forEach((evento) => eventos.push({ tipo: 'nivel', data: evento.dataEvento, evento }));
  porData.forEach((itens, data) => eventos.push({ tipo: 'avaliacao', data, itens }));

  eventos.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return eventos;
}

export default function JornadaAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meuPapel, meuAluno } = useAuth();

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [historico, setHistorico] = useState<HistoricoNivelEvolucao[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoEvolucaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosAluno, dadosHistorico, dadosAvaliacoes] = await Promise.all([
        getAluno(id),
        getHistoricoNivelAluno(id),
        getAvaliacoesEvolucaoAluno(id),
      ]);
      setAluno(dadosAluno);
      setHistorico(dadosHistorico);
      setAvaliacoes(dadosAvaliacoes);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar a jornada. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    if (!meuAluno) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (meuAluno.id !== id) {
      return <Redirect href="/" />;
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Jornada" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const eventos = montarJornada(historico, avaliacoes);

  const cabecalho = (
    <View>
      <View style={styles.bannerTopo}>
        <View style={styles.bannerTopoTexto}>
          <Text style={[type.label, styles.bannerTopoTag]}>Jornada</Text>
          <Text style={type.subtitle}>Histórico completo de evolução</Text>
          <Text style={[type.caption, styles.subtitle]}>Todos os níveis conquistados e avaliações registradas.</Text>
        </View>
        <Image source={uiAssets.card.desempenho} style={styles.bannerTopoImagem} />
      </View>

      {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}
    </View>
  );

  return (
    <>
      <PageHeader titulo={aluno?.nome ?? 'Jornada'} />
      <View style={styles.container}>
        <FlatList
          data={eventos}
          keyExtractor={(item, index) => `${item.tipo}-${item.data}-${index}`}
          ListHeaderComponent={cabecalho}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !error ? <Text style={[type.body, styles.subtitle]}>Nenhum evento registrado ainda.</Text> : null
          }
          renderItem={({ item, index }) => {
            const ultimo = index === eventos.length - 1;
            const eventoDeNivel = item.tipo === 'nivel';
            return (
              <View style={styles.linha}>
                <View style={styles.trilha}>
                  <View style={[styles.no, eventoDeNivel ? styles.noNivel : styles.noAvaliacao]} />
                  {!ultimo ? <View style={styles.conector} /> : null}
                </View>
                <View style={styles.conteudo}>
                  <Text style={[type.caption, styles.dataTexto]}>{paraBR(item.data)}</Text>
                  {item.tipo === 'nivel' ? (
                    <View style={[styles.cartao, styles.cartaoNivel]}>
                      <Text style={type.subtitle}>{labelTipoHistorico(item.evento.tipo)}</Text>
                      {item.evento.nivelNome ? <Text style={[type.body, styles.cardSubtitle]}>{item.evento.nivelNome}</Text> : null}
                      {item.evento.observacoes ? (
                        <Text style={[type.body, styles.cardSubtitle]}>{item.evento.observacoes}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.cartao}>
                      <View style={styles.chipsAvaliacao}>
                        {item.itens.map((a) => (
                          <View key={a.id} style={styles.chipAvaliacao}>
                            <View style={[styles.chipAvaliacaoCor, { backgroundColor: colors[STATUS_COR[a.status]] }]} />
                            <Text style={[type.caption, styles.chipAvaliacaoTexto]}>
                              {a.habilidadeNome} · {STATUS_LABEL[a.status]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bannerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTopoTexto: {
    flex: 1,
  },
  bannerTopoTag: {
    color: colors.primary,
    textTransform: 'uppercase',
  },
  bannerTopoImagem: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    resizeMode: 'contain',
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  linha: {
    flexDirection: 'row',
  },
  trilha: {
    width: 24,
    alignItems: 'center',
  },
  no: {
    borderRadius: radius.pill,
    marginTop: 2,
  },
  noAvaliacao: {
    width: 14,
    height: 14,
    backgroundColor: colors.primarySoft,
  },
  noNivel: {
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
  },
  conector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  conteudo: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  dataTexto: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  cartao: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cartaoNivel: {
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  chipsAvaliacao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipAvaliacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chipAvaliacaoCor: {
    width: 10,
    height: 10,
    borderRadius: radius.sm,
  },
  chipAvaliacaoTexto: {
    color: colors.text,
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
