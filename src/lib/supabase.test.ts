jest.mock('react-native-url-polyfill/auto', () => ({}));

const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const mockCreateClient = jest.fn((url: string, key: string, options: unknown) => ({
  url,
  key,
  options,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: [string, string, unknown]) => mockCreateClient(...args),
}));

const originalEnv = process.env;

function loadSupabaseModule() {
  return require('./supabase') as typeof import('./supabase');
}

describe('supabase client', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates the singleton client with mobile auth storage defaults', () => {
    const module = loadSupabaseModule();
    const { storageComLembrarMe } = require('./rememberMeStorage') as typeof import('./rememberMeStorage');

    expect(mockCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key', {
      auth: {
        storage: storageComLembrarMe,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    expect(module.supabase).toEqual({
      url: 'https://example.supabase.co',
      key: 'anon-key',
      options: {
        auth: {
          storage: storageComLembrarMe,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
    });
  });

  it('throws a clear error when env vars are missing', () => {
    const module = loadSupabaseModule();

    expect(() =>
      module.getSupabaseConfig({
        NODE_ENV: 'test',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      })
    ).toThrow(
      'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha.'
    );
  });

  it('does not throw on import when env vars are missing, only on first use', () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const module = loadSupabaseModule();

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(() => module.supabase.auth).toThrow(module.MISSING_ENV_ERROR);
  });

  it('allows creating clients with injected storage', () => {
    const module = loadSupabaseModule();
    const customStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    const client = module.createSupabaseClient('https://tenant.supabase.co', 'tenant-key', customStorage as never);

    expect(mockCreateClient).toHaveBeenLastCalledWith('https://tenant.supabase.co', 'tenant-key', {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    expect(client).toEqual({
      url: 'https://tenant.supabase.co',
      key: 'tenant-key',
      options: {
        auth: {
          storage: customStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
    });
  });
});