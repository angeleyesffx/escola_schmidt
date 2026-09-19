import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, touchTarget, type } from '../constants/theme';
import { QuickMenu } from './QuickMenu';

type Props = {
  titulo: string;
  // false só pras telas de topo da pilha (ex.: login) — em qualquer tela
  // alcançada por navegação, o ícone de voltar é padrão (guia de App Bar
  // do Android: ícone de navegação à esquerda, título ao lado, ações à direita).
  mostrarVoltar?: boolean;
  // false nas telas de autenticação — antes de logar não tem sessão pra "Sair"
  // nem rota protegida pra abrir (o guard só devolveria pro login de novo).
  mostrarMenu?: boolean;
};

export function PageHeader({ titulo, mostrarVoltar = true, mostrarMenu = true }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.barra, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.linha}>
        {mostrarVoltar ? (
          <TouchableOpacity
            style={styles.navBotao}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={26} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navEspaco} />
        )}
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {mostrarMenu ? <QuickMenu variante="barra" /> : <View style={styles.navEspaco} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Fundo sólido (branco sobre a barra cor primária), não translúcido — o
  // ghost button antigo (branco a 18% de opacidade) quase não aparecia
  // sobre o teal, especialmente pra quem tem baixa visão. Reaproveita o
  // mesmo par primary/onPrimary usado nos botões preenchidos do resto do
  // app, só invertido, porque aqui é a barra que já é cor primária.
  navBotao: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  // Só ocupa o espaço pra manter o título centralizado — sem o fundo do
  // navBotao, que parecia um botão de voltar sem fazer nada.
  navEspaco: {
    width: touchTarget,
    height: touchTarget,
  },
  titulo: {
    flex: 1,
    color: colors.onPrimary,
    fontFamily: type.title.fontFamily,
    fontSize: type.title.fontSize,
    textAlign: 'center',
  },
});
