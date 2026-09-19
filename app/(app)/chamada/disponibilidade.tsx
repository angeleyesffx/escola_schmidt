import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  criarDisponibilidade,
  excluirDisponibilidade,
  getDisponibilidadeProfessor,
  type DisponibilidadeParticular,
} from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

export default function DisponibilidadeParticularScreen() {
  const { meuPapel, session } = useAuth();

  const [diaSemana, setDiaSemana] = useState(1);
  const [hora, setHora] = useState('');
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeParticular[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      let ativo = true;
      setLoading(true);
      setError(null);

      getDisponibilidadeProfessor(session.user.id)
        .then((dados) => {
          if (ativo) setDisponibilidade(dados);
        })
        .catch((err) => {
          console.error(err);
          if (ativo) setError('Erro ao carregar seus horários livres. Tente novamente.');
        })
        .finally(() => {
          if (ativo) setLoading(false);
        });

      return () => {
        ativo = false;
      };
    }, [session?.user.id])
  );

  async function adicionar() {
    if (!session?.user.id) return;
    if (!/^\d{2}:\d{2}$/.test(hora.trim())) {
      setError('Hora deve estar no formato HH:MM.');
      return;
    }

    setSalvando(true);
    setError(null);
    try {
      await criarDisponibilidade(session.user.id, diaSemana, hora.trim());
      const atualizada = await getDisponibilidadeProfessor(session.user.id);
      setDisponibilidade(atualizada);
      setHora('');
    } catch (err: unknown) {
      console.error(err);
      const jaExiste =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      const mensagemPostgres = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '';
      setError(
        jaExiste
          ? 'Esse horário já está cadastrado.'
          : mensagemPostgres.includes('conflita com uma aula regular')
            ? 'Esse horário conflita com uma aula regular sua.'
            : 'Erro ao adicionar horário. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item: DisponibilidadeParticular) {
    setError(null);
    try {
      await excluirDisponibilidade(item.id);
      setDisponibilidade((atual) => atual.filter((d) => d.id !== item.id));
    } catch (err) {
      console.error(err);
      setError('Erro ao remover horário. Tente novamente.');
    }
  }

  if (meuPapel === 'aluno') {
    return <Redirect href="/" />;
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Horários livres" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Horários livres" />
      <View style={styles.container}>
        <Text style={[type.body, styles.subtitle]}>
          Cadastre os horários em que você está disponível pra dar aula particular. Só aparecem aqui os horários
          sem conflito com sua grade regular.
        </Text>

        <Text style={[type.label, styles.rotulo]}>Dia da semana</Text>
        <View style={styles.chips}>
          {DIAS_SEMANA.map((nome, indice) => (
            <TouchableOpacity
              key={nome}
              style={[styles.chip, diaSemana === indice && styles.chipAtivo]}
              onPress={() => setDiaSemana(indice)}
            >
              <Text style={[styles.chipTexto, diaSemana === indice && styles.chipTextoAtivo]}>{nome}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.label, styles.rotulo]}>Hora</Text>
        <View style={styles.adicionarRow}>
          <TextInput
            style={[styles.input, styles.inputHora]}
            value={hora}
            onChangeText={setHora}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity style={[styles.adicionarBotao, salvando && styles.botaoDesabilitado]} onPress={adicionar} disabled={salvando}>
            {salvando ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.adicionarBotaoTexto}>Adicionar</Text>}
          </TouchableOpacity>
        </View>

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        <Text style={[type.label, styles.rotulo]}>Seus horários livres</Text>
        {disponibilidade.length === 0 ? (
          <Text style={[type.body, styles.subtitle]}>Nenhum horário cadastrado ainda.</Text>
        ) : (
          <View style={styles.lista}>
            {disponibilidade.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={type.body}>
                  {DIAS_SEMANA[item.dia_semana]} · {formatHora(item.hora)}
                </Text>
                <TouchableOpacity style={styles.removerBotao} onPress={() => remover(item)}>
                  <Text style={styles.removerBotaoTexto}>Remover</Text>
                </TouchableOpacity>
              </View>
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
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
    color: colors.text,
  },
  chipTextoAtivo: {
    color: colors.onPrimary,
  },
  adicionarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  inputHora: {
    flex: 1,
  },
  adicionarBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  adicionarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  lista: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  removerBotao: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removerBotaoTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.label.fontSize,
  },
});
