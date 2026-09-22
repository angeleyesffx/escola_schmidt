import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Signup from '../signup';
import { hojeBR, paraISO } from '../../../src/lib/dataBR';

// DateRangePicker não tem testID por dia da grade — os testes abaixo abrem o
// campo e confirmam direto (aceita a data padrão, que é hoje) em vez de
// navegar até um dia específico. O que esses testes verificam é a pareação
// nome+data e o formato do payload, não a mecânica do calendário.
const HOJE_ISO = paraISO(hojeBR())!;

async function confirmarDataAberta() {
  await fireEvent.press(screen.getByText('Confirmar'));
}

const mockSignUp = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

const SENHA_FORTE = 'Senha@123';

describe('Signup', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockReplace.mockReset();
    mockSignUp.mockResolvedValue({ error: null });
  });

  async function preencherFormularioValido() {
    await fireEvent.changeText(screen.getByTestId('signup-input-nome'), 'Ana Silva');
    await fireEvent.changeText(screen.getByTestId('signup-input-email'), 'ana@escola.com');
    await fireEvent.changeText(screen.getByTestId('signup-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('signup-input-confirmar-senha'), SENHA_FORTE);
    await fireEvent.press(screen.getByTestId('signup-consentimento-checkbox'));
  }

  it('keeps the submit button disabled until every requirement is met', async () => {
    await render(<Signup />);

    expect(screen.getByTestId('signup-button-criar-conta').props.accessibilityState.disabled).toBe(true);
  });

  // Analise de valor limite pra `nome.trim().length >= 3`: 2 caracteres
  // (apos trim) ainda deve manter o botao desabilitado.
  it('keeps the submit button disabled when the name is below the 3-character minimum', async () => {
    await render(<Signup />);

    await fireEvent.changeText(screen.getByTestId('signup-input-nome'), ' Jo ');
    await fireEvent.changeText(screen.getByTestId('signup-input-email'), 'ana@escola.com');
    await fireEvent.changeText(screen.getByTestId('signup-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('signup-input-confirmar-senha'), SENHA_FORTE);
    await fireEvent.press(screen.getByTestId('signup-consentimento-checkbox'));

    expect(screen.getByTestId('signup-button-criar-conta').props.accessibilityState.disabled).toBe(true);
  });

  it('enables the submit button once name, email, password, confirmation and consent are all valid', async () => {
    await render(<Signup />);

    await preencherFormularioValido();

    expect(screen.getByTestId('signup-button-criar-conta').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a mismatch message only after the confirmation field has content and differs', async () => {
    await render(<Signup />);

    expect(screen.queryByTestId('signup-erro-senhas-diferentes')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('signup-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('signup-input-confirmar-senha'), 'outraSenha');

    expect(screen.getByTestId('signup-erro-senhas-diferentes')).toBeTruthy();
  });

  it('shows the responsavel consent text when that option is selected', async () => {
    await render(<Signup />);

    expect(screen.getByText(/Confirmo que sou maior de idade/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));

    expect(screen.getByText(/Confirmo que sou responsável legal por um aluno menor de idade/)).toBeTruthy();
  });

  it('submits trimmed name and email and shows the confirmation screen on success', async () => {
    await render(<Signup />);

    await fireEvent.changeText(screen.getByTestId('signup-input-nome'), '  Ana Silva  ');
    await fireEvent.changeText(screen.getByTestId('signup-input-email'), '  ana@escola.com  ');
    await fireEvent.changeText(screen.getByTestId('signup-input-senha'), SENHA_FORTE);
    await fireEvent.changeText(screen.getByTestId('signup-input-confirmar-senha'), SENHA_FORTE);
    await fireEvent.press(screen.getByTestId('signup-consentimento-checkbox'));

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'proprio',
        '2026-09-20',
        []
      );
    });
    expect(await screen.findByText('Cadastro enviado')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('signup-sucesso-voltar-login'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('passes titular "responsavel" to signUp when that option is chosen', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'responsavel',
        '2026-09-20',
        []
      );
    });
  });

  it('does not show the children fields for a "proprio" signup', async () => {
    await render(<Signup />);

    expect(screen.queryByTestId('signup-filho-nome-0')).toBeNull();
  });

  it('shows one empty children field by default when "responsavel" is chosen', async () => {
    await render(<Signup />);

    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));

    expect(screen.getByTestId('signup-filho-nome-0')).toBeTruthy();
  });

  it('lets someone add and fill more than one child field, and submits trimmed non-empty names paired with their birth date', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-0'), '  Filho A  ');
    await fireEvent.press(screen.getByTestId('signup-filho-data-0'));
    await confirmarDataAberta();
    await fireEvent.press(screen.getByTestId('signup-filho-adicionar'));
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-1'), '   ');
    await fireEvent.press(screen.getByTestId('signup-filho-adicionar'));
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-2'), 'Filho B');
    await fireEvent.press(screen.getByTestId('signup-filho-data-2'));
    await confirmarDataAberta();

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'responsavel',
        '2026-09-20',
        [
          { nome: 'Filho A', dataNascimento: HOJE_ISO },
          { nome: 'Filho B', dataNascimento: HOJE_ISO },
        ]
      );
    });
  });

  it('blocks submit with an error when a child name is filled in without a birth date', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-0'), 'Filho A');

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    expect(await screen.findByTestId('signup-mensagem-erro')).toHaveTextContent(
      'Informe a data de nascimento de cada filho preenchido.'
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('does not show the "also a student" checkbox for a "proprio" signup', async () => {
    await render(<Signup />);

    expect(screen.queryByTestId('signup-sou-tambem-aluno')).toBeNull();
  });

  it('prepends the account holder\'s own name to the students list when "also a student" is checked', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.press(screen.getByTestId('signup-sou-tambem-aluno'));
    await fireEvent.press(screen.getByTestId('signup-data-propria'));
    await confirmarDataAberta();
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-0'), 'Filho A');
    await fireEvent.press(screen.getByTestId('signup-filho-data-0'));
    await confirmarDataAberta();

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'responsavel',
        '2026-09-20',
        [
          { nome: 'Ana Silva', dataNascimento: HOJE_ISO },
          { nome: 'Filho A', dataNascimento: HOJE_ISO },
        ]
      );
    });
  });

  it('blocks submit with an error when "also a student" is checked without the account holder\'s own birth date', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.press(screen.getByTestId('signup-sou-tambem-aluno'));

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    expect(await screen.findByTestId('signup-mensagem-erro')).toHaveTextContent(
      'Informe sua data de nascimento.'
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('does not add the account holder as a student when the checkbox is left unchecked', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));
    await fireEvent.changeText(screen.getByTestId('signup-filho-nome-0'), 'Filho A');
    await fireEvent.press(screen.getByTestId('signup-filho-data-0'));
    await confirmarDataAberta();

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'responsavel',
        '2026-09-20',
        [{ nome: 'Filho A', dataNascimento: HOJE_ISO }]
      );
    });
  });

  it('does not block submit when "responsavel" is chosen and no child name is filled in', async () => {
    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-titular-responsavel'));

    expect(screen.getByTestId('signup-button-criar-conta').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'Ana Silva',
        'ana@escola.com',
        SENHA_FORTE,
        'responsavel',
        '2026-09-20',
        []
      );
    });
  });

  it('shows the returned error and stays on the form when sign up fails', async () => {
    mockSignUp.mockResolvedValueOnce({ error: 'Este email já está cadastrado.' });

    await render(<Signup />);

    await preencherFormularioValido();
    await fireEvent.press(screen.getByTestId('signup-button-criar-conta'));

    expect(await screen.findByTestId('signup-mensagem-erro')).toHaveTextContent(
      'Este email já está cadastrado.'
    );
    expect(screen.queryByText('Cadastro enviado')).toBeNull();
  });
});
