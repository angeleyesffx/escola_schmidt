import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { EvolucaoScreen } from '../../../../src/features/evolucao/EvolucaoScreen';
import { PageHeader } from '../../../../src/components/PageHeader';
import { Footer } from '../../../../src/components/Footer';
import { WebModal } from '../../../../src/components/WebModal';

export default function EvolucaoAlunoPorIdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meusAlunos, meuPapel, meusAlunosCarregado, session } = useAuth();
  const souAlunoOuResponsavel = meuPapel === 'aluno' || meuPapel === 'responsavel';

  if (!meuPapel || (souAlunoOuResponsavel && !meusAlunosCarregado)) {
    return (
      <WebModal>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </WebModal>
    );
  }

  if (souAlunoOuResponsavel) {
    if (meusAlunos.length === 0) {
      return (
        <WebModal>
          <PageHeader titulo="Evolução do aluno" />
          <View style={styles.center}>
            <Text style={[type.body, styles.aviso]}>
              Seu cadastro ainda não foi vinculado a um aluno. Fale com a escola.
            </Text>
          </View>
          <Footer />
        </WebModal>
      );
    }
    // Vários filhos vinculados: acesso é por vínculo com ESTE id da URL, não
    // "sou aluno/responsavel" sozinho — senão daria pra ver a evolução de
    // um filho de outra família só trocando o id.
    if (!meusAlunos.some((a) => a.id === id)) {
      return <Redirect href="/" />;
    }
  }

  return (
    <WebModal>
      <EvolucaoScreen
        alunoId={id}
        tituloPagina="Evolução do aluno"
        nomeFallback="Aluno"
        podeEditar={meuPapel === 'dono' || meuPapel === 'professor'}
        professorId={session?.user.id ?? null}
      />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  aviso: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
