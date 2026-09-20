const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockOrder = jest.fn();
const mockInvoke = jest.fn();
const mockFrom = jest.fn((_table: string) => ({
  select: mockSelect,
  update: mockUpdate,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: { invoke: (fn: string, args: unknown) => mockInvoke(fn, args) },
  },
}));

import { atualizarAtivo, atualizarPapel, convidarUsuario, getUsuario, getUsuarios } from './api';

describe('usuarios api', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockSingle.mockClear();
    mockOrder.mockClear();
    mockInvoke.mockClear();

    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('lists all users ordered by name', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        { id: 'user-1', nome: 'Ana', papel: 'dono', telefone: null, ativo: true, criado_em: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });

    const usuarios = await getUsuarios();

    expect(mockFrom).toHaveBeenCalledWith('perfis');
    expect(mockSelect).toHaveBeenCalledWith('id, nome, papel, telefone, ativo, criado_em');
    expect(mockOrder).toHaveBeenCalledWith('nome');
    expect(usuarios).toHaveLength(1);
  });

  it('throws when listing users fails', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('falha ao listar') });

    await expect(getUsuarios()).rejects.toThrow('falha ao listar');
  });

  it('loads a single user by id', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'user-1', nome: 'Ana', papel: 'dono', telefone: null, ativo: true, criado_em: '2026-01-01T00:00:00Z' },
      error: null,
    });

    const usuario = await getUsuario('user-1');

    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(usuario.nome).toBe('Ana');
  });

  it('invites a new user with the chosen role via the Edge Function', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true, perfil_id: 'novo-id' }, error: null });

    const resultado = await convidarUsuario('prof@escola.com', 'Prof Ana', 'professor');

    expect(mockInvoke).toHaveBeenCalledWith('convidar-usuario', {
      body: { email: 'prof@escola.com', nome: 'Prof Ana', papel: 'professor' },
    });
    expect(resultado.perfil_id).toBe('novo-id');
  });

  it('surfaces the Edge Function error message when the invite fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { context: { json: () => Promise.resolve({ error: 'Somente o dono pode convidar novos usuários.' }) } },
    });

    await expect(convidarUsuario('prof@escola.com', 'Prof Ana', 'professor')).rejects.toThrow(
      'Somente o dono pode convidar novos usuários.'
    );
  });

  it('updates a role, restricted by the perfil_dono_gerencia policy on the server', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    await atualizarPapel('user-1', 'aluno');

    expect(mockUpdate).toHaveBeenCalledWith({ papel: 'aluno' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when updating a role fails', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('sem permissão') });

    await expect(atualizarPapel('user-1', 'aluno')).rejects.toThrow('sem permissão');
  });

  it('toggles active status', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    await atualizarAtivo('user-1', false);

    expect(mockUpdate).toHaveBeenCalledWith({ ativo: false });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });
});
