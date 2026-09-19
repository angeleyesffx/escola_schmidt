import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ChamadaIndex from '../index';
import {
  excluirAulaParticular,
  getAulasParticularesPorPeriodo,
  getAulasRecorrentesPorData,
  getGradeSemanal,
} from '../../../../src/features/chamada/api';
import { getEventosPorPeriodo, getTiposEvento } from '../../../../src/features/eventos/api';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react') as typeof import('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    meuPapel: 'dono',
  }),
}));

jest.mock('../../../../src/features/chamada/api', () => ({
  getAulasRecorrentesPorData: jest.fn(),
  getGradeSemanal: jest.fn(),
  getAulasParticularesPorPeriodo: jest.fn(),
  excluirAulaParticular: jest.fn(),
}));

jest.mock('../../../../src/features/eventos/api', () => ({
  getEventosPorPeriodo: jest.fn(),
  getTiposEvento: jest.fn(),
}));

const mockGetAulasRecorrentesPorData = getAulasRecorrentesPorData as jest.MockedFunction<
  typeof getAulasRecorrentesPorData
>;
const mockGetGradeSemanal = getGradeSemanal as jest.MockedFunction<typeof getGradeSemanal>;
const mockGetAulasParticularesPorPeriodo = getAulasParticularesPorPeriodo as jest.MockedFunction<
  typeof getAulasParticularesPorPeriodo
>;
const mockExcluirAulaParticular = excluirAulaParticular as jest.MockedFunction<typeof excluirAulaParticular>;
const mockGetEventosPorPeriodo = getEventosPorPeriodo as jest.MockedFunction<typeof getEventosPorPeriodo>;
const mockGetTiposEvento = getTiposEvento as jest.MockedFunction<typeof getTiposEvento>;

describe('ChamadaIndex', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T10:00:00Z'));
    mockPush.mockReset();
    mockGetAulasRecorrentesPorData.mockReset();
    mockGetAulasRecorrentesPorData.mockResolvedValue([]);
    mockGetGradeSemanal.mockReset();
    mockGetGradeSemanal.mockResolvedValue([]);
    mockGetAulasParticularesPorPeriodo.mockReset();
    mockGetAulasParticularesPorPeriodo.mockResolvedValue([]);
    mockExcluirAulaParticular.mockReset();
    mockExcluirAulaParticular.mockResolvedValue(undefined);
    mockGetEventosPorPeriodo.mockReset();
    mockGetEventosPorPeriodo.mockResolvedValue([]);
    mockGetTiposEvento.mockReset();
    mockGetTiposEvento.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads turmas for the selected date and supports week/month toggle', async () => {
    await render(<ChamadaIndex />);

    await waitFor(() => {
      expect(mockGetAulasRecorrentesPorData).toHaveBeenCalledWith('2026-09-18');
    });
    expect(await screen.findByText('Não há turmas para a data selecionada.')).toBeTruthy();
    expect(screen.getByText('Dom')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chamada-index-semana-dia-2026-09-14'));

    await waitFor(() => {
      expect(mockGetAulasRecorrentesPorData).toHaveBeenCalledWith('2026-09-14');
    });

    await fireEvent.press(screen.getByTestId('chamada-index-toggle-mes'));
    // O mês agora também tem um cabeçalho de dias da semana (Dom-Sáb), então
    // "Dom" continua na tela — só não é mais renderizado por cada card.
    expect(screen.getByText('Dom')).toBeTruthy();
  });

  it('navigates to attendance detail with selected date in query string', async () => {
    mockGetAulasRecorrentesPorData.mockResolvedValueOnce([
      { id: 'turma-1', dia_semana: 5, hora: '18:00:00', modulos: [1, 2] },
    ]);

    await render(<ChamadaIndex />);

    await fireEvent.press(await screen.findByTestId('chamada-index-turma-item-turma-1'));

    expect(mockPush).toHaveBeenCalledWith('/chamada/turma-1?data=2026-09-18');
  });

  it('filters period events by selected date and hides section on dates without events', async () => {
    mockGetEventosPorPeriodo.mockResolvedValueOnce([
      {
        id: 'evt-1',
        tipo_id: 'tipo-1',
        titulo: 'Festival interno',
        data_inicio: '2026-09-18',
        data_fim: '2026-09-18',
        descricao: null,
      },
      {
        id: 'evt-2',
        tipo_id: 'tipo-1',
        titulo: 'Treino especial',
        data_inicio: '2026-09-20',
        data_fim: '2026-09-20',
        descricao: null,
      },
    ]);
    mockGetTiposEvento.mockResolvedValueOnce([
      { id: 'tipo-1', nome: 'Treino', cor: '#00B4CC', ordem: 1 },
    ]);

    await render(<ChamadaIndex />);

    expect(await screen.findByText('Eventos deste período')).toBeTruthy();
    expect(screen.getByText('Festival interno')).toBeTruthy();
    expect(screen.getByText('Treino especial')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chamada-index-semana-dia-2026-09-14'));

    await waitFor(() => {
      expect(screen.queryByText('Eventos deste período')).toBeNull();
    });
    expect(screen.queryByText('Festival interno')).toBeNull();
    expect(screen.queryByText('Treino especial')).toBeNull();

    await fireEvent.press(screen.getByTestId('chamada-index-semana-dia-2026-09-18'));

    expect(await screen.findByText('Eventos da data selecionada')).toBeTruthy();
    expect(screen.getByText('Festival interno')).toBeTruthy();
    expect(screen.queryByText('Treino especial')).toBeNull();

    await fireEvent.press(screen.getByTestId('chamada-index-filtro-limpar'));

    expect(await screen.findByText('Eventos deste período')).toBeTruthy();
    expect(screen.getByText('Festival interno')).toBeTruthy();
    expect(screen.getByText('Treino especial')).toBeTruthy();
  });
});