import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import {
  atualizarAtivoAluno,
  getAluno,
  getFrequenciaAluno,
  type Aluno,
  type RegistroFrequencia,
} from '../../../../src/features/alunos/api';
import { useAuth } from '../../../../src/features/auth/AuthProvider';
import { paraBR } from '../../../../src/lib/dataBR';
import { PageHeader } from '../../../../src/components/PageHeader';
import { Footer } from '../../../../src/components/Footer';
import { WebModal } from '../../../../src/components/WebModal';
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

export default function AlunoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { meuPapel } = useAuth();
  const souDono = meuPapel === 'dono';

  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [alternandoAtivo, setAlternandoAtivo] = useState(false);
  const [registrosFrequencia, setRegistrosFrequencia] = useState<RegistroFrequencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dadosAluno, dadosFrequencia] = await Promise.all([
        getAluno(id),
        getFrequenciaAluno(id),
      ]);
      setAluno(dadosAluno);
      setRegistrosFrequencia(dadosFrequencia);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar aluno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function alternarAtivoAluno() {
    if (!aluno) return;
    setAlternandoAtivo(true);
    setError(null);
    try {
      const novoValor = !aluno.ativo;
      await atualizarAtivoAluno(aluno.id, novoValor);
      setAluno({ ...aluno, ativo: novoValor });
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar matrícula. Tente novamente.');
    } finally {
      setAlternandoAtivo(false);
    }
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <WebModal>
        <PageHeader titulo="Aluno" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </WebModal>
    );
  }

  const presencas = registrosFrequencia.filter((r) => r.status === 'presente').length;
  const faltas = registrosFrequencia.filter((r) => r.status === 'falta').length;
  const justificadas = registrosFrequencia.filter((r) => r.status === 'falta_justificada').length;

  return (
    <WebModal>
      <PageHeader titulo={aluno?.nome ?? 'Aluno'} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.matriculaRow}>
            <Text style={[type.body, styles.subtitle]}>
              Módulo {aluno?.modulo}
              {aluno && !aluno.ativo ? ' · Inativo' : ''}
            </Text>
            {souDono && aluno ? (
              <View style={styles.matriculaToggle}>
                <Text style={[type.caption, styles.subtitle]}>Matrícula ativa</Text>
                <Switch
                  testID="aluno-detalhe-matricula-ativa"
                  value={aluno.ativo}
                  onValueChange={alternarAtivoAluno}
                  disabled={alternandoAtivo}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.atalhosEvolucao}>
            <TouchableOpacity style={styles.atalhoSecundario} onPress={() => router.push(`/alunos/${id}/evolucao`)}>
              <Text style={styles.atalhoSecundarioTexto}>Minha Evolução</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.atalhoSecundario} onPress={() => router.push(`/alunos/${id}/desempenho`)}>
              <Text style={styles.atalhoSecundarioTexto}>Jornada</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

          <Text style={[type.label, styles.secao]}>Frequência</Text>
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

          {registrosFrequencia.length === 0 ? (
            <Text style={[type.body, styles.subtitle, styles.vazio]}>Nenhum registro de presença ainda.</Text>
          ) : (
            <View style={styles.list}>
              {registrosFrequencia.map((item, index) => (
                <View key={`${item.data}-${item.hora}-${index}`} style={styles.row}>
                  <Text style={type.body}>
                    {paraBR(item.data)} · {item.hora}
                  </Text>
                  <Text style={[type.label, { color: colors[COR_STATUS[item.status]] }]}>
                    {ROTULO_STATUS[item.status]}
                  </Text>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </View>
      <Footer />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  scroll: {
    paddingBottom: spacing.xl,
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
  matriculaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  matriculaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  atalhosEvolucao: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  atalhoSecundario: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  atalhoSecundarioTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  secao: {
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  vazio: {
    marginTop: spacing.sm,
  },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
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
    marginTop: spacing.md,
    gap: spacing.sm,
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
