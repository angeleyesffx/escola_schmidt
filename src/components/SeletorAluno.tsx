import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { MeuAluno } from '../features/auth/AuthProvider';
import { colors, spacing, type } from '../constants/theme';

type Props = {
  alunos: MeuAluno[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  /** Omitir quando a tela já tem o próprio label acima (ex.: "Aluno"). */
  rotulo?: string;
};

// Só chamado quando `alunos.length > 1` — com 0 ou 1, a tela resolve sozinha
// sem pedir escolha nenhuma (o caso comum de sempre continua sem UI extra).
export function SeletorAluno({ alunos, selecionadoId, onSelecionar, rotulo }: Props) {
  if (alunos.length <= 1) return null;

  return (
    <View style={styles.wrap}>
      {rotulo ? <Text style={[type.label, styles.rotulo]}>{rotulo}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.abas}
        accessibilityLabel="Alunos vinculados"
      >
        {alunos.map((aluno, index) => {
          const ativo = selecionadoId === aluno.id;
          const corPastel = colors.tabPastels[index % colors.tabPastels.length];
          return (
            <TouchableOpacity
              key={aluno.id}
              style={[styles.aba, { backgroundColor: corPastel }, ativo && styles.abaAtiva]}
              onPress={() => onSelecionar(aluno.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
            >
            <Text style={[styles.abaTexto, ativo && styles.abaTextoAtivo]} numberOfLines={1}>
              {aluno.nome}
            </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  rotulo: {
    color: colors.textMuted,
  },
  abas: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: '100%',
    borderBottomWidth: 3,
    borderBottomColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
  },
  aba: {
    minWidth: 132,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 180, 204, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abaAtiva: {
    borderColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.background,
    minHeight: 54,
  },
  abaTexto: {
    ...type.subtitle,
    color: colors.textMuted,
  },
  abaTextoAtivo: {
    color: colors.text,
  },
});
