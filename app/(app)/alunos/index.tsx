import { useMemo, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { getAlunos, type Aluno } from '../../../src/features/alunos/api';
import { getGradeSemanal, getModulosAtivos, type Modulo } from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { normalizar } from '../../../src/lib/texto';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
type FiltroStatus = 'todos' | 'ativos' | 'inativos';

export default function AlunosIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const { width } = useWindowDimensions();
  const usarListaCompacta = width < 900;
  const [busca, setBusca] = useState('');
  const [moduloFiltro, setModuloFiltro] = useState<number | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('todos');

  const {
    data,
    loading,
    error,
  } = useAsyncData(getAlunos, [], { onFocus: true, mensagemErro: 'Erro ao carregar alunos. Tente novamente.' });
  const alunos = data ?? [];

  // Horário de cada módulo, pra dar contexto no topo de cada lane — não
  // precisa recarregar toda vez que a tela ganha foco, a grade quase não muda.
  const { data: dadosGrade } = useAsyncData(getGradeSemanal, []);
  const grade = dadosGrade ?? [];

  const { data: dadosModulos } = useAsyncData<Modulo[]>(getModulosAtivos, []);
  const modulos = dadosModulos ?? [];

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
    for (const m of modulos) mapa.set(m.numero, []);
    for (const aluno of alunosFiltrados) {
      mapa.get(aluno.modulo)?.push(aluno);
    }
    return mapa;
  }, [alunosFiltrados, modulos]);

  function horariosDoModulo(modulo: number) {
    return grade
      .filter((a) => a.modulos.includes(modulo))
      .map((a) => `${DIAS_CURTOS[a.dia_semana]} ${a.hora.slice(0, 5)}`)
      .join(' · ');
  }

  const filtrosAtivos = busca.trim() !== '' || moduloFiltro !== null || statusFiltro !== 'todos';
  const modulosVisiveis =
    moduloFiltro !== null ? modulos.filter((m) => m.numero === moduloFiltro) : modulos;
  const nomeModulo = new Map(modulos.map((modulo) => [modulo.numero, modulo.nome]));

  function limparFiltros() {
    setBusca('');
    setModuloFiltro(null);
    setStatusFiltro('todos');
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
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
            accessibilityRole="button"
            accessibilityState={{ selected: statusFiltro === 'ativos' }}
          >
            <Text style={[styles.chipTexto, statusFiltro === 'ativos' && styles.chipTextoAtivo]}>Ativos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, statusFiltro === 'inativos' && styles.chipAtivo]}
            onPress={() => setStatusFiltro(statusFiltro === 'inativos' ? 'todos' : 'inativos')}
            accessibilityRole="button"
            accessibilityState={{ selected: statusFiltro === 'inativos' }}
          >
            <Text style={[styles.chipTexto, statusFiltro === 'inativos' && styles.chipTextoAtivo]}>Inativos</Text>
          </TouchableOpacity>
          {modulos.map((m) => (
            <TouchableOpacity
              key={m.numero}
              style={[styles.chip, moduloFiltro === m.numero && styles.chipAtivo]}
              onPress={() => setModuloFiltro(moduloFiltro === m.numero ? null : m.numero)}
              accessibilityRole="button"
              accessibilityState={{ selected: moduloFiltro === m.numero }}
            >
              <Text style={[styles.chipTexto, moduloFiltro === m.numero && styles.chipTextoAtivo]}>{m.nome}</Text>
            </TouchableOpacity>
          ))}
          {filtrosAtivos ? (
            <TouchableOpacity style={styles.limparBotao} onPress={limparFiltros}>
              <Text style={[type.label, styles.limparBotaoTexto]}>Limpar</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        {usarListaCompacta ? (
          <FlatList
            style={styles.listaCompacta}
            data={alunosFiltrados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listaCompactaConteudo}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[type.body, styles.subtitle, styles.laneVazia]}>
                {filtrosAtivos ? 'Nenhum aluno com esses filtros.' : 'Nenhum aluno cadastrado.'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.cardCompacto} onPress={() => router.push(`/alunos/${item.id}`)}>
                <View style={styles.cardCompactoTopo}>
                  <Text style={type.subtitle} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={[type.caption, styles.cardCompactoModulo]}>
                    {nomeModulo.get(item.modulo) ?? `Módulo ${item.modulo}`}
                  </Text>
                </View>
                <Text style={[type.body, styles.cardSubtitle]}>
                  {!item.ativo ? 'Inativo' : 'Ativo'}
                  {item.perfil_id ? ' · Conta vinculada' : ''}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <ScrollView
            horizontal
            style={styles.lanesScroll}
            contentContainerStyle={styles.lanesRow}
            showsHorizontalScrollIndicator={false}
          >
            {modulosVisiveis.map((m) => {
              const alunosDoModulo = alunosPorModulo.get(m.numero) ?? [];
              const horarios = horariosDoModulo(m.numero);
              return (
                <View key={m.numero} style={[styles.lane, moduloFiltro !== null && styles.laneUnica]}>
                  <View style={styles.laneHeader}>
                    <Text style={type.subtitle}>{m.nome}</Text>
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
                        <TouchableOpacity key={item.id} style={styles.card} onPress={() => router.push(`/alunos/${item.id}`)}>
                          <Text style={type.subtitle} numberOfLines={1}>{item.nome}</Text>
                          <Text style={[type.body, styles.cardSubtitle]}>
                            {!item.ativo ? 'Inativo' : 'Ativo'}{item.perfil_id ? ' · Conta vinculada' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>
        )}
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
  listaCompacta: {
    flex: 1,
    marginTop: spacing.lg,
  },
  listaCompactaConteudo: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  cardCompacto: {
    minHeight: touchTarget + spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardCompactoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardCompactoModulo: {
    color: colors.primary,
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
