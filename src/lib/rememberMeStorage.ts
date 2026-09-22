import AsyncStorage from '@react-native-async-storage/async-storage';

// Controla, em memória, se a sessão feita no próximo signIn deve ir pro
// AsyncStorage (sobrevive a reabrir o app) ou ficar só neste processo
// (some ao fechar o app). Default true porque hoje o app já persiste sempre.
let lembrarLogin = true;

export function definirLembrarLogin(lembrar: boolean) {
  lembrarLogin = lembrar;
}

const sessaoEmMemoria = new Map<string, string>();

// Adapter passado como `storage` do client Supabase: quando "lembrar-me"
// está desmarcado, o par chave/valor da sessão nunca chega a tocar o
// AsyncStorage, então um novo processo do app (reabrir depois de fechado)
// não encontra sessão nenhuma e cai na tela de login.
export const storageComLembrarMe = {
  async getItem(chave: string) {
    if (sessaoEmMemoria.has(chave)) return sessaoEmMemoria.get(chave) ?? null;
    return AsyncStorage.getItem(chave);
  },
  async setItem(chave: string, valor: string) {
    if (lembrarLogin) {
      sessaoEmMemoria.delete(chave);
      await AsyncStorage.setItem(chave, valor);
    } else {
      sessaoEmMemoria.set(chave, valor);
      await AsyncStorage.removeItem(chave);
    }
  },
  async removeItem(chave: string) {
    sessaoEmMemoria.delete(chave);
    await AsyncStorage.removeItem(chave);
  },
};

const CHAVE_ULTIMO_EMAIL = '@escola_schmidt/ultimo_email';

// "Lembrar de mim" também deveria pré-preencher o e-mail no próximo login —
// controla isso à parte da sessão em si (acima), porque o e-mail é só
// conveniência de digitação, sem risco de segurança em ficar no AsyncStorage
// mesmo com a sessão indo só pra memória.
export async function lerUltimoEmailLembrado(): Promise<string | null> {
  return AsyncStorage.getItem(CHAVE_ULTIMO_EMAIL);
}

export async function salvarUltimoEmailLembrado(email: string, lembrar: boolean): Promise<void> {
  if (lembrar) {
    await AsyncStorage.setItem(CHAVE_ULTIMO_EMAIL, email);
  } else {
    await AsyncStorage.removeItem(CHAVE_ULTIMO_EMAIL);
  }
}
