import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '../../src/constants/theme';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { EvolucaoScreen } from '../../src/features/evolucao/EvolucaoScreen';

export default function MinhaEvolucaoScreen() {
  const { meuAluno, meuPapel } = useAuth();

  if (meuPapel === null || ((meuPapel === 'aluno' || meuPapel === 'responsavel') && !meuAluno)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (meuPapel !== 'aluno' && meuPapel !== 'responsavel') {
    return <Redirect href="/" />;
  }

  if (!meuAluno) {
    return null;
  }

  return <EvolucaoScreen alunoId={meuAluno.id} tituloPagina="Minha Evolução" nomeFallback={meuAluno.nome} />;
}