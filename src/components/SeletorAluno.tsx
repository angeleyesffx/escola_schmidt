import { StyleSheet, Text, View } from 'react-native';

import type { MeuAluno } from '../features/auth/AuthProvider';
import { Chip } from './Chip';
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
      <View style={styles.chips}>
        {alunos.map((aluno) => (
          <Chip
            key={aluno.id}
            label={aluno.nome}
            active={selecionadoId === aluno.id}
            onPress={() => onSelecionar(aluno.id)}
          />
        ))}
      </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
