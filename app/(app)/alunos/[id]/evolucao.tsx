import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { EvolucaoScreen } from '../../../../src/features/evolucao/EvolucaoScreen';

export default function EvolucaoAlunoPorIdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { meuAluno, meuPapel, session } = useAuth();

  if (!meuPapel) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (meuPapel === 'aluno') {
    if (!meuAluno) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (meuAluno.id !== id) {
      return <Redirect href="/" />;
    }
  }

  return (
    <EvolucaoScreen
      alunoId={id}
      tituloPagina="Evolução do aluno"
      nomeFallback="Aluno"
      podeEditar={meuPapel === 'dono' || meuPapel === 'professor'}
      professorId={session?.user.id ?? null}
    />
  );
}