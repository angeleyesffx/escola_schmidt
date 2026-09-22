import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../../src/features/auth/AuthProvider';
import { PageHeader } from '../../src/components/PageHeader';
import { Footer } from '../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../src/constants/theme';

// Vínculo por e-mail (supabase/migrations/0037) nasce pendente — antes de dar
// acesso à frequência/avaliações de um aluno, a própria conta precisa
// confirmar que é dela mesmo. app/(app)/_layout.tsx redireciona pra cá
// enquanto houver algum vínculo pendente; ao zerar a lista, volta sozinho
// pra Home.
export default function ConfirmarVinculo() {
  const router = useRouter();
  const { vinculosPendentes, vinculosPendentesCarregado, confirmarVinculo, recusarVinculo } = useAuth();
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (vinculosPendentesCarregado && vinculosPendentes.length === 0) {
      router.replace('/');
    }
  }, [vinculosPendentesCarregado, vinculosPendentes.length, router]);

  async function confirmar(alunoId: string) {
    setErro(null);
    setProcessandoId(alunoId);
    const { error } = await confirmarVinculo(alunoId);
    setProcessandoId(null);
    if (error) setErro('Não foi possível confirmar agora. Tente novamente.');
  }

  async function recusar(alunoId: string) {
    setErro(null);
    setProcessandoId(alunoId);
    const { error } = await recusarVinculo(alunoId);
    setProcessandoId(null);
    if (error) setErro('Não foi possível registrar sua resposta agora. Tente novamente.');
  }

  return (
    <>
      <PageHeader titulo="Confirmar vínculo" mostrarVoltar={false} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[type.body, styles.intro]}>
          A escola vinculou seu e-mail a um cadastro de aluno. Confirme se é você o responsável — só depois disso
          você passa a ver a frequência e a evolução dessa pessoa no app.
        </Text>

        {erro ? (
          <Text testID="confirmar-vinculo-erro" style={[type.body, styles.erro]}>
            {erro}
          </Text>
        ) : null}

        {!vinculosPendentesCarregado ? (
          <ActivityIndicator color={colors.primary} style={styles.carregando} />
        ) : (
          vinculosPendentes.map((vinculo) => {
            const processando = processandoId === vinculo.id;
            return (
              <View key={vinculo.id} style={styles.card}>
                <Text style={[type.subtitle, styles.nome]}>Você é responsável por {vinculo.nome}?</Text>
                <View style={styles.botoes}>
                  <TouchableOpacity
                    testID={`confirmar-vinculo-recusar-${vinculo.id}`}
                    style={[styles.botaoRecusar, processando && styles.botaoDesabilitado]}
                    onPress={() => recusar(vinculo.id)}
                    disabled={processando}
                  >
                    <Text style={styles.botaoRecusarTexto}>Não sou eu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`confirmar-vinculo-confirmar-${vinculo.id}`}
                    style={[styles.botaoConfirmar, processando && styles.botaoDesabilitado]}
                    onPress={() => confirmar(vinculo.id)}
                    disabled={processando}
                  >
                    {processando ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.botaoConfirmarTexto}>Sim, sou responsável</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  intro: {
    color: colors.textMuted,
  },
  erro: {
    color: colors.danger,
  },
  carregando: {
    marginTop: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  nome: {
    color: colors.text,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botaoRecusar: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoRecusarTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoConfirmar: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoConfirmarTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
});
