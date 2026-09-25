import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  atualizarSlotGrade,
  criarSlotGrade,
  excluirSlotGrade,
  getGradeCompleta,
  getModulosAtivos,
  getUsoSlotGrade,
  type SlotGradeAdmin,
} from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { confirmDelete, confirmSave } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { FormModal } from '../../../src/components/FormModal';
import { RowActions } from '../../../src/components/RowActions';
import { ToggleAtivo } from '../../../src/components/ToggleAtivo';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Grade semanal (dono-only) — docs/product/papeis-e-permissoes.md §6.4.
// Até aqui só dava pra criar/editar um horário fixo da semana rodando SQL
// direto; a RLS já era dono-only desde 0001, só faltava a tela.
//
// Adicionar/editar/excluir padronizados (pedido do dono, 2026-09-22): botão
// "+ Horário" no topo abre um FormModal; cada linha ganha o lápis (edita dia/
// hora/módulos no mesmo modal) e a lixeira (exclui de vez, checando uso antes
// — mesma regra de sempre: com chamada ou aula teste já registrada, só dá pra
// desativar) além do toggle de ativo já existente.

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SlotGradeAdmin | null>(null);

  const [diaForm, setDiaForm] = useState<number | null>(null);
  const [horaForm, setHoraForm] = useState('');
  const [modulosForm, setModulosForm] = useState<number[]>([]);

  const { data: grade, loading, reload: recarregar } = useAsyncData<SlotGradeAdmin[]>(getGradeCompleta, [], {
    mensagemErro: 'Erro ao carregar a grade. Tente novamente.',
  });
  const { data: modulosDisponiveis } = useAsyncData(getModulosAtivos, [], {
    onFocus: true,
    mensagemErro: 'Erro ao carregar os módulos. Tente novamente.',
  });
  const modulosCatalogo = modulosDisponiveis ?? [];

  if (!souDono) {
    return <Redirect href="/" />;
  }

  function alternarModulo(m: number) {
    setModulosForm((atual) => (atual.includes(m) ? atual.filter((x) => x !== m) : [...atual, m].sort()));
  }

  function abrirNovo() {
    setEditando(null);
    setDiaForm(null);
    setHoraForm('');
    setModulosForm([]);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(slot: SlotGradeAdmin) {
    setEditando(slot);
    setDiaForm(slot.dia_semana);
    setHoraForm(formatHora(slot.hora));
    setModulosForm(slot.modulos);
    setErro(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function confirmarSalvar() {
    if (diaForm === null) {
      setErro('Escolha o dia da semana.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(horaForm.trim())) {
      setErro('Hora deve estar no formato HH:MM.');
      return;
    }
    if (modulosForm.length === 0) {
      setErro('Escolha ao menos um módulo.');
      return;
    }
    if (editando) {
      confirmSave(salvar);
    } else {
      salvar();
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (editando) {
        await atualizarSlotGrade(editando.id, {
          dia_semana: diaForm!,
          hora: `${horaForm.trim()}:00`,
          modulos: modulosForm,
        });
      } else {
        await criarSlotGrade(diaForm!, `${horaForm.trim()}:00`, modulosForm);
      }
      setModalAberto(false);
      await recarregar();
    } catch (err: unknown) {
      console.error(err);
      const duplicado =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
      setErro(duplicado ? 'Já existe um horário nesse dia e hora.' : 'Erro ao salvar horário. Tente novamente.');
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

  async function excluir(slot: SlotGradeAdmin) {
    setErro(null);
    const nomeSlot = `${DIAS_SEMANA[slot.dia_semana]} ${formatHora(slot.hora)}`;
    try {
      const uso = await getUsoSlotGrade(slot.id);
      if (uso.aulas > 0 || uso.aulasTeste > 0) {
        setErro(
          `Não é possível excluir "${nomeSlot}": em uso por ${uso.aulas} chamada(s) e ${uso.aulasTeste} aula(s) teste. Desative em vez de excluir.`
        );
        return;
      }
      confirmDelete(nomeSlot, async () => {
        try {
          await excluirSlotGrade(slot.id);
          await recarregar();
        } catch (err) {
          console.error(err);
          setErro('Erro ao excluir horário. Tente novamente.');
        }
      });
    } catch (err) {
      console.error(err);
      setErro('Erro ao verificar uso do horário. Tente novamente.');
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
    <WebModal>
      <PageHeader titulo="Grade semanal" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.topoRow}>
          <Text style={styles.explicacao}>
            Horários fixos da semana. Um horário com chamada ou aula teste já registrada só pode ser desativado — pra
            não perder o histórico.
          </Text>
          <TouchableOpacity testID="grade-abrir-novo" style={styles.novoBotao} onPress={abrirNovo}>
            <Text style={styles.novoBotaoTexto}>+ Horário</Text>
          </TouchableOpacity>
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {(grade ?? []).map((slot) => (
          <View key={slot.id} style={styles.itemRow}>
            <View style={styles.itemTextoWrap}>
              <Text style={[type.body, !slot.ativo && styles.inativo]}>
                {DIAS_SEMANA[slot.dia_semana]} · {formatHora(slot.hora)}
              </Text>
              <Text style={type.caption}>{formatModulos(slot.modulos)}</Text>
            </View>
            <View style={styles.itemAcoes}>
              <ToggleAtivo
                testID={`grade-slot-${slot.id}-toggle`}
                ativo={slot.ativo}
                onToggle={() => alternarAtivo(slot)}
              />
              <RowActions
                testIdBase={`grade-slot-${slot.id}`}
                onEdit={() => abrirEdicao(slot)}
                onDelete={() => excluir(slot)}
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <FormModal visible={modalAberto} title={editando ? 'Editar horário' : 'Novo horário'} onClose={fecharModal}>
        <Text style={[type.label, styles.campoRotulo]}>Dia da semana</Text>
        <View style={styles.chipsRow}>
          {DIAS_SEMANA.map((nome, indice) => (
            <TouchableOpacity
              key={nome}
              testID={`grade-dia-${indice}`}
              style={[styles.chip, diaForm === indice && styles.chipAtivo]}
              onPress={() => setDiaForm(indice)}
            >
              <Text style={[styles.chipTexto, diaForm === indice && styles.chipTextoAtivo]}>{nome.slice(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[type.label, styles.campoRotulo]}>Hora</Text>
        <TextInput
          testID="grade-hora-input"
          style={styles.input}
          value={horaForm}
          onChangeText={setHoraForm}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[type.label, styles.campoRotulo]}>Módulos</Text>
        <View style={styles.chipsRow}>
          {modulosCatalogo.length === 0 ? (
            <Text style={[type.caption, styles.semModulos]}>Nenhum módulo ativo no catálogo.</Text>
          ) : (
            modulosCatalogo.map((modulo) => (
              <TouchableOpacity
                key={modulo.numero}
                testID={`grade-modulo-${modulo.numero}`}
                style={[styles.chip, modulosForm.includes(modulo.numero) && styles.chipAtivo]}
                onPress={() => alternarModulo(modulo.numero)}
              >
                <Text
                  style={[styles.chipTexto, modulosForm.includes(modulo.numero) && styles.chipTextoAtivo]}
                >
                  {modulo.numero}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          testID="grade-salvar"
          style={[styles.botao, salvando && styles.botaoDesabilitado]}
          onPress={confirmarSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.botaoTexto}>{editando ? 'Salvar alterações' : 'Adicionar horário'}</Text>
          )}
        </TouchableOpacity>
      </FormModal>

      <Footer />
    </WebModal>
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
  topoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  explicacao: {
    ...type.caption,
    color: colors.textMuted,
    flex: 1,
  },
  novoBotao: {
    height: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  erro: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  itemRow: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemTextoWrap: {
    gap: 2,
  },
  itemAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inativo: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
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
  semModulos: {
    color: colors.textMuted,
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
