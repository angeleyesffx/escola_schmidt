import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  atualizarSlotGrade,
  criarSlotGrade,
  excluirSlotGrade,
  getGradeCompleta,
  getUsoSlotGrade,
  type SlotGradeAdmin,
} from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Grade semanal (dono-only) — docs/product/papeis-e-permissoes.md §6.4.
// Até aqui só dava pra criar/editar um horário fixo da semana rodando SQL
// direto; a RLS já era dono-only desde 0001, só faltava a tela.

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MODULOS = [1, 2, 3, 4] as const;

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function formatModulos(modulos: number[]) {
  return modulos.length === 1 ? `Módulo ${modulos[0]}` : `Módulos ${[...modulos].sort().join(', ')}`;
}

export default function GradeSemanalAdmin() {
  const { meuPapel } = useAuth();
  const souDono = meuPapel === 'dono';

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [usoPorSlot, setUsoPorSlot] = useState<Record<string, { aulas: number; aulasTeste: number } | undefined>>({});
  const [verificandoUso, setVerificandoUso] = useState<string | null>(null);

  const [diaNovoSlot, setDiaNovoSlot] = useState<number | null>(null);
  const [horaNovoSlot, setHoraNovoSlot] = useState('');
  const [modulosNovoSlot, setModulosNovoSlot] = useState<number[]>([]);

  const { data: grade, loading, reload: recarregar } = useAsyncData<SlotGradeAdmin[]>(getGradeCompleta, [], {
    mensagemErro: 'Erro ao carregar a grade. Tente novamente.',
  });

  if (!souDono) {
    return <Redirect href="/" />;
  }

  function alternarModulo(m: number) {
    setModulosNovoSlot((atual) => (atual.includes(m) ? atual.filter((x) => x !== m) : [...atual, m].sort()));
  }

  async function adicionarSlot() {
    if (diaNovoSlot === null) {
      setErro('Escolha o dia da semana.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(horaNovoSlot.trim())) {
      setErro('Hora deve estar no formato HH:MM.');
      return;
    }
    if (modulosNovoSlot.length === 0) {
      setErro('Escolha ao menos um módulo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarSlotGrade(diaNovoSlot, `${horaNovoSlot.trim()}:00`, modulosNovoSlot);
      setHoraNovoSlot('');
      setModulosNovoSlot([]);
      await recarregar();
    } catch (err: unknown) {
      console.error(err);
      const duplicado =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      setErro(duplicado ? 'Já existe um horário nesse dia e hora.' : 'Erro ao criar horário. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(slot: SlotGradeAdmin) {
    setErro(null);
    try {
      await atualizarSlotGrade(slot.id, { ativo: !slot.ativo });
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar horário. Tente novamente.');
    }
  }

  async function verificarUso(slotId: string) {
    setVerificandoUso(slotId);
    setErro(null);
    try {
      const uso = await getUsoSlotGrade(slotId);
      setUsoPorSlot((atual) => ({ ...atual, [slotId]: uso }));
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso do horário. Tente novamente.');
    } finally {
      setVerificandoUso(null);
    }
  }

  async function excluir(slotId: string) {
    setErro(null);
    try {
      await excluirSlotGrade(slotId);
      await recarregar();
    } catch (err) {
      console.error(err);
      setErro('Erro ao excluir horário. Tente novamente.');
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader titulo="Grade semanal" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Grade semanal" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.explicacao}>
          Horários fixos da semana. Um horário com chamada ou aula teste já registrada só pode ser desativado — pra
          não perder o histórico. Sem nenhum uso, dá pra excluir de verdade.
        </Text>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {(grade ?? []).map((slot) => {
          const uso = usoPorSlot[slot.id];
          const temUso = uso && (uso.aulas > 0 || uso.aulasTeste > 0);
          const semUsoConfirmado = uso && uso.aulas === 0 && uso.aulasTeste === 0;
          return (
            <View key={slot.id} style={styles.itemCard}>
              <View style={styles.itemTopo}>
                <View style={styles.itemTextoWrap}>
                  <Text style={[type.body, !slot.ativo && styles.inativo]}>
                    {DIAS_SEMANA[slot.dia_semana]} · {formatHora(slot.hora)}
                  </Text>
                  <Text style={type.caption}>{formatModulos(slot.modulos)}</Text>
                </View>
                <Switch value={slot.ativo} onValueChange={() => alternarAtivo(slot)} />
              </View>

              {uso ? (
                <Text style={styles.usoTexto}>
                  {temUso
                    ? `Em uso: ${uso.aulas} chamada(s), ${uso.aulasTeste} aula(s) teste — só desativar.`
                    : 'Sem uso registrado — pode excluir.'}
                </Text>
              ) : null}

              <View style={styles.itemAcoes}>
                {!uso ? (
                  <TouchableOpacity onPress={() => verificarUso(slot.id)} disabled={verificandoUso === slot.id}>
                    {verificandoUso === slot.id ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={styles.linkTexto}>Verificar se pode excluir</Text>
                    )}
                  </TouchableOpacity>
                ) : semUsoConfirmado ? (
                  <TouchableOpacity onPress={() => excluir(slot.id)}>
                    <Text style={styles.excluirTexto}>Excluir</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={styles.formCard}>
          <Text style={styles.formTitulo}>Novo horário</Text>

          <Text style={[type.label, styles.campoRotulo]}>Dia da semana</Text>
          <View style={styles.chipsRow}>
            {DIAS_SEMANA.map((nome, indice) => (
              <TouchableOpacity
                key={nome}
                testID={`grade-dia-${indice}`}
                style={[styles.chip, diaNovoSlot === indice && styles.chipAtivo]}
                onPress={() => setDiaNovoSlot(indice)}
              >
                <Text style={[styles.chipTexto, diaNovoSlot === indice && styles.chipTextoAtivo]}>
                  {nome.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[type.label, styles.campoRotulo]}>Hora</Text>
          <TextInput
            testID="grade-hora-input"
            style={styles.input}
            value={horaNovoSlot}
            onChangeText={setHoraNovoSlot}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[type.label, styles.campoRotulo]}>Módulos</Text>
          <View style={styles.chipsRow}>
            {MODULOS.map((m) => (
              <TouchableOpacity
                key={m}
                testID={`grade-modulo-${m}`}
                style={[styles.chip, modulosNovoSlot.includes(m) && styles.chipAtivo]}
                onPress={() => alternarModulo(m)}
              >
                <Text style={[styles.chipTexto, modulosNovoSlot.includes(m) && styles.chipTextoAtivo]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            testID="grade-adicionar"
            style={[styles.botao, salvando && styles.botaoDesabilitado]}
            onPress={adicionarSlot}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.botaoTexto}>Adicionar horário</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Footer />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  explicacao: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  erro: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  itemCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTextoWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  inativo: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  usoTexto: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  itemAcoes: {
    marginTop: spacing.xs,
  },
  linkTexto: {
    color: colors.primary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  excluirTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  formCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formTitulo: {
    ...type.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  campoRotulo: {
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  chipsRow: {
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
    backgroundColor: colors.background,
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
  botao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
