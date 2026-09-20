import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, type } from '../../../src/constants/theme';

export default function AgendarAula() {
  const router = useRouter();
  const { meuPapel } = useAuth();

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  return (
    <>
      <PageHeader titulo="Agendar aula" />
      <View style={styles.container}>
        <TouchableOpacity
          testID="agendar-opcao-particular"
          style={styles.card}
          onPress={() => router.push('/chamada/nova-particular')}
        >
          <Text style={type.subtitle}>Aula particular</Text>
          <Text style={[type.body, styles.cardTexto]}>
            Fora do horário regular. Só o horário livre que o professor cadastrou, com 1 aluno por vez.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="agendar-opcao-teste"
          style={styles.card}
          onPress={() => router.push('/chamada/nova-teste')}
        >
          <Text style={type.subtitle}>Aula teste</Text>
          <Text style={[type.body, styles.cardTexto]}>
            Dentro de um horário regular já existente na grade. Pode juntar mais de um aluno.
          </Text>
        </TouchableOpacity>
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
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTexto: {
    color: colors.textMuted,
  },
});
