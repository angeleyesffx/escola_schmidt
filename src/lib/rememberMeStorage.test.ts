const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function loadModule() {
  return require('./rememberMeStorage') as typeof import('./rememberMeStorage');
}

describe('storageComLembrarMe', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAsyncStorage.getItem.mockReset();
    mockAsyncStorage.setItem.mockReset();
    mockAsyncStorage.removeItem.mockReset();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  });

  it('persists to AsyncStorage by default (lembrar-me starts true)', async () => {
    const { storageComLembrarMe } = loadModule();

    await storageComLembrarMe.setItem('sessao', 'token-1');

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('sessao', 'token-1');
    expect(await storageComLembrarMe.getItem('sessao')).toBe(null);
    // getItem consulta o AsyncStorage real (mockado) quando não há nada em memória.
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('sessao');
  });

  it('keeps the session only in memory and clears AsyncStorage when lembrar-me is false', async () => {
    const { storageComLembrarMe, definirLembrarLogin } = loadModule();
    definirLembrarLogin(false);

    await storageComLembrarMe.setItem('sessao', 'token-2');

    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('sessao');
    expect(await storageComLembrarMe.getItem('sessao')).toBe('token-2');
  });

  it('drops the in-memory value once lembrar-me is turned back on and a new value is set', async () => {
    const { storageComLembrarMe, definirLembrarLogin } = loadModule();
    definirLembrarLogin(false);
    await storageComLembrarMe.setItem('sessao', 'token-3');

    definirLembrarLogin(true);
    await storageComLembrarMe.setItem('sessao', 'token-4');

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('sessao', 'token-4');
    // getItem agora deve vir do AsyncStorage (mock devolve null), não mais da memória.
    expect(await storageComLembrarMe.getItem('sessao')).toBe(null);
  });

  it('removes the key from both memory and AsyncStorage', async () => {
    const { storageComLembrarMe, definirLembrarLogin } = loadModule();
    definirLembrarLogin(false);
    await storageComLembrarMe.setItem('sessao', 'token-5');

    await storageComLembrarMe.removeItem('sessao');

    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('sessao');
    expect(await storageComLembrarMe.getItem('sessao')).toBe(null);
  });
});
