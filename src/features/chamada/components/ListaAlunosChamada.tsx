import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Aluno, StatusPresenca } from '../api';
import { ESTADOS, type RegistroLocal } from '../selectors';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  alunos: Aluno[];
  presencas: Record<string, RegistroLocal>;
  conflitoAlunoId: string | null;
  alunosSalvando: Set<string>;
  onAbrirFrequencia: (alunoId: string) => void;
  onMarcar: (alunoId: string, status: StatusPresenca) => void;
};

export function ListaAlunosChamada({
  alunos,
  presencas,
  conflitoAlunoId,
  alunosSalvando,
  onAbrirFrequencia,
  onMarcar,
}: Props) {
  const renderItem = useCallback(
    ({ item }: { item: Aluno }) => {
      const status = presencas[item.id]?.status;
      return (
        <View testID={`chamada-detalhe-aluno-row-${item.id}`} style={styles.row}>
          <TouchableOpacity
            testID={`chamada-detalhe-aluno-nome-${item.id}`}
            style={styles.nomeArea}
            onPress={() => onAbrirFrequencia(item.id)}
          >
            <Text style={[type.body, styles.nome]} numberOfLines={1}>
              {item.nome}
            </Text>
            <Text style={[type.caption, styles.moduloTexto]}>Módulo {item.modulo}</Text>
          </TouchableOpacity>
          <View style={styles.botoes}>
            {ESTADOS.map((estado) => {
              const ativo = status === estado.status;
              // Só trava a linha do próprio aluno (conflito real ou salvamento em
              // voo) — o resto da chamada continua editável normalmente.
              const bloqueado = conflitoAlunoId === item.id || alunosSalvando.has(item.id);
              return (
                <TouchableOpacity
                  key={estado.status}
                  testID={`chamada-detalhe-status-button-${item.id}-${estado.status}`}
                  style={[
                    styles.botao,
                    ativo
                      ? { backgroundColor: colors[estado.cor], borderColor: colors[estado.cor] }
                      : styles.botaoInativo,
                    bloqueado && styles.botaoDesabilitado,
                  ]}
                  onPress={() => onMarcar(item.id, estado.status)}
                  disabled={bloqueado}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={estado.legenda}
                  accessibilityState={{ selected: ativo }}
                >
                  <Text style={[styles.botaoTexto, ativo ? styles.botaoTextoAtivo : styles.botaoTextoInativo]}>
                    {estado.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    },
    [presencas, conflitoAlunoId, alunosSalvando, onAbrirFrequencia, onMarcar]
  );

  return (
    <FlatList
      data={alunos}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={[type.body, styles.subtitle]}>Nenhum aluno ativo nesse módulo.</Text>}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
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
    paddingHorizontal: spacing.md,
  },
  nomeArea: {
    flex: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  nome: {
    color: colors.primary,
  },
  moduloTexto: {
    color: colors.textMuted,
    marginTop: 2,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botao: {
    width: touchTarget - 16,
    height: touchTarget - 16,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoInativo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  botaoTexto: {
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  botaoTextoAtivo: {
    color: colors.onPrimary,
  },
  botaoTextoInativo: {
    color: colors.textMuted,
  },
});
