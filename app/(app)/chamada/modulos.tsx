import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  adicionarResponsabilidade,
  getGradeSemanal,
  getProfessores,
  getResponsabilidadesProfessor,
  removerResponsabilidade,
  type AulaRecorrente,
  type ResponsabilidadeProfessor,
} from '../../../src/features/chamada/api';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { WebModal } from '../../../src/components/WebModal';
import { Chip } from '../../../src/components/Chip';
import { Dropdown } from '../../../src/components/Dropdown';
import { colors, radius, spacing, type } from '../../../src/constants/theme';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formatHora(hora: string) {
  return hora.slice(0, 5);
}

function chave(aulaRecorrenteId: string, modulo: number) {
  return `${aulaRecorrenteId}-${modulo}`;
}

export default function MeusModulos() {
  const { meuPapel, session } = useAuth();
  const souDono = meuPapel === 'dono';

  const [professorSelecionadoId, setProfessorSelecionadoId] = useState<string | null>(null);
  const professorId = souDono ? professorSelecionadoId : (session?.user.id ?? null);

  const { data: dadosProfessores } = useAsyncData(getProfessores, [], { enabled: souDono });
  const professores = dadosProfessores ?? [];
  const opcoesProfessores = professores.map((p) => ({ value: p.id, label: p.nome }));

  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const {
    data: dadosIniciais,
    setData: setDadosIniciais,
    loading,
    error: erroCarregar,
  } = useAsyncData(
    async () => {
      const [grade, responsabilidades] = await Promise.all([
        getGradeSemanal(),
        professorId ? getResponsabilidadesProfessor(professorId) : Promise.resolve([]),
      ]);
      return { grade, responsabilidades };
    },
    [professorId],
    { onFocus: true, enabled: Boolean(professorId), mensagemErro: 'Erro ao carregar a grade. Tente novamente.' }
  );
  const grade = dadosIniciais?.grade ?? ([] as AulaRecorrente[]);
  const responsabilidades = dadosIniciais?.responsabilidades ?? ([] as ResponsabilidadeProfessor[]);
  const mapaResponsabilidades = new Map(responsabilidades.map((r) => [chave(r.aula_recorrente_id, r.modulo), r.id]));
  const error = erro ?? erroCarregar;

  async function alternar(aulaRecorrenteId: string, modulo: number) {
    if (!professorId) return;
    const k = chave(aulaRecorrenteId, modulo);
    const idExistente = mapaResponsabilidades.get(k);
    setErro(null);
    setPendente(k);
    try {
      if (idExistente) {
        await removerResponsabilidade(idExistente);
        setDadosIniciais((atual) =>
          atual ? { ...atual, responsabilidades: atual.responsabilidades.filter((r) => r.id !== idExistente) } : atual
        );
      } else {
        const id = await adicionarResponsabilidade(professorId, aulaRecorrenteId, modulo);
        setDadosIniciais((atual) =>
          atual
            ? { ...atual, responsabilidades: [...atual.responsabilidades, { id, aula_recorrente_id: aulaRecorrenteId, modulo }] }
            : atual
        );
      }
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar módulo. Tente novamente.');
    } finally {
      setPendente(null);
    }
  }

  if (meuPapel === 'aluno' || meuPapel === 'responsavel') {
    return <Redirect href="/" />;
  }

  return (
    <WebModal>
      <PageHeader titulo={souDono ? 'Módulos por professor' : 'Meus módulos'} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {souDono ? (
          <>
            <Text style={[type.label, styles.rotulo]}>Professor</Text>
            <Dropdown
              testID="modulos-dropdown-professor"
              placeholder="Selecione o professor"
              options={opcoesProfessores}
              value={professorSelecionadoId}
              onChange={setProfessorSelecionadoId}
              vazio="Nenhum professor disponível."
            />
          </>
        ) : (
          <Text style={[type.body, styles.subtitle]}>
            Marque os módulos que você dá aula em cada horário da grade. Isso também decide em quais horários você
            pode agendar aula teste.
          </Text>
        )}

        {error ? <Text style={[type.body, styles.error]}>{error}</Text> : null}

        {!professorId ? (
          souDono ? (
            <Text style={[type.body, styles.subtitle, styles.aviso]}>
              Selecione um professor pra ver e editar os módulos dele. Isso também decide em quais horários ele pode
              agendar aula teste.
            </Text>
          ) : null
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <View style={styles.lista}>
            {grade.map((slot) => (
              <View key={slot.id} style={styles.card}>
                <Text style={type.subtitle}>
                  {DIAS_SEMANA[slot.dia_semana]} · {formatHora(slot.hora)}
                </Text>
                <View style={styles.chips}>
                  {slot.modulos.map((modulo) => {
                    const k = chave(slot.id, modulo);
                    return (
                      <Chip
                        key={modulo}
                        square
                        label={pendente === k ? '…' : `Módulo ${modulo}`}
                        active={mapaResponsabilidades.has(k)}
                        onPress={() => alternar(slot.id, modulo)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <Footer />
    </WebModal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    color: colors.textMuted,
  },
  aviso: {
    marginTop: spacing.lg,
  },
  loading: {
    marginTop: spacing.xl,
  },
  rotulo: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  lista: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
