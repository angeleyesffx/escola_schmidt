const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn((_table: string) => ({
  select: mockSelect,
  update: mockUpdate,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

import { atualizarMeuPerfil, getMeuPerfil } from './api';

describe('perfil api', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();

    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it('loads profile by user id', async () => {
    mockEq.mockReturnValueOnce({
      single: () => Promise.resolve({
        data: {
          id: 'user-1',
          nome: 'Ana Silva',
          papel: 'dono',
          telefone: '(11) 99999-9999',
          criado_em: '2026-09-01T10:00:00Z',
        },
        error: null,
      }),
    });

    const perfil = await getMeuPerfil('user-1');

    expect(mockFrom).toHaveBeenCalledWith('perfis');
    expect(mockSelect).toHaveBeenCalledWith('id, nome, papel, telefone, criado_em');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(perfil.nome).toBe('Ana Silva');
  });

  it('updates profile name and phone', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    await atualizarMeuPerfil('user-1', {
      nome: 'Nome Novo',
      telefone: null,
    });

    expect(mockFrom).toHaveBeenCalledWith('perfis');
    expect(mockUpdate).toHaveBeenCalledWith({ nome: 'Nome Novo', telefone: null });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when update fails', async () => {
    mockEq.mockResolvedValueOnce({ error: new Error('falha de update') });

    await expect(
      atualizarMeuPerfil('user-1', {
        nome: 'Nome Novo',
        telefone: '(11) 98888-8888',
      })
    ).rejects.toThrow('falha de update');
  });
});
