import { criarEvento, getEventosPorPeriodo, getTiposEvento } from './api';
import { buscarFeriadosEstado, importarFeriados } from './feriados';

jest.mock('./api', () => ({
  criarEvento: jest.fn(),
  getEventosPorPeriodo: jest.fn(),
  getTiposEvento: jest.fn(),
}));

const mockCriarEvento = criarEvento as jest.MockedFunction<typeof criarEvento>;
const mockGetEventosPorPeriodo = getEventosPorPeriodo as jest.MockedFunction<typeof getEventosPorPeriodo>;
const mockGetTiposEvento = getTiposEvento as jest.MockedFunction<typeof getTiposEvento>;

const TIPO_FERIADO = { id: 'tipo-feriado', nome: 'Feriado', cor: '#1BA97B', ordem: 5 };

function mockFetchFeriados(feriados: { id: string; data: string; nome: string; tipo: string }[]) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => feriados,
  }) as unknown as typeof fetch;
}

describe('buscarFeriadosEstado', () => {
  const envOriginal = process.env.EXPO_PUBLIC_FERIADOS_API_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_FERIADOS_API_KEY = envOriginal;
    jest.restoreAllMocks();
  });

  it('usa a fonte pública quando a chave não está configurada', async () => {
    delete process.env.EXPO_PUBLIC_FERIADOS_API_KEY;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-01-01', name: 'Ano Novo', type: 'national' }],
    }) as unknown as typeof fetch;

    await expect(buscarFeriadosEstado('SP', 2026)).resolves.toEqual([
      { id: '2026-01-01', data: '2026-01-01', nome: 'Ano Novo', tipo: 'national' },
    ]);
  });
});

describe('importarFeriados', () => {
  const envOriginal = process.env.EXPO_PUBLIC_FERIADOS_API_KEY;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_FERIADOS_API_KEY = 'chave-de-teste';
    mockCriarEvento.mockReset();
    mockCriarEvento.mockResolvedValue(undefined);
    mockGetEventosPorPeriodo.mockReset();
    mockGetTiposEvento.mockReset();
    mockGetTiposEvento.mockResolvedValue([TIPO_FERIADO]);
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_FERIADOS_API_KEY = envOriginal;
    jest.restoreAllMocks();
  });

  it('cria um evento por feriado quando nada foi importado antes', async () => {
    mockFetchFeriados([
      { id: '1', data: '2026-01-01', nome: 'Confraternização Universal', tipo: 'nacional' },
      { id: '2', data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
    ]);
    mockGetEventosPorPeriodo.mockResolvedValue([]);

    const resultado = await importarFeriados('SP', 2026, 'dono-1');

    expect(resultado).toEqual({ total: 2, importados: 2 });
    expect(mockCriarEvento).toHaveBeenCalledTimes(2);
    expect(mockCriarEvento).toHaveBeenCalledWith(
      'tipo-feriado',
      'Confraternização Universal',
      '2026-01-01',
      '2026-01-01',
      null,
      'dono-1'
    );
  });

  it('não duplica um feriado que já foi importado (mesmo tipo+título+data)', async () => {
    mockFetchFeriados([
      { id: '1', data: '2026-01-01', nome: 'Confraternização Universal', tipo: 'nacional' },
      { id: '2', data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional' },
    ]);
    mockGetEventosPorPeriodo.mockResolvedValue([
      {
        id: 'evt-1',
        tipo_id: 'tipo-feriado',
        titulo: 'Confraternização Universal',
        data_inicio: '2026-01-01',
        data_fim: '2026-01-01',
        descricao: null,
      },
    ]);

    const resultado = await importarFeriados('SP', 2026, 'dono-1');

    expect(resultado).toEqual({ total: 2, importados: 1 });
    expect(mockCriarEvento).toHaveBeenCalledTimes(1);
    expect(mockCriarEvento).toHaveBeenCalledWith(
      'tipo-feriado',
      'Tiradentes',
      '2026-04-21',
      '2026-04-21',
      null,
      'dono-1'
    );
  });

  it('lança erro claro se o tipo "Feriado" não existe no catálogo de eventos', async () => {
    mockFetchFeriados([{ id: '1', data: '2026-01-01', nome: 'Ano Novo', tipo: 'nacional' }]);
    mockGetTiposEvento.mockResolvedValue([]);

    await expect(importarFeriados('SP', 2026, 'dono-1')).rejects.toThrow('Tipo de evento "Feriado"');
    expect(mockCriarEvento).not.toHaveBeenCalled();
  });
});
