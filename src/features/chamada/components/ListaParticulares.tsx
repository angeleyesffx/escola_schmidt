import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AulaParticular } from '../api';
import { formatHora } from '../calendar';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { estilosCalendario } from './estiloCalendario';

type Props = {
  particulares: AulaParticular[];
  filtroAtivo: boolean;
  podeGerenciarParticular: boolean;
  onAbrirParticular: (aula: AulaParticular) => void;
  onExcluirParticular: (aula: AulaParticular) => void;
};

export function ListaParticulares({
  particulares,
  filtroAtivo,
  podeGerenciarParticular,
  onAbrirParticular,
  onExcluirParticular,
}: Props) {
  if (particulares.length === 0) return null;

  return (
    <View style={styles.eventosLista}>
      <View style={styles.eventosSecaoTopo}>
        <Text style={[type.label, styles.secao]}>
          {filtroAtivo ? 'Particulares da data selecionada' : 'Aulas particulares deste período'}
        </Text>
      </View>
      {particulares.map((p) => (
        <View key={p.id} style={styles.eventoItem}>
          <TouchableOpacity
            testID={`chamada-index-particular-item-${p.id}`}
            style={styles.eventoItemPrincipal}
            disabled={!podeGerenciarParticular}
            onPress={() => onAbrirParticular(p)}
          >
            <View style={[styles.eventoItemCor, estilosCalendario.diaParticularDot]} />
            <View style={styles.eventoItemTexto}>
              <Text style={type.body}>
                {p.aluno_nome} · {p.professor_nome}
              </Text>
              <Text style={[type.caption, styles.subtitle]}>
                {p.data.split('-').reverse().join('/')} às {formatHora(p.hora)}
              </Text>
            </View>
          </TouchableOpacity>
          {podeGerenciarParticular ? (
            <TouchableOpacity
              testID={`chamada-index-particular-excluir-${p.id}`}
              style={styles.eventoItemExcluir}
              onPress={() => onExcluirParticular(p)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar aula particular"
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
