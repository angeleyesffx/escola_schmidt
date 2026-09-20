import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAulasRecorrentesHoje, getResponsabilidadesProfessor } from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function formatModulos(modulos: number[]) {
  return modulos.length === 1 ? `Módulo ${modulos[0]}` : `Módulos ${modulos.join(', ')}`;
}

export default function ListaChamada() {
  const router = useRouter();
  const { meuPapel, session } = useAuth();
  const souProfessor = meuPapel === 'professor';
  const { data, loading, error } = useAsyncData(() => getAulasRecorrentesHoje(new Date().getDay()), [], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar as turmas de hoje. Tente novamente.',
  });
  // Professor só vê, na lista de chamada, as turmas que assumiu em "Meus
  // módulos" — dono continua vendo a grade inteira. Espelha a RLS de
  // presenca_escrita (0022/0023): sem vínculo em professores_aula, a
  // chamada nem abriria de verdade, então nem faz sentido mostrar o atalho.
  const { data: responsabilidades, loading: loadingResponsabilidades } = useAsyncData(
    () => getResponsabilidadesProfessor(session!.user.id),
    [session?.user.id],
    { onFocus: true, enabled: souProfessor && Boolean(session?.user.id) }
  );
  const meusSlots = new Set((responsabilidades ?? []).map((r) => r.aula_recorrente_id));
  const aulasHoje = (data ?? []).filter((aula) => !souProfessor || meusSlots.has(aula.id));

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  if (loading || (souProfessor && loadingResponsabilidades)) {
    return (
      <>
        <PageHeader titulo="Lista de chamada" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Lista de chamada" />
      <View style={styles.container}>
        <Text style={[type.body, styles.subtitle]}>Turmas de hoje</Text>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        {!error && aulasHoje.length === 0 ? (
          <View style={styles.vazioCard}>
            <Text style={[type.body, styles.subtitle, styles.vazioTexto]}>
              Não há turmas agendadas na grade para hoje.
            </Text>
            <TouchableOpacity style={styles.calendarioBotao} onPress={() => router.push('/chamada')}>
              <Text style={styles.calendarioBotaoTexto}>Ver agenda</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.lista}>
            {aulasHoje.map((aula) => (
              <TouchableOpacity key={aula.id} style={styles.card} onPress={() => router.push(`/chamada/${aula.id}`)}>
                <Text style={type.subtitle}>{formatHora(aula.hora)}</Text>
                <Text style={[type.body, styles.cardSubtitle]}>{formatModulos(aula.modulos)}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  subtitle: {
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  vazioCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  vazioTexto: {
    textAlign: 'center',
  },
  calendarioBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarioBotaoTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  lista: {
    marginTop: spacing.lg,
    gap: spacing.md,
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
