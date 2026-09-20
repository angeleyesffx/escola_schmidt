import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAluno, getFrequenciaAluno, type RegistroFrequencia } from '../../../../src/features/alunos/api';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../../src/hooks/useAsyncData';
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

export default function FrequenciaAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { meuPapel, meuAluno } = useAuth();

  const { data, loading, error } = useAsyncData(
    async () => {
      const [dadosAluno, dadosFrequencia] = await Promise.all([getAluno(id), getFrequenciaAluno(id)]);
      return { aluno: dadosAluno, registros: dadosFrequencia };
    },
    [id],
    { onFocus: true, mensagemErro: 'Erro ao carregar frequência. Tente novamente.' }
  );
  const aluno = data?.aluno ?? null;
  const registros = data?.registros ?? [];

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
        <PageHeader titulo="Frequência" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  const presencas = registros.filter((r) => r.status === 'presente').length;
  const faltas = registros.filter((r) => r.status === 'falta').length;
  const justificadas = registros.filter((r) => r.status === 'falta_justificada').length;

  return (
    <>
      <PageHeader titulo={aluno?.nome ?? 'Frequência'} />
      <View style={styles.container}>
      <Text style={[type.body, styles.subtitle]}>Frequência</Text>

      {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

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

      <FlatList
        data={registros}
        keyExtractor={(item, index) => `${item.data}-${item.hora}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !error ? <Text style={[type.body, styles.subtitle]}>Nenhum registro de presença ainda.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={type.body}>
              {paraBR(item.data)} · {item.hora}
            </Text>
            <Text style={[type.label, { color: colors[COR_STATUS[item.status]] }]}>
              {ROTULO_STATUS[item.status]}
            </Text>
          </View>
        )}
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
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
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
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
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
});
