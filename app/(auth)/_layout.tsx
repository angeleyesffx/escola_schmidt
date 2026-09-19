import { Redirect, Slot, usePathname } from 'expo-router';

import { useAuth } from '../../src/features/auth/AuthProvider';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const emRecuperacaoSenha = pathname === '/reset-password';

  if (loading) {
    return null;
  }

  if (session && !emRecuperacaoSenha) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
