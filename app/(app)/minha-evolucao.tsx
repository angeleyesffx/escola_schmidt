import { useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '../../src/constants/theme';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { EvolucaoScreen } from '../../src/features/evolucao/EvolucaoScreen';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { SeletorAluno } from '../../src/components/SeletorAluno';

export default function MinhaEvolucaoScreen() {
  const { meusAlunos, meuPapel, meusAlunosCarregado } = useAuth();
  const souAlunoOuResponsavel = meuPapel === 'aluno' || meuPapel === 'responsavel';
  // Papel e vínculo são independentes (docs/product/professor-como-aluno.md):
  // um professor/dono que também treina acessa por ter `meusAlunos`
  // preenchido, mesmo sem papel de aluno/responsável.
  const podeAcessar = souAlunoOuResponsavel || meusAlunos.length > 0;
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | null>(null);

  if (meuPapel === null || (podeAcessar && !meusAlunosCarregado)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!podeAcessar) {
    return <Redirect href="/" />;
  }

  if (meusAlunos.length === 0) {
    return (
      <>
        <PageHeader titulo="Minha Evolução" />
        <View style={styles.center}>
          <Text style={[type.body, styles.aviso]}>
            Seu cadastro ainda não foi vinculado a um aluno. Fale com a escola.
          </Text>
        </View>
        <Footer />
      </>
    );
  }

  const alunoAtivo = meusAlunos.find((a) => a.id === alunoSelecionadoId) ?? meusAlunos[0];

  return (
    <>
      {meusAlunos.length > 1 ? (
        <View style={styles.seletorWrap}>
          <SeletorAluno
            alunos={meusAlunos}
            selecionadoId={alunoAtivo.id}
            onSelecionar={setAlunoSelecionadoId}
            rotulo="Aluno"
          />
        </View>
      ) : null}
      <EvolucaoScreen alunoId={alunoAtivo.id} tituloPagina="Minha Evolução" nomeFallback={alunoAtivo.nome} />
    </>
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
  seletorWrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
});
