import { Redirect, Slot, usePathname } from 'expo-router';

import { useAuth } from '../../src/features/auth/AuthProvider';

const ROTA_CONFIRMAR_VINCULO = '/confirmar-vinculo';

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

  return <Slot />;
}
