const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn((_table: string) => ({
  select: mockSelect,
  update: mockUpdate,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
  },
}));

import { atualizarMeuPerfil, getMeuPerfil } from './api';

describe('perfil api', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockRpc.mockClear();

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
          avatar_path: null,
          criado_em: '2026-09-01T10:00:00Z',
        },
        error: null,
      }),
    });

    const perfil = await getMeuPerfil('user-1');

    expect(mockFrom).toHaveBeenCalledWith('perfis');
    expect(mockSelect).toHaveBeenCalledWith('id, nome, papel, telefone, avatar_path, criado_em');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(perfil.nome).toBe('Ana Silva');
  });

  // A policy de auto-edição de `perfis` foi removida (supabase/migrations/0017)
  // por não restringir colunas — atualizarMeuPerfil passou a chamar a RPC
  // atualizar_meu_perfil (SECURITY DEFINER, restrita a nome/telefone), que
  // identifica o usuário por auth.uid() no banco em vez de receber o id aqui.
  it('updates profile name and phone via RPC', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });

    await atualizarMeuPerfil({
      nome: 'Nome Novo',
      telefone: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('atualizar_meu_perfil', {
      p_nome: 'Nome Novo',
      p_telefone: null,
    });
  });

  it('throws when the RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ error: new Error('falha de update') });

    await expect(
      atualizarMeuPerfil({
        nome: 'Nome Novo',
        telefone: '(11) 98888-8888',
      })
    ).rejects.toThrow('falha de update');
  });
});
