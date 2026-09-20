import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  desvincularPerfil,
  getAluno,
  getFrequenciaAluno,
  getPerfilVinculado,
  getPerfisNaoVinculados,
  vincularPerfil,
  type Aluno,
  type PerfilAluno,
  type RegistroFrequencia,
} from '../../../../src/features/alunos/api';
import {
  getAvaliacoesAluno,
  getHabilidades,
  getTestesNivelAluno,
  type AvaliacaoDesempenho,
  type Habilidade,
  type NivelDesempenho,
  type TesteNivel,
} from '../../../../src/features/desempenho/api';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { paraBR } from '../../../../src/lib/dataBR';
import { PageHeader } from '../../../../src/components/PageHeader';
import { Footer } from '../../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../../src/constants/theme';

const ROTULO_STATUS: Record<RegistroFrequencia['status'], string> = {
  presente: 'Presente',
  falta_justificada: 'Falta justificada',
  falta: 'Falta',
};

const COR_STATUS: Record<RegistroFrequencia['status'], 'present' | 'justified' | 'absent'> = {
  presente: 'present',
  falta_justificada: 'justified',
  falta: 'absent',
};

const NIVEIS: { nivel: NivelDesempenho; label: string; legenda: string; cor: 'absent' | 'onTrack' | 'present' }[] = [
  { nivel: 'precisa_melhorar', label: '!', legenda: 'Precisa melhorar', cor: 'absent' },
  { nivel: 'conforme_esperado', label: '✓', legenda: 'Conforme esperado', cor: 'onTrack' },
  { nivel: 'excelente', label: '★', legenda: 'Excelente', cor: 'present' },
];

type EventoTimeline =
  | { tipo: 'avaliacao'; data: string; itens: AvaliacaoDesempenho[] }
  | { tipo: 'teste'; data: string; teste: TesteNivel };

function montarTimeline(avaliacoes: AvaliacaoDesempenho[], testes: TesteNivel[]): EventoTimeline[] {
  const porData = new Map<string, AvaliacaoDesempenho[]>();
  for (const a of avaliacoes) {
    const lista = porData.get(a.data) ?? [];
    lista.push(a);
    porData.set(a.data, lista);
  }

  const eventos: EventoTimeline[] = [];
  porData.forEach((itens, data) => eventos.push({ tipo: 'avaliacao', data, itens }));
  testes.forEach((teste) => eventos.push({ tipo: 'teste', data: teste.data, teste }));

  eventos.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return eventos;
}

export default function AlunoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { meuPapel } = useAuth();

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [perfilVinculado, setPerfilVinculado] = useState<PerfilAluno | null>(null);
  const [candidatos, setCandidatos] = useState<PerfilAluno[]>([]);
  const [registrosFrequencia, setRegistrosFrequencia] = useState<RegistroFrequencia[]>([]);
  const [habilidades, setHabilidades] = useState<Habilidade[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDesempenho[]>([]);
  const [testes, setTestes] = useState<TesteNivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosAluno, dadosFrequencia, dadosHabilidades, dadosAvaliacoes, dadosTestes] = await Promise.all([
        getAluno(id),
        getFrequenciaAluno(id),
        getHabilidades(),
        getAvaliacoesAluno(id),
        getTestesNivelAluno(id),
      ]);
      setAluno(dadosAluno);
      setRegistrosFrequencia(dadosFrequencia);
      setHabilidades(dadosHabilidades);
      setAvaliacoes(dadosAvaliacoes);
      setTestes(dadosTestes);

      if (dadosAluno.perfil_id) {
        setPerfilVinculado(await getPerfilVinculado(dadosAluno.perfil_id));
        setCandidatos([]);
      } else {
        setPerfilVinculado(null);
        setCandidatos(await getPerfisNaoVinculados());
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar aluno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function vincular(perfilId: string) {
    if (!aluno) return;
    setProcessando(true);
    setError(null);
    try {
      await vincularPerfil(aluno.id, perfilId);
      await carregar();
    } catch (err) {
      console.error(err);
      setError('Erro ao vincular conta. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function desvincular() {
    if (!aluno) return;
    setProcessando(true);
    setError(null);
    try {
      await desvincularPerfil(aluno.id);
      await carregar();
    } catch (err) {
      console.error(err);
      setError('Erro ao desvincular conta. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Aluno" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const presencas = registrosFrequencia.filter((r) => r.status === 'presente').length;
  const faltas = registrosFrequencia.filter((r) => r.status === 'falta').length;
  const justificadas = registrosFrequencia.filter((r) => r.status === 'falta_justificada').length;

  const nomePorHabilidade = Object.fromEntries(habilidades.map((h) => [h.id, h.nome]));
  const eventosDesempenho = montarTimeline(avaliacoes, testes);

  return (
    <>
      <PageHeader titulo={aluno?.nome ?? 'Aluno'} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[type.body, styles.subtitle]}>
            Módulo {aluno?.modulo}
            {aluno && !aluno.ativo ? ' · Inativo' : ''}
          </Text>

          <View style={styles.atalhosEvolucao}>
            <TouchableOpacity style={styles.atalhoSecundario} onPress={() => router.push(`/alunos/${id}/evolucao`)}>
              <Text style={styles.atalhoSecundarioTexto}>Minha Evolução</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.atalhoSecundario} onPress={() => router.push(`/alunos/${id}/desempenho`)}>
              <Text style={styles.atalhoSecundarioTexto}>Jornada</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          <Text style={[type.label, styles.secao]}>Frequência</Text>
          <View style={styles.resumo}>
            <View style={styles.resumoItem}>
              <Text style={[type.title, { color: colors.present }]}>{presencas}</Text>
              <Text style={[type.caption, styles.resumoLabel]}>Presenças</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={[type.title, { color: colors.justified }]}>{justificadas}</Text>
              <Text style={[type.caption, styles.resumoLabel]}>Justificadas</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={[type.title, { color: colors.absent }]}>{faltas}</Text>
              <Text style={[type.caption, styles.resumoLabel]}>Faltas</Text>
            </View>
          </View>

          {registrosFrequencia.length === 0 ? (
            <Text style={[type.body, styles.subtitle, styles.vazio]}>Nenhum registro de presença ainda.</Text>
          ) : (
            <View style={styles.list}>
              {registrosFrequencia.map((item, index) => (
                <View key={`${item.data}-${item.hora}-${index}`} style={styles.row}>
                  <Text style={type.body}>
                    {paraBR(item.data)} · {item.hora}
                  </Text>
                  <Text style={[type.label, { color: colors[COR_STATUS[item.status]] }]}>
                    {ROTULO_STATUS[item.status]}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[type.label, styles.secao]}>Desempenho (histórico legado)</Text>
          <Text style={[type.body, styles.subtitle]}>
            Sistema descontinuado — novas avaliações e passagens de nível são feitas em Minha Evolução. O histórico
            abaixo fica preservado só para consulta.
          </Text>
          <View style={styles.legenda}>
            {NIVEIS.map((n) => (
              <View key={n.nivel} style={styles.legendaItem}>
                <View style={[styles.legendaCor, { backgroundColor: colors[n.cor] }]} />
                <Text style={[type.caption, styles.legendaTexto]}>{n.legenda}</Text>
              </View>
            ))}
          </View>

          <Text style={[type.label, styles.subsecao]}>Linha do tempo</Text>
          {eventosDesempenho.length === 0 ? (
            <Text style={[type.body, styles.subtitle, styles.vazio]}>Nenhuma avaliação registrada ainda.</Text>
          ) : (
            eventosDesempenho.map((item, index) => {
              const ultimo = index === eventosDesempenho.length - 1;
              const teste = item.tipo === 'teste';
              return (
                <View key={`${item.tipo}-${item.data}-${index}`} style={styles.linha}>
                  <View style={styles.trilha}>
                    <View style={[styles.no, teste ? styles.noTeste : styles.noAvaliacao]} />
                    {!ultimo ? <View style={styles.conector} /> : null}
                  </View>
                  <View style={styles.conteudo}>
                    <Text style={[type.caption, styles.dataTexto]}>{paraBR(item.data)}</Text>
                    {item.tipo === 'avaliacao' ? (
                      <View style={styles.cartao}>
                        <View style={styles.chipsAvaliacao}>
                          {item.itens.map((a) => {
                            const nivelInfo = NIVEIS.find((n) => n.nivel === a.nivel)!;
                            return (
                              <View key={a.id} style={styles.chipAvaliacao}>
                                <View style={[styles.chipAvaliacaoCor, { backgroundColor: colors[nivelInfo.cor] }]} />
                                <Text style={[type.caption, styles.chipAvaliacaoTexto]}>
                                  {nomePorHabilidade[a.habilidade_id] ?? 'Habilidade'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.cartao, styles.cartaoTeste]}>
                        <Text style={type.subtitle}>
                          Módulo {item.teste.modulo_de} → Módulo {item.teste.modulo_para}
                        </Text>
                        <Text style={[type.label, item.teste.aprovado ? styles.badgeAprovado : styles.badgeReprovado]}>
                          {item.teste.aprovado ? 'Aprovado' : 'Não aprovado'}
                        </Text>
                        {item.teste.observacoes ? (
                          <Text style={[type.body, styles.cardSubtitle]}>{item.teste.observacoes}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          <Text style={[type.label, styles.secao]}>Conta de acesso (responsável/aluno)</Text>

          {perfilVinculado ? (
            <View style={styles.vinculadoCard}>
              <Text style={type.subtitle}>{perfilVinculado.nome}</Text>
              {perfilVinculado.telefone ? (
                <Text style={[type.body, styles.cardSubtitle]}>{perfilVinculado.telefone}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.desvincularBotao, processando && styles.botaoDesabilitado]}
                onPress={desvincular}
                disabled={processando}
              >
                <Text style={styles.desvincularTexto}>Desvincular</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[type.body, styles.subtitle]}>
                Nenhuma conta vinculada. Escolha abaixo uma conta que já fez cadastro no app:
              </Text>
              {candidatos.length === 0 ? (
                <Text style={[type.body, styles.subtitle, styles.vazio]}>
                  Nenhuma conta aguardando vínculo no momento.
                </Text>
              ) : (
                <View style={styles.list}>
                  {candidatos.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.candidatoCard, processando && styles.botaoDesabilitado]}
                      onPress={() => vincular(item.id)}
                      disabled={processando}
                    >
                      <Text style={type.subtitle}>{item.nome}</Text>
                      {item.telefone ? <Text style={[type.body, styles.cardSubtitle]}>{item.telefone}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
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
  scroll: {
    paddingBottom: spacing.xl,
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
  atalhosEvolucao: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  atalhoSecundario: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  atalhoSecundarioTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subsecao: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  vazio: {
    marginTop: spacing.sm,
  },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  resumoItem: {
    flex: 1,
    alignItems: 'center',
  },
  resumoLabel: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendaCor: {
    width: 12,
    height: 12,
    borderRadius: radius.sm,
  },
  legendaTexto: {
    color: colors.textMuted,
  },
  botaoDesabilitado: {
    opacity: 0.6,
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
  noTeste: {
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
  cartaoTeste: {
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
  badgeAprovado: {
    color: colors.present,
  },
  badgeReprovado: {
    color: colors.absent,
  },
  vinculadoCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  desvincularBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  desvincularTexto: {
    color: colors.danger,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
  },
  candidatoCard: {
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
});
