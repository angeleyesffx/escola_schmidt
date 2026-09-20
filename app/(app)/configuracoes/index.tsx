import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/AuthProvider';
import { PageHeader } from '../../../src/components/PageHeader';
import { Footer } from '../../../src/components/Footer';
import { colors, radius, spacing, type } from '../../../src/constants/theme';

// Hub de administração — docs/product/papeis-e-permissoes.md §6.3. Consolida
// os itens de configuração (por oposição aos de operação do dia a dia, que
// continuam soltos no QuickMenu) num só lugar, pra não deixar o menu lateral
// crescendo item a item conforme a escola pede mais telas de admin.

type ItemConfig = { label: string; descricao: string; href: string };

export default function ConfiguracoesIndex() {
  const router = useRouter();
  const { meuPapel } = useAuth();
  const souDono = meuPapel === 'dono';
  const souProfessor = meuPapel === 'professor';

  if (!souDono && !souProfessor) {
    return <Redirect href="/" />;
  }

  const itens: ItemConfig[] = souDono
    ? [
        { label: 'Grade semanal', descricao: 'Horários fixos da semana, por dia e módulo.', href: '/configuracoes/grade-semanal' },
        { label: 'Horários por professor', descricao: 'Disponibilidade de cada professor pra aula particular.', href: '/chamada/disponibilidade' },
        { label: 'Módulos por professor', descricao: 'Quem responde por cada horário/módulo da grade.', href: '/chamada/modulos' },
        { label: 'Tipos de evento', descricao: 'Cores e nomes usados no calendário de eventos.', href: '/configuracoes/tipos-evento' },
        { label: 'Usuários', descricao: 'Contas de staff, papéis e convites.', href: '/usuarios' },
        { label: 'Catálogo de Evolução', descricao: 'Modalidades, categorias, habilidades e requisitos por nível.', href: '/catalogo-evolucao' },
      ]
    : [
        { label: 'Meus módulos', descricao: 'Horários/módulos que você assumiu na grade.', href: '/chamada/modulos' },
        { label: 'Horários livres', descricao: 'Sua disponibilidade pra aula particular.', href: '/chamada/disponibilidade' },
        { label: 'Convidar usuário', descricao: 'Convidar um novo aluno ou professor.', href: '/usuarios/novo' },
      ];

  return (
    <>
      <PageHeader titulo="Configurações" />
      <View style={styles.container}>
        {itens.map((item) => (
          <TouchableOpacity key={item.href} style={styles.card} onPress={() => router.push(item.href)}>
            <Text style={type.subtitle}>{item.label}</Text>
            <Text style={[type.body, styles.cardTexto]}>{item.descricao}</Text>
          </TouchableOpacity>
        ))}
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
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTexto: {
    color: colors.textMuted,
  },
});
