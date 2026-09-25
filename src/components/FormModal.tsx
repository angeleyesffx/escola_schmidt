import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing, type } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Conteúdo fixo entre o título e a área rolável — usado quando algo (ex.:
  // qual habilidade está sendo avaliada) precisa continuar visível mesmo
  // com o corpo do modal rolado pra baixo.
  stickyHeader?: ReactNode;
};

// Wrapper genérico pra formulário em modal — usado tanto pra "adicionar" (o
// botão do topo de cada tela) quanto pra "editar" (o lápis de cada linha),
// padronizando o que antes eram formulários fixos embaixo da lista, cada tela
// com um layout diferente. Mesmo padrão visual de ModalExportacao
// (src/features/chamada/components/ModalExportacao.tsx): overlay
// semitransparente, toque fora fecha, card centralizado.
export function FormModal({ visible, title, onClose, children, stickyHeader }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={type.subtitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {stickyHeader ? <View style={styles.stickyHeader}>{stickyHeader}</View> : null}
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    height: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stickyHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  body: {
    gap: spacing.sm,
  },
});
