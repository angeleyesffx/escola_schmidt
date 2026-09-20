import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  getAvaliacoesAluno,
  getHabilidades,
  getTestesNivelAluno,
  registrarAvaliacao,
  registrarTesteNivel,
  type AvaliacaoDesempenho,
  type Habilidade,
  type NivelDesempenho,
  type TesteNivel,
} from '../../../../src/features/desempenho/api';
import { getAluno, type Aluno } from '../../../../src/features/alunos/api';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { hojeBR, paraBR, paraISO } from '../../../../src/lib/dataBR';
import { PageHeader } from '../../../../src/components/PageHeader';
import { Footer } from '../../../../src/components/Footer';
import { Chip } from '../../../../src/components/Chip';
import { colors, radius, spacing, touchTarget, type } from '../../../../src/constants/theme';

const NIVEIS: { nivel: NivelDesempenho; label: string; legenda: string; cor: 'absent' | 'onTrack' | 'present' }[] = [
  { nivel: 'precisa_melhorar', label: '!', legenda: 'Precisa melhorar', cor: 'absent' },
  { nivel: 'conforme_esperado', label: '✓', legenda: 'Conforme esperado', cor: 'onTrack' },
  { nivel: 'excelente', label: '★', legenda: 'Excelente', cor: 'present' },
];

const MODULOS = [1, 2, 3, 4] as const;

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

export default function DesempenhoAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, meuPapel, meuAluno } = useAuth();
  const podeEditar = meuPapel === 'dono' || meuPapel === 'professor';

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [habilidades, setHabilidades] = useState<Habilidade[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDesempenho[]>([]);
  const [testes, setTestes] = useState<TesteNivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dataAvaliacao, setDataAvaliacao] = useState(hojeBR());

  const [mostrarTeste, setMostrarTeste] = useState(false);
  const [moduloDestino, setModuloDestino] = useState<number>(1);
  const [aprovado, setAprovado] = useState(true);
  const [obsTeste, setObsTeste] = useState('');
  const [salvandoTeste, setSalvandoTeste] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosAluno, dadosHabilidades, dadosAvaliacoes, dadosTestes] = await Promise.all([
        getAluno(id),
        getHabilidades(),
        getAvaliacoesAluno(id),
        getTestesNivelAluno(id),
      ]);
      setAluno(dadosAluno);
      setHabilidades(dadosHabilidades);
      setAvaliacoes(dadosAvaliacoes);
      setTestes(dadosTestes);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar desempenho. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  function nivelAtual(habilidadeId: string): NivelDesempenho | undefined {
    const dataISO = paraISO(dataAvaliacao);
    if (!dataISO) return undefined;
    return avaliacoes.find((a) => a.habilidade_id === habilidadeId && a.data === dataISO)?.nivel;
  }

  async function marcarHabilidade(habilidadeId: string, nivel: NivelDesempenho) {
    const dataISO = paraISO(dataAvaliacao);
    if (!dataISO) {
      setError('Data inválida. Use o formato DD/MM/AAAA.');
      return;
    }
    setError(null);
    const anterior = avaliacoes;
    const semEssaHabilidade = avaliacoes.filter(
      (a) => !(a.habilidade_id === habilidadeId && a.data === dataISO)
    );
    setAvaliacoes([
      ...semEssaHabilidade,
      { id: `local-${habilidadeId}-${dataISO}`, habilidade_id: habilidadeId, data: dataISO, nivel, observacoes: null },
    ]);
    try {
      await registrarAvaliacao(id, habilidadeId, dataISO, nivel, null, session?.user.id ?? null);
    } catch (err) {
      console.error(err);
      setAvaliacoes(anterior);
      setError('Erro ao salvar avaliação. Tente novamente.');
    }
  }

  function abrirFormularioTeste() {
    setModuloDestino(Math.min((aluno?.modulo ?? 1) + 1, 4));
    setAprovado(true);
    setObsTeste('');
    setMostrarTeste((atual) => !atual);
  }

  async function salvarTeste() {
    if (!aluno) return;
    setSalvandoTeste(true);
    setError(null);
    try {
      await registrarTesteNivel(
        aluno.id,
        aluno.modulo,
        moduloDestino,
        aprovado,
        obsTeste.trim() || null,
        session?.user.id ?? null
      );
      setMostrarTeste(false);
      await carregar();
    } catch (err) {
      console.error(err);
      setError('Erro ao registrar teste de nível. Tente novamente.');
    } finally {
      setSalvandoTeste(false);
    }
  }

  if (meuPapel === 'aluno') {
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
        <PageHeader titulo="Desempenho" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const nomePorHabilidade = Object.fromEntries(habilidades.map((h) => [h.id, h.nome]));
  const eventos = montarTimeline(avaliacoes, testes);

  const cabecalho = (
    <View>
      <View style={styles.bannerTopo}>
        <View style={styles.bannerTopoTexto}>
          <Text style={[type.label, styles.bannerTopoTag]}>Desempenho</Text>
          <Text style={type.subtitle}>Evolução técnica</Text>
          <Text style={[type.caption, styles.subtitle]}>Acompanhe habilidades, testes e progressão.</Text>
        </View>
        <Image source={require('../../../../assets/cards/card-desempenho.png')} style={styles.bannerTopoImagem} />
      </View>

      <Text style={[type.body, styles.subtitle]}>Módulo {aluno?.modulo} · Desempenho</Text>

      {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

      <View style={styles.legenda}>
        {NIVEIS.map((n) => (
          <View key={n.nivel} style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: colors[n.cor] }]} />
            <Text style={[type.caption, styles.legendaTexto]}>{n.legenda}</Text>
          </View>
        ))}
      </View>

      {podeEditar ? (
        <View style={styles.edicao}>
          <Text style={[type.label, styles.secao]}>Avaliar habilidades</Text>
          <TextInput
            style={styles.input}
            value={dataAvaliacao}
            onChangeText={setDataAvaliacao}
            placeholder="DD/MM/AAAA"
            keyboardType="numbers-and-punctuation"
          />

          {habilidades.map((h) => {
            const atual = nivelAtual(h.id);
            return (
              <View key={h.id} style={styles.habilidadeRow}>
                <Text style={[type.body, styles.habilidadeNome]} numberOfLines={2}>
                  {h.nome}
                </Text>
                <View style={styles.botoes}>
                  {NIVEIS.map((n) => {
                    const ativo = atual === n.nivel;
                    return (
                      <TouchableOpacity
                        key={n.nivel}
                        style={[styles.botao, { backgroundColor: ativo ? colors[n.cor] : colors.pending }]}
                        onPress={() => marcarHabilidade(h.id, n.nivel)}
                      >
                        <Text style={styles.botaoTexto}>{n.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.testeBotao} onPress={abrirFormularioTeste}>
            <Text style={styles.testeBotaoTexto}>
              {mostrarTeste ? 'Cancelar passagem de nível' : 'Registrar passagem de nível'}
            </Text>
          </TouchableOpacity>

          {mostrarTeste ? (
            <View style={styles.testeForm}>
              <Text style={[type.label, styles.secao]}>Módulo destino</Text>
              <View style={styles.chips}>
                {MODULOS.map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    active={moduloDestino === m}
                    onPress={() => setModuloDestino(m)}
                    variant="background"
                    square
                  />
                ))}
              </View>

              <View style={styles.chips}>
                <Chip
                  label="Aprovado"
                  active={aprovado}
                  onPress={() => setAprovado(true)}
                  variant="background"
                  square
                />
                <Chip
                  label="Não aprovado"
                  active={!aprovado}
                  onPress={() => setAprovado(false)}
                  variant="background"
                  square
                />
              </View>

              <TextInput
                style={styles.input}
                value={obsTeste}
                onChangeText={setObsTeste}
                placeholder="Observações (opcional)"
              />

              <TouchableOpacity
                style={[styles.salvarBotao, salvandoTeste && styles.botaoDesabilitado]}
                onPress={salvarTeste}
                disabled={salvandoTeste}
              >
                {salvandoTeste ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.salvarBotaoTexto}>Salvar teste de nível</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[type.label, styles.secao]}>Linha do tempo</Text>
    </View>
  );

  return (
    <>
      <PageHeader titulo={aluno?.nome ?? 'Desempenho'} />
      <View style={styles.container}>
      <FlatList
        data={eventos}
        keyExtractor={(item, index) => `${item.tipo}-${item.data}-${index}`}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[type.body, styles.subtitle]}>Nenhuma avaliação registrada ainda.</Text>}
        renderItem={({ item, index }) => {
          const ultimo = index === eventos.length - 1;
          const teste = item.tipo === 'teste';
          return (
            <View style={styles.linha}>
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
    marginBottom: spacing.xs,
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
  legenda: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
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
  secao: {
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  edicao: {
    marginTop: spacing.sm,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    marginBottom: spacing.md,
  },
  habilidadeRow: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  habilidadeNome: {
    flex: 1,
    marginRight: spacing.sm,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  testeBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  testeBotaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  testeForm: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  salvarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
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
});
