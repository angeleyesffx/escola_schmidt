import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AulaTeste } from '../api';
import { formatHora, formatModulos } from '../calendar';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { estilosCalendario } from './estiloCalendario';

type Props = {
  aulasTeste: AulaTeste[];
  filtroAtivo: boolean;
  podeEditar: boolean;
  onExcluirTeste: (aula: AulaTeste) => void;
};

export function ListaTestes({ aulasTeste, filtroAtivo, podeEditar, onExcluirTeste }: Props) {
  if (aulasTeste.length === 0) return null;

  return (
    <View style={styles.eventosLista}>
      <View style={styles.eventosSecaoTopo}>
        <Text style={[type.label, styles.secao]}>
          {filtroAtivo ? 'Testes da data selecionada' : 'Aulas teste deste período'}
        </Text>
      </View>
      {aulasTeste.map((t) => (
        <View key={t.id} testID={`chamada-index-teste-item-${t.id}`} style={styles.eventoItem}>
          <View style={styles.eventoItemPrincipal}>
            <View style={[styles.eventoItemCor, estilosCalendario.diaTesteDot]} />
            <View style={styles.eventoItemTexto}>
              <Text style={type.body}>{t.candidatos.map((c) => c.nome).join(', ') || 'Sem candidatos'}</Text>
              <Text style={[type.caption, styles.subtitle]}>
                {t.data.split('-').reverse().join('/')} às {formatHora(t.hora)} · {formatModulos(t.modulos)}
              </Text>
            </View>
          </View>
          {podeEditar ? (
            <TouchableOpacity
              testID={`chamada-index-teste-excluir-${t.id}`}
              style={styles.eventoItemExcluir}
              onPress={() => onExcluirTeste(t)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar aula teste"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  eventosLista: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  eventosSecaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secao: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  eventoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  eventoItemPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventoItemExcluir: {
    width: touchTarget - 16,
    height: touchTarget - 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventoItemCor: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  eventoItemTexto: {
    flex: 1,
  },
});
