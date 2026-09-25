import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AulaTeste } from '../api';
import { formatHora, formatModulos } from '../calendar';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';
import { uiAssets } from '../../../constants/uiAssets';
import { estilosCalendario } from './estiloCalendario';

type Props = {
  aulasTeste: AulaTeste[];
  filtroAtivo: boolean;
  podeEditar: boolean;
  onAbrirTeste: (aula: AulaTeste) => void;
  onExcluirTeste: (aula: AulaTeste) => void;
};

export function ListaTestes({ aulasTeste, filtroAtivo, podeEditar, onAbrirTeste, onExcluirTeste }: Props) {
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
          <TouchableOpacity
            testID={`chamada-index-teste-abrir-${t.id}`}
            style={styles.eventoItemPrincipal}
            onPress={() => onAbrirTeste(t)}
            accessibilityRole="button"
            accessibilityLabel={`Detalhes da aula teste de ${t.candidatos.map((c) => c.nome).join(', ') || 'sem candidatos'}`}
          >
            <View style={[styles.eventoItemCor, estilosCalendario.diaTesteDot]} />
            <View style={styles.eventoItemTexto}>
              <Text style={type.body}>{t.candidatos.map((c) => c.nome).join(', ') || 'Sem candidatos'}</Text>
              <Text style={[type.caption, styles.subtitle]}>
                {t.data.split('-').reverse().join('/')} às {formatHora(t.hora)} · {formatModulos(t.modulos)}
              </Text>
            </View>
          </TouchableOpacity>
          {podeEditar ? (
            <View style={styles.acoes}>
              <TouchableOpacity
                testID={`chamada-index-teste-editar-${t.id}`}
                style={styles.eventoItemAcao}
                onPress={() => onAbrirTeste(t)}
                accessibilityRole="button"
                accessibilityLabel={`Editar aula teste de ${t.candidatos.map((c) => c.nome).join(', ') || 'sem candidatos'}`}
                hitSlop={8}
              >
                <Image source={uiAssets.icon.edit} style={styles.iconeAcao} />
                <Text style={[type.label, styles.textoEditar]}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`chamada-index-teste-excluir-${t.id}`}
                style={styles.eventoItemAcao}
                onPress={() => onExcluirTeste(t)}
                accessibilityRole="button"
                accessibilityLabel={`Excluir aula teste de ${t.candidatos.map((c) => c.nome).join(', ') || 'sem candidatos'}`}
                hitSlop={8}
              >
                <Image source={uiAssets.icon.trash} style={styles.iconeAcao} />
                <Text style={[type.label, styles.textoExcluir]}>Excluir</Text>
              </TouchableOpacity>
            </View>
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
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventoItemAcao: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  iconeAcao: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  textoExcluir: {
    color: colors.danger,
  },
  textoEditar: {
    color: colors.primary,
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
