import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { excluirAulaParticular, getHorariosLivresProfessor, remarcarAulaParticular } from '../../../src/features/chamada/api';
import { formatDataISO } from '../../../src/features/chamada/calendar';
import { confirmar } from '../../../src/lib/confirmar';
import { PageHeader } from '../../../src/components/PageHeader';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { Footer } from '../../../src/components/Footer';
import { Chip } from '../../../src/components/Chip';
import { colors, radius, spacing, touchTarget, type } from '../../../src/constants/theme';

// Só remarca data/hora — aluno e professor da reserva ficam fixos (decisão
// registrada em docs/product/chamada-agenda-frequencia.md §7.2). Quem pode
// chamar isso (dono, o próprio professor da aula, ou o próprio aluno) é
// decidido pela RLS/RPC (0026), não por checagem client-side — a tela só
// existe pra quem já conseguia ver o item na lista da Agenda.

function formatBR(dataISO: string): string {
  return dataISO.split('-').reverse().join('/');
}

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

export default function RemarcarAulaParticular() {
  const router = useRouter();
  const { id, professorId } = useLocalSearchParams<{ id: string; professorId: string }>();

  const [dataISO, setDataISO] = useState(formatDataISO(new Date()));
  const [dataAberta, setDataAberta] = useState(false);
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [horaAula, setHoraAula] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregandoHorarios(true);
    setHoraAula('');
    getHorariosLivresProfessor(professorId, dataISO)
      .then((horas) => {
        if (ativo) setHorariosLivres(horas);
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErro('Erro ao carregar horários livres do professor. Tente novamente.');
      })
      .finally(() => {
        if (ativo) setCarregandoHorarios(false);
      });
    return () => {
      ativo = false;
    };
  }, [professorId, dataISO]);

  async function salvar() {
    if (!horaAula) {
      setErro('Escolha um horário livre do professor.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await remarcarAulaParticular(id, dataISO, horaAula);
      if (router.canGoBack()) router.back();
      else router.replace('/chamada');
    } catch (err) {
      console.error(err);
      setErro('Erro ao remarcar a aula. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  // Mesma permissão de remarcar (RLS aula_exclusao, 0026): dono, o próprio
  // professor da aula ou o próprio aluno. Libera o horário na hora, já que
  // horarios_livres_particular só considera linhas que ainda existem em `aulas`.
  function confirmarCancelamento() {
    confirmar(
      'Cancelar aula particular',
      'O horário fica livre pra qualquer aluno agendar. Essa ação não pode ser desfeita.',
      'Cancelar aula',
      cancelar
    );
  }

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    try {
      await excluirAulaParticular(id);
      if (router.canGoBack()) router.back();
      else router.replace('/chamada');
    } catch (err) {
      console.error(err);
      setErro('Erro ao cancelar a aula. Tente novamente.');
      setCancelando(false);
    }
  }

  return (
    <>
      <PageHeader titulo="Remarcar aula particular" />
      <View style={styles.container}>
        <Text style={[type.label, styles.rotulo]}>Nova data</Text>
        <TouchableOpacity style={styles.input} onPress={() => setDataAberta((atual) => !atual)}>
          <Text style={styles.periodoTexto}>{formatBR(dataISO)}</Text>
        </TouchableOpacity>
        {dataAberta ? (
          <DateRangePicker
            apenasUmDia
            inicioISO={dataISO}
            fimISO={dataISO}
            onConfirmar={(inicio) => {
              setDataISO(inicio);
              setDataAberta(false);
            }}
            onFechar={() => setDataAberta(false)}
          />
        ) : null}

        <Text style={[type.label, styles.rotulo]}>Nova hora</Text>
        {carregandoHorarios ? (
          <ActivityIndicator color={colors.primary} style={styles.horariosLoading} />
        ) : horariosLivres.length === 0 ? (
          <Text style={[type.body, styles.subtitle]}>Nenhum horário livre pra esse professor nessa data.</Text>
        ) : (
          <View style={styles.chips}>
            {horariosLivres.map((hora) => (
              <Chip key={hora} label={formatHora(hora)} active={horaAula === hora} onPress={() => setHoraAula(hora)} />
            ))}
          </View>
        )}

        {erro ? <Text style={[type.body, styles.error]}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.salvarBotao, (salvando || cancelando || !horaAula) && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={salvando || cancelando || !horaAula}
        >
          {salvando ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.salvarBotaoTexto}>Confirmar nova data/hora</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelarBotao, (salvando || cancelando) && styles.botaoDesabilitado]}
          onPress={confirmarCancelamento}
          disabled={salvando || cancelando}
        >
          {cancelando ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.cancelarBotaoTexto}>Cancelar aula</Text>
          )}
        </TouchableOpacity>
      </View>
      <Footer />
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
  rotulo: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    height: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  periodoTexto: {
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    color: colors.text,
  },
  subtitle: {
    color: colors.textMuted,
  },
  horariosLoading: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  salvarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  salvarBotaoTexto: {
    color: colors.onPrimary,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
  cancelarBotao: {
    height: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  cancelarBotaoTexto: {
    color: colors.danger,
    fontFamily: type.subtitle.fontFamily,
    fontSize: type.subtitle.fontSize,
  },
});
