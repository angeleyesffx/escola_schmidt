import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PedidoPresenca, ProfessorAula } from '../api';
import type { RegistroLocal } from '../selectors';
import type { MeuAluno } from '../../auth/AuthProvider';
import { PageHeader } from '../../../components/PageHeader';
import { SeletorAluno } from '../../../components/SeletorAluno';
import { colors, radius, spacing, touchTarget, type } from '../../../constants/theme';

type Props = {
  horario: string | null;
  dataSelecionada: string;
  professoresDoModulo: ProfessorAula[];
  error: string | null;
  elegivelAutocheckin: boolean;
  minhaPresenca: RegistroLocal | null;
  meuPedido: PedidoPresenca | null;
  enviandoPedido: boolean;
  onPedirPresenca: () => void;
  // Mais de um filho pode cair no módulo elegível pra essa aula (ex.:
  // gêmeos) — só então aparece um seletor; com 0 ou 1, segue sem UI extra.
  alunosElegiveis: MeuAluno[];
  alunoSelecionadoId: string | null;
  onSelecionarAluno: (id: string) => void;
};

export function AutocheckinAluno({
  horario,
  dataSelecionada,
  professoresDoModulo,
  error,
  elegivelAutocheckin,
  minhaPresenca,
  meuPedido,
  enviandoPedido,
  onPedirPresenca,
  alunosElegiveis,
  alunoSelecionadoId,
  onSelecionarAluno,
}: Props) {
  return (
    <>
      <PageHeader titulo={`Chamada ${horario ?? ''}`} />
      <View style={styles.container}>
        <Text style={[type.body, styles.subtitle]}>{dataSelecionada}</Text>
        {alunosElegiveis.length > 1 ? (
          <View style={styles.seletorWrap}>
            <SeletorAluno alunos={alunosElegiveis} selecionadoId={alunoSelecionadoId} onSelecionar={onSelecionarAluno} />
          </View>
        ) : null}
        {professoresDoModulo.length > 0 ? (
          <Text style={[type.body, styles.subtitle]}>
            {professoresDoModulo.length === 1 ? 'Professor(a): ' : 'Professores: '}
            {professoresDoModulo.map((p) => p.nome).join(', ')}
          </Text>
        ) : null}

        {error ? (
          <Text testID="chamada-detalhe-erro" style={[type.body, styles.error]}>
            {error}
          </Text>
        ) : null}

        {!elegivelAutocheckin ? (
          <Text style={[type.body, styles.subtitle, styles.autocheckinAviso]}>
            Você só pode pedir presença no dia e no horário da sua própria aula.
          </Text>
        ) : minhaPresenca ? (
          <View style={styles.autocheckinCard}>
            <Text style={[type.subtitle, { color: colors.present }]}>✓ Presença confirmada</Text>
            {minhaPresenca.registradoEm ? (
              <Text style={[type.caption, styles.subtitle]}>
                Registrada às {new Date(minhaPresenca.registradoEm).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
          </View>
        ) : meuPedido?.status === 'pendente' ? (
          <View style={styles.autocheckinCardPendente}>
            <Text style={[type.subtitle, { color: colors.justified }]}>⏳ Pedido enviado</Text>
            <Text style={[type.caption, styles.subtitle]}>Aguardando aprovação do professor.</Text>
          </View>
        ) : (
          <TouchableOpacity
            testID="chamada-detalhe-autocheckin-pedir"
            style={[styles.confirmarBotao, enviandoPedido && styles.botaoDesabilitado]}
            onPress={onPedirPresenca}
            disabled={enviandoPedido}
          >
            {enviandoPedido ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.confirmarBotaoTexto}>Pedir presença</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.xs,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  autocheckinAviso: {
    marginTop: spacing.xl,
  },
  seletorWrap: {
    marginTop: spacing.md,
  },
  autocheckinCard: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.present,
    padding: spacing.lg,
  },
  autocheckinCardPendente: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.justified,
    padding: spacing.lg,
  },
  confirmarBotao: {
    height: touchTarget,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
