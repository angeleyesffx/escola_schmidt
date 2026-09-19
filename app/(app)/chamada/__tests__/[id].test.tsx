import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ChamadaDetalhe from '../[id]';
import {
  ConflitoPresencaError,
  aprovarPedido,
  getAulaRecorrente,
  getAlunosPorModulos,
  getMeuPedido,
  getOuCriaAula,
  getPedidosPendentes,
  getPresencas,
  getProfessoresDoModulo,
  marcarPresenca,
  pedirPresenca,
  recusarPedido,
} from '../../../../src/features/chamada/api';
import { exportarChamada } from '../../../../src/features/chamada/export';

const mockBack = jest.fn();
const mockSearchParams: { id: string; data?: string } = { id: 'rec-1', data: '2026-09-16' };
const mockUseAuth = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react') as typeof import('react');
    React.useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../../src/features/chamada/api', () => {
  class ConflitoPresencaError extends Error {
    constructor() {
      super('Esta chamada foi atualizada por outra pessoa. Recarregue para continuar.');
    }
  }

  return {
    ConflitoPresencaError,
    getAulaRecorrente: jest.fn(),
    getAlunosPorModulos: jest.fn(),
    getOuCriaAula: jest.fn(),
    getPresencas: jest.fn(),
    getPedidosPendentes: jest.fn(),
    getMeuPedido: jest.fn(),
    getProfessoresDoModulo: jest.fn(),
    pedirPresenca: jest.fn(),
    aprovarPedido: jest.fn(),
    recusarPedido: jest.fn(),
    marcarPresenca: jest.fn(),
  };
});

jest.mock('../../../../src/features/chamada/export', () => ({
  exportarChamada: jest.fn(),
}));

const mockExportarChamada = exportarChamada as jest.MockedFunction<typeof exportarChamada>;
const mockGetAulaRecorrente = getAulaRecorrente as jest.MockedFunction<typeof getAulaRecorrente>;
const mockGetAlunosPorModulos = getAlunosPorModulos as jest.MockedFunction<typeof getAlunosPorModulos>;
const mockGetOuCriaAula = getOuCriaAula as jest.MockedFunction<typeof getOuCriaAula>;
const mockGetPresencas = getPresencas as jest.MockedFunction<typeof getPresencas>;
const mockGetPedidosPendentes = getPedidosPendentes as jest.MockedFunction<typeof getPedidosPendentes>;
const mockGetMeuPedido = getMeuPedido as jest.MockedFunction<typeof getMeuPedido>;
const mockGetProfessoresDoModulo = getProfessoresDoModulo as jest.MockedFunction<typeof getProfessoresDoModulo>;
const mockPedirPresenca = pedirPresenca as jest.MockedFunction<typeof pedirPresenca>;
const mockAprovarPedido = aprovarPedido as jest.MockedFunction<typeof aprovarPedido>;
const mockRecusarPedido = recusarPedido as jest.MockedFunction<typeof recusarPedido>;
const mockMarcarPresenca = marcarPresenca as jest.MockedFunction<typeof marcarPresenca>;
let consoleErrorSpy: jest.SpyInstance;

describe('ChamadaDetalhe', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T10:00:00Z'));
    mockSearchParams.id = 'rec-1';
    mockSearchParams.data = '2026-09-16';
    mockBack.mockReset();
    mockGetAulaRecorrente.mockReset();
    mockGetAlunosPorModulos.mockReset();
    mockGetOuCriaAula.mockReset();
    mockGetPresencas.mockReset();
    mockGetPedidosPendentes.mockReset();
    mockGetMeuPedido.mockReset();
    mockGetProfessoresDoModulo.mockReset();
    mockPedirPresenca.mockReset();
    mockAprovarPedido.mockReset();
    mockRecusarPedido.mockReset();
    mockMarcarPresenca.mockReset();
    mockExportarChamada.mockReset();
    mockUseAuth.mockReset();

    mockUseAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      meuPapel: 'professor',
      meuAluno: null,
    });
    mockGetAulaRecorrente.mockResolvedValue({
      id: 'rec-1',
      dia_semana: 2,
      hora: '18:00:00',
      modulos: [1],
    });
    mockGetOuCriaAula.mockResolvedValue('aula-1');
    mockGetAlunosPorModulos.mockResolvedValue([{ id: 'aluno-1', nome: 'Ana', modulo: 1 }]);
    mockGetPresencas.mockResolvedValue([]);
    mockGetPedidosPendentes.mockResolvedValue([]);
    mockGetMeuPedido.mockResolvedValue(null);
    mockGetProfessoresDoModulo.mockResolvedValue([]);
    mockMarcarPresenca.mockResolvedValue('2026-09-18T10:30:00.000Z');
    mockExportarChamada.mockResolvedValue(undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('uses the selected date from query params', async () => {
    await render(<ChamadaDetalhe />);

    await waitFor(() => {
      expect(mockGetOuCriaAula).toHaveBeenCalledWith('rec-1', '2026-09-16', '18:00:00', 'user-1');
    });
    expect(screen.getByText('2026-09-16')).toBeTruthy();
  });

  it('falls back to today when date query is invalid', async () => {
    mockSearchParams.data = '16/09/2026';

    await render(<ChamadaDetalhe />);

    await waitFor(() => {
      expect(mockGetOuCriaAula).toHaveBeenCalledWith('rec-1', '2026-09-18', '18:00:00', 'user-1');
    });
  });

  it('shows conflict warning and blocks further edits when concurrent update is detected', async () => {
    mockMarcarPresenca.mockRejectedValueOnce(new ConflitoPresencaError());

    await render(<ChamadaDetalhe />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('chamada-detalhe-status-button-aluno-1-presente'));

    expect(await screen.findByTestId('chamada-detalhe-conflito-mensagem')).toHaveTextContent(
      'Esta chamada foi atualizada por outra pessoa. Recarregue para continuar.'
    );

    await fireEvent.press(screen.getByTestId('chamada-detalhe-status-button-aluno-1-falta_justificada'));
    expect(mockMarcarPresenca).toHaveBeenCalledTimes(1);
  });

  it('restores previous status when save fails and keeps version for retry', async () => {
    mockGetPresencas.mockResolvedValueOnce([
      { aluno_id: 'aluno-1', status: 'presente', registrado_em: '2026-09-15T10:00:00.000Z' },
    ]);
    mockMarcarPresenca.mockRejectedValueOnce(new Error('network down'));

    await render(<ChamadaDetalhe />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('chamada-detalhe-status-button-aluno-1-falta'));

    expect(await screen.findByTestId('chamada-detalhe-erro')).toHaveTextContent(
      'Erro ao salvar presença. Tente novamente.'
    );
    expect(mockMarcarPresenca).toHaveBeenCalledWith(
      'aula-1',
      'aluno-1',
      'falta',
      'user-1',
      '2026-09-15T10:00:00.000Z'
    );
  });

  // Regressão: antes do testID por aluno, os botões de status eram
  // selecionados por texto do ícone (✓ / J / ✕), que se repete em toda linha
  // da lista. Com 1 aluno só o teste não conseguia detectar o marco de um
  // aluno vazando pro estado de outro. Com 2 alunos isso fica explícito.
  it('marks presence for one student without affecting another in the same list', async () => {
    mockGetAlunosPorModulos.mockResolvedValueOnce([
      { id: 'aluno-1', nome: 'Ana', modulo: 1 },
      { id: 'aluno-2', nome: 'Bruno', modulo: 1 },
    ]);

    await render(<ChamadaDetalhe />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
      expect(screen.getByText('Bruno')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('chamada-detalhe-status-button-aluno-1-presente'));

    await waitFor(() => {
      expect(mockMarcarPresenca).toHaveBeenCalledWith('aula-1', 'aluno-1', 'presente', 'user-1', null);
    });
    expect(mockMarcarPresenca).not.toHaveBeenCalledWith(
      'aula-1',
      'aluno-2',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  // Seção "Pedidos de presença" (aprovar/recusar) em [id].tsx — antes desta
  // revisão tinha 0% de cobertura: getPedidosPendentes sempre resolvia []
  // nos outros testes, e aprovarPedido/recusarPedido eram mockados mas
  // nunca invocados nem asserted.
  describe('pedidos de presença (professor/dono)', () => {
    it('renders the pending requests section and approves a request', async () => {
      mockGetPedidosPendentes.mockResolvedValueOnce([
        {
          id: 'pedido-1',
          aula_id: 'aula-1',
          aluno_id: 'aluno-1',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:00:00.000Z',
          aluno_nome: 'Ana',
        },
      ]);
      mockAprovarPedido.mockResolvedValueOnce(undefined);

      await render(<ChamadaDetalhe />);

      await screen.findByText('Pedidos de presença');

      await fireEvent.press(screen.getByTestId('chamada-detalhe-pedido-aprovar-pedido-1'));

      await waitFor(() => {
        expect(mockAprovarPedido).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'pedido-1', aluno_id: 'aluno-1' }),
          'user-1'
        );
      });
      await waitFor(() => {
        expect(screen.queryByText('Pedidos de presença')).toBeNull();
      });
    });

    it('rejects a pending request', async () => {
      mockGetPedidosPendentes.mockResolvedValueOnce([
        {
          id: 'pedido-1',
          aula_id: 'aula-1',
          aluno_id: 'aluno-1',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:00:00.000Z',
          aluno_nome: 'Ana',
        },
      ]);
      mockRecusarPedido.mockResolvedValueOnce(undefined);

      await render(<ChamadaDetalhe />);

      await screen.findByText('Pedidos de presença');

      await fireEvent.press(screen.getByTestId('chamada-detalhe-pedido-recusar-pedido-1'));

      await waitFor(() => {
        expect(mockRecusarPedido).toHaveBeenCalledWith('pedido-1');
      });
      await waitFor(() => {
        expect(screen.queryByText('Pedidos de presença')).toBeNull();
      });
    });

    it('shows a generic error and keeps the request listed when approval fails', async () => {
      mockGetPedidosPendentes.mockResolvedValueOnce([
        {
          id: 'pedido-1',
          aula_id: 'aula-1',
          aluno_id: 'aluno-1',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:00:00.000Z',
          aluno_nome: 'Ana',
        },
      ]);
      mockAprovarPedido.mockRejectedValueOnce(new Error('network down'));

      await render(<ChamadaDetalhe />);

      await screen.findByText('Pedidos de presença');

      await fireEvent.press(screen.getByTestId('chamada-detalhe-pedido-aprovar-pedido-1'));

      expect(await screen.findByTestId('chamada-detalhe-erro')).toHaveTextContent(
        'Erro ao aprovar pedido. Tente novamente.'
      );
      expect(screen.getByText('Pedidos de presença')).toBeTruthy();
      expect(screen.getByTestId('chamada-detalhe-pedido-aprovar-pedido-1')).toBeTruthy();
    });

    it('shows a generic error when rejection fails', async () => {
      mockGetPedidosPendentes.mockResolvedValueOnce([
        {
          id: 'pedido-1',
          aula_id: 'aula-1',
          aluno_id: 'aluno-1',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:00:00.000Z',
          aluno_nome: 'Ana',
        },
      ]);
      mockRecusarPedido.mockRejectedValueOnce(new Error('network down'));

      await render(<ChamadaDetalhe />);

      await screen.findByText('Pedidos de presença');

      await fireEvent.press(screen.getByTestId('chamada-detalhe-pedido-recusar-pedido-1'));

      expect(await screen.findByTestId('chamada-detalhe-erro')).toHaveTextContent(
        'Erro ao recusar pedido. Tente novamente.'
      );
    });

    // Mesma classe de defeito da regressão de marcar presença acima: o
    // estado de "processando" é indexado por pedido.id, então precisa ficar
    // provado que aprovar um pedido não mexe no outro da mesma lista.
    it('approves only the targeted pending request when more than one is listed', async () => {
      mockGetPedidosPendentes.mockResolvedValueOnce([
        {
          id: 'pedido-1',
          aula_id: 'aula-1',
          aluno_id: 'aluno-1',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:00:00.000Z',
          aluno_nome: 'Ana',
        },
        {
          id: 'pedido-2',
          aula_id: 'aula-1',
          aluno_id: 'aluno-2',
          status: 'pendente',
          solicitado_em: '2026-09-18T09:05:00.000Z',
          aluno_nome: 'Bruno',
        },
      ]);
      mockAprovarPedido.mockResolvedValueOnce(undefined);

      await render(<ChamadaDetalhe />);

      await screen.findByText('Pedidos de presença');

      await fireEvent.press(screen.getByTestId('chamada-detalhe-pedido-aprovar-pedido-1'));

      await waitFor(() => {
        expect(mockAprovarPedido).toHaveBeenCalledWith(expect.objectContaining({ id: 'pedido-1' }), 'user-1');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('chamada-detalhe-pedido-aprovar-pedido-1')).toBeNull();
      });
      expect(screen.getByTestId('chamada-detalhe-pedido-aprovar-pedido-2')).toBeTruthy();
      expect(mockAprovarPedido).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'pedido-2' }), 'user-1');
    });
  });

  describe('exportação', () => {
    it('opens the format menu and exports as xlsx', async () => {
      await render(<ChamadaDetalhe />);

      await waitFor(() => {
        expect(screen.getByText('Ana')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('chamada-detalhe-exportar-botao'));
      await fireEvent.press(await screen.findByTestId('chamada-detalhe-exportar-xlsx'));

      await waitFor(() => {
        expect(mockExportarChamada).toHaveBeenCalledWith(
          expect.objectContaining({ data: '2026-09-16', horario: '18:00', formato: 'xlsx' })
        );
      });
      expect(screen.queryByTestId('chamada-detalhe-exportar-xlsx')).toBeNull();
    });

    it('exports as csv', async () => {
      await render(<ChamadaDetalhe />);

      await waitFor(() => {
        expect(screen.getByText('Ana')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('chamada-detalhe-exportar-botao'));
      await fireEvent.press(await screen.findByTestId('chamada-detalhe-exportar-csv'));

      await waitFor(() => {
        expect(mockExportarChamada).toHaveBeenCalledWith(expect.objectContaining({ formato: 'csv' }));
      });
    });

    it('closes the menu without exporting when cancelled', async () => {
      await render(<ChamadaDetalhe />);

      await waitFor(() => {
        expect(screen.getByText('Ana')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('chamada-detalhe-exportar-botao'));
      await fireEvent.press(await screen.findByTestId('chamada-detalhe-exportar-cancelar'));

      expect(screen.queryByTestId('chamada-detalhe-exportar-xlsx')).toBeNull();
      expect(mockExportarChamada).not.toHaveBeenCalled();
    });

    it('shows an error message when the export fails', async () => {
      mockExportarChamada.mockRejectedValueOnce(new Error('write failed'));

      await render(<ChamadaDetalhe />);

      await waitFor(() => {
        expect(screen.getByText('Ana')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('chamada-detalhe-exportar-botao'));
      await fireEvent.press(await screen.findByTestId('chamada-detalhe-exportar-xlsx'));

      expect(await screen.findByTestId('chamada-detalhe-exportar-erro')).toHaveTextContent(
        'Erro ao exportar a chamada. Tente novamente.'
      );
    });
  });

  // Ramo "aluno" (autocheckin) de [id].tsx — antes desta revisão tinha 0% de
  // cobertura porque o mock de useAuth fixava meuPapel: 'professor' sempre.
  describe('aluno view (autocheckin)', () => {
    const meuAluno = { id: 'aluno-1', nome: 'Ana', modulo: 1 };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'aluno-user-1' } },
        meuPapel: 'aluno',
        meuAluno,
      });
      // hoje, pela hora do sistema fixada no beforeEach externo (2026-09-18)
      mockSearchParams.data = '2026-09-18';
    });

    it('shows ineligibility message when the selected date is not today', async () => {
      mockSearchParams.data = '2026-09-16';

      await render(<ChamadaDetalhe />);

      expect(
        await screen.findByText('Você só pode pedir presença no dia e no horário da sua própria aula.')
      ).toBeTruthy();
      expect(screen.queryByTestId('chamada-detalhe-autocheckin-pedir')).toBeNull();
    });

    it('shows ineligibility message when the class module does not match the student module', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'aluno-user-1' } },
        meuPapel: 'aluno',
        meuAluno: { ...meuAluno, modulo: 2 },
      });

      await render(<ChamadaDetalhe />);

      expect(
        await screen.findByText('Você só pode pedir presença no dia e no horário da sua própria aula.')
      ).toBeTruthy();
    });

    it('shows ineligibility message and skips the teacher lookup when the student profile is not linked yet', async () => {
      mockUseAuth.mockReturnValue({
        session: { user: { id: 'aluno-user-1' } },
        meuPapel: 'aluno',
        meuAluno: null,
      });

      await render(<ChamadaDetalhe />);

      expect(
        await screen.findByText('Você só pode pedir presença no dia e no horário da sua própria aula.')
      ).toBeTruthy();
      expect(mockGetProfessoresDoModulo).not.toHaveBeenCalled();
    });

    it('shows the request button when eligible and no request or presence exists yet', async () => {
      await render(<ChamadaDetalhe />);

      expect(await screen.findByTestId('chamada-detalhe-autocheckin-pedir')).toBeTruthy();
    });

    it('sends the attendance request and switches to the pending state', async () => {
      mockPedirPresenca.mockResolvedValueOnce({
        id: 'pedido-1',
        aula_id: 'aula-1',
        aluno_id: 'aluno-1',
        status: 'pendente',
        solicitado_em: '2026-09-18T10:00:00.000Z',
      });

      await render(<ChamadaDetalhe />);

      await fireEvent.press(await screen.findByTestId('chamada-detalhe-autocheckin-pedir'));

      expect(mockPedirPresenca).toHaveBeenCalledWith('aula-1', 'aluno-1');
      expect(await screen.findByText('⏳ Pedido enviado')).toBeTruthy();
      expect(screen.queryByTestId('chamada-detalhe-autocheckin-pedir')).toBeNull();
    });

    it('shows a generic error and re-enables the button when the request fails', async () => {
      mockPedirPresenca.mockRejectedValueOnce(new Error('network down'));

      await render(<ChamadaDetalhe />);

      await fireEvent.press(await screen.findByTestId('chamada-detalhe-autocheckin-pedir'));

      expect(await screen.findByTestId('chamada-detalhe-erro')).toHaveTextContent(
        'Erro ao enviar pedido de presença. Tente novamente.'
      );
      expect(screen.getByTestId('chamada-detalhe-autocheckin-pedir').props.accessibilityState.disabled).toBe(
        false
      );
    });

    it('shows the pending card on load when a request is already pending', async () => {
      mockGetMeuPedido.mockResolvedValueOnce({
        id: 'pedido-1',
        aula_id: 'aula-1',
        aluno_id: 'aluno-1',
        status: 'pendente',
        solicitado_em: '2026-09-18T09:00:00.000Z',
      });

      await render(<ChamadaDetalhe />);

      expect(await screen.findByText('⏳ Pedido enviado')).toBeTruthy();
      expect(screen.queryByTestId('chamada-detalhe-autocheckin-pedir')).toBeNull();
    });

    it('shows the confirmed presence card when attendance was already marked', async () => {
      mockGetPresencas.mockResolvedValueOnce([
        { aluno_id: 'aluno-1', status: 'presente', registrado_em: '2026-09-18T15:30:00.000Z' },
      ]);

      await render(<ChamadaDetalhe />);

      expect(await screen.findByText('✓ Presença confirmada')).toBeTruthy();
      // Não fixamos a hora exata: toLocaleTimeString depende do fuso horário
      // do ambiente que roda o teste.
      expect(screen.getByText(/Registrada às \d{2}:\d{2}/)).toBeTruthy();
      expect(screen.queryByTestId('chamada-detalhe-autocheckin-pedir')).toBeNull();
    });

    it('shows the singular label with one teacher assigned to the module', async () => {
      mockGetProfessoresDoModulo.mockResolvedValueOnce([{ id: 'prof-1', nome: 'Carla' }]);

      await render(<ChamadaDetalhe />);

      expect(await screen.findByText('Professor(a): Carla')).toBeTruthy();
    });

    it('shows the plural label with more than one teacher assigned to the module', async () => {
      mockGetProfessoresDoModulo.mockResolvedValueOnce([
        { id: 'prof-1', nome: 'Carla' },
        { id: 'prof-2', nome: 'Bruno' },
      ]);

      await render(<ChamadaDetalhe />);

      expect(await screen.findByText('Professores: Carla, Bruno')).toBeTruthy();
    });
  });
});