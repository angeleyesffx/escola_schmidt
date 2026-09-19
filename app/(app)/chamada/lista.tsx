import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAulasRecorrentesHoje, type AulaRecorrente } from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
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
  const { meuPapel } = useAuth();
  const [aulasHoje, setAulasHoje] = useState<AulaRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      setLoading(true);
      setError(null);

      getAulasRecorrentesHoje(new Date().getDay())
        .then((dados) => {
          if (ativo) setAulasHoje(dados);
        })
        .catch((err) => {
          console.error(err);
          if (ativo) setError('Erro ao carregar as turmas de hoje. Tente novamente.');
        })
        .finally(() => {
          if (ativo) setLoading(false);
        });

      return () => {
        ativo = false;
      };
    }, [])
  );

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  if (loading) {
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
              <Text style={styles.calendarioBotaoTexto}>Ver calendário</Text>
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
