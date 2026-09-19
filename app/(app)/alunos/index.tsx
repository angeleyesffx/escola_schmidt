import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { getAlunos, type Aluno } from '../../../src/features/alunos/api';
import { getGradeSemanal, type AulaRecorrente } from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const MODULOS = [1, 2, 3, 4] as const;
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
type FiltroStatus = 'todos' | 'ativos' | 'inativos';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export default function AlunosIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [grade, setGrade] = useState<AulaRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState<number | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('todos');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setLoading(true);
      setError(null);

      getAlunos()
        .then((dados) => {
          if (ativo) setAlunos(dados);
        })
        .catch((err) => {
          console.error(err);
          if (ativo) setError('Erro ao carregar alunos. Tente novamente.');
        })
        .finally(() => {
          if (ativo) setLoading(false);
        });

      return () => {
        ativo = false;
      };
    }, [])
  );

  // Horário de cada módulo, pra dar contexto no topo de cada lane — não
  // precisa recarregar toda vez que a tela ganha foco, a grade quase não muda.
  useEffect(() => {
    let ativo = true;
    getGradeSemanal()
      .then((dados) => {
        if (ativo) setGrade(dados);
      })
      .catch((err) => console.error(err));
    return () => {
      ativo = false;
    };
  }, []);

  const alunosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return alunos.filter((item) => {
      if (termo && !normalizar(item.nome).includes(termo)) return false;
      if (moduloFiltro !== null && item.modulo !== moduloFiltro) return false;
      if (statusFiltro === 'ativos' && !item.ativo) return false;
      if (statusFiltro === 'inativos' && item.ativo) return false;
      return true;
    });
  }, [alunos, busca, moduloFiltro, statusFiltro]);

  const alunosPorModulo = useMemo(() => {
    const mapa = new Map<number, Aluno[]>();
    for (const m of MODULOS) mapa.set(m, []);
    for (const aluno of alunosFiltrados) {
      mapa.get(aluno.modulo)?.push(aluno);
    }
    return mapa;
  }, [alunosFiltrados]);

  function horariosDoModulo(modulo: number) {
    return grade
      .filter((a) => a.modulos.includes(modulo))
      .map((a) => `${DIAS_CURTOS[a.dia_semana]} ${a.hora.slice(0, 5)}`)
      .join(' · ');
  }

  const filtrosAtivos = busca.trim() !== '' || moduloFiltro !== null || statusFiltro !== 'todos';
  const modulosVisiveis = moduloFiltro !== null ? [moduloFiltro] : MODULOS;

  function limparFiltros() {
    setBusca('');
    setModuloFiltro(null);
    setStatusFiltro('todos');
  }

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Alunos" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Alunos" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[type.body, styles.subtitle]}>
            {alunosFiltrados.length} de {alunos.length} cadastrados
          </Text>
          <TouchableOpacity style={styles.novoBotao} onPress={() => router.push('/alunos/novo')}>
            <Text style={styles.novoBotaoTexto}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        <View style={styles.filtros}>
          <TouchableOpacity
            style={[styles.chip, statusFiltro === 'ativos' && styles.chipAtivo]}
            onPress={() => setStatusFiltro(statusFiltro === 'ativos' ? 'todos' : 'ativos')}
          >
            <Text style={[styles.chipTexto, statusFiltro === 'ativos' && styles.chipTextoAtivo]}>Ativos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, statusFiltro === 'inativos' && styles.chipAtivo]}
            onPress={() => setStatusFiltro(statusFiltro === 'inativos' ? 'todos' : 'inativos')}
          >
            <Text style={[styles.chipTexto, statusFiltro === 'inativos' && styles.chipTextoAtivo]}>Inativos</Text>
          </TouchableOpacity>
          {MODULOS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, moduloFiltro === m && styles.chipAtivo]}
              onPress={() => setModuloFiltro(moduloFiltro === m ? null : m)}
            >
              <Text style={[styles.chipTexto, moduloFiltro === m && styles.chipTextoAtivo]}>Módulo {m}</Text>
            </TouchableOpacity>
          ))}
          {filtrosAtivos ? (
            <TouchableOpacity style={styles.limparBotao} onPress={limparFiltros}>
              <Text style={[type.label, styles.limparBotaoTexto]}>Limpar</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        <ScrollView
          horizontal
          style={styles.lanesScroll}
          contentContainerStyle={styles.lanesRow}
          showsHorizontalScrollIndicator={false}
        >
          {modulosVisiveis.map((m) => {
            const alunosDoModulo = alunosPorModulo.get(m) ?? [];
            const horarios = horariosDoModulo(m);
            return (
              <View key={m} style={[styles.lane, moduloFiltro !== null && styles.laneUnica]}>
                <View style={styles.laneHeader}>
                  <Text style={type.subtitle}>Módulo {m}</Text>
                  <Text style={[type.caption, styles.laneHorarios]} numberOfLines={2}>
                    {horarios || 'Sem horário na grade'}
                  </Text>
                </View>
                <ScrollView contentContainerStyle={styles.laneLista}>
                  {alunosDoModulo.length === 0 ? (
                    <Text style={[type.body, styles.subtitle, styles.laneVazia]}>
                      {filtrosAtivos ? 'Nenhum aluno com esses filtros.' : 'Nenhum aluno neste módulo.'}
                    </Text>
                  ) : (
                    alunosDoModulo.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.card}
                        onPress={() => router.push(`/alunos/${item.id}`)}
                      >
                        <Text style={type.subtitle} numberOfLines={1}>
                          {item.nome}
                        </Text>
                        <Text style={[type.body, styles.cardSubtitle]}>
                          {!item.ativo ? 'Inativo' : 'Ativo'}
                          {item.perfil_id ? ' · Conta vinculada' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  novoBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  busca: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
    marginTop: spacing.lg,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  chip: {
    minHeight: touchTarget - 16,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontFamily: type.label.fontFamily,
    fontSize: type.label.fontSize,
    color: colors.text,
  },
  chipTextoAtivo: {
    color: colors.onPrimary,
  },
  limparBotao: {
    minHeight: touchTarget - 16,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limparBotaoTexto: {
    color: colors.primary,
  },
  lanesScroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  lanesRow: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  lane: {
    width: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  laneUnica: {
    width: 340,
  },
  laneHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  laneHorarios: {
    color: colors.primary,
    marginTop: 2,
  },
  laneLista: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  laneVazia: {
    marginTop: spacing.sm,
  },
  card: {
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  cardSubtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
