import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuth } from '../../src/features/auth/AuthProvider';

const ROTA_CONFIRMAR_VINCULO = '/confirmar-vinculo';

export const unstable_settings = { anchor: 'index' };

export default function AppLayout() {
  const { session, loading, vinculosPendentes, vinculosPendentesCarregado } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  // Vínculo por e-mail ainda não confirmado (supabase/migrations/0037) trava
  // o resto do app: sem isso, a RLS já bloqueia os dados do aluno vinculado,
  // mas a pessoa nunca veria a tela que existe pra ela resolver isso.
  if (vinculosPendentesCarregado && vinculosPendentes.length > 0 && pathname !== ROTA_CONFIRMAR_VINCULO) {
    return <Redirect href={ROTA_CONFIRMAR_VINCULO} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="eventos/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="usuarios/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="perfil" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="minha-evolucao" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="confirmar-vinculo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="alunos/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="alunos/[id]/frequencia" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="alunos/[id]/evolucao" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="alunos/[id]/desempenho" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/agendar" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/disponibilidade" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/lista" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/modulos" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/nova-particular" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/nova-teste" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/remarcar-particular" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="chamada/novo-evento" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="alunos/novo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="usuarios/novo" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="catalogo-evolucao" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="configuracoes/grade-semanal" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="configuracoes/modulos" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="configuracoes/tipos-evento" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="usuarios" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
