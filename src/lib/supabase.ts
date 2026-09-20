import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

import { storageComLembrarMe } from './rememberMeStorage';

export const MISSING_ENV_ERROR =
  'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha.';

// O Metro só embute EXPO_PUBLIC_* no bundle quando a expressão
// `process.env.NOME` aparece literalmente em notação de ponto no código-fonte
// (https://docs.expo.dev/guides/environment-variables/). `env['NOME']` ou
// acesso via variável NÃO são substituídos e ficam undefined no app compilado
// mesmo com a env var setada no build — por isso o valor default abaixo
// referencia process.env.EXPO_PUBLIC_* diretamente, e não `process.env` puro.
export function getSupabaseConfig(
  env: NodeJS.ProcessEnv = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  }
) {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(MISSING_ENV_ERROR);
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseOptions(storage: SupportedStorage = AsyncStorage) {
  return {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // No mobile não existe callback de URL; na web o Expo Router cuida da rota.
      detectSessionInUrl: false,
    },
  };
}

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  storage: SupportedStorage = AsyncStorage
) {
  return createClient(supabaseUrl, supabaseAnonKey, createSupabaseOptions(storage));
}

// Se as env vars faltarem (ex.: build EAS sem as variáveis configuradas), não
// derrubamos o app inteiro na inicialização — isso fechava o app sem dar
// nenhuma pista do motivo. Em vez disso, adiamos o erro para o primeiro uso
// real do client, onde ele aparece dentro da árvore do React (capturável por
// ErrorBoundary) ou de um try/catch de tela, em vez de travar o require().
function createMissingConfigClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(MISSING_ENV_ERROR);
    },
  });
}

function createSingletonClient(): SupabaseClient {
  try {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    return createSupabaseClient(supabaseUrl, supabaseAnonKey, storageComLembrarMe);
  } catch {
    return createMissingConfigClient();
  }
}

export const supabase = createSingletonClient();
