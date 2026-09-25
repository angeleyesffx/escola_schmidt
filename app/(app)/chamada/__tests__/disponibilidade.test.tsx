import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import DisponibilidadeParticularScreen from '../disponibilidade';

jest.mock('../../../../src/components/WebModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebModal: ({ children }: { children: React.ReactNode }) => <View testID="web-modal">{children}</View>,
  };
});

jest.mock('../../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    meuPapel: 'dono',
    session: { user: { id: 'prof-1' } },
    meusAlunos: [],
    signOut: jest.fn(),
  }),
}));

jest.mock('../../../../src/hooks/useAsyncData', () => ({
  useAsyncData: () => ({
    data: [],
    setData: jest.fn(),
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));

describe('DisponibilidadeParticularScreen', () => {
  it('renders inside the shared modal wrapper', async () => {
    await render(<DisponibilidadeParticularScreen />);

    expect(screen.getByTestId('web-modal')).toBeTruthy();
  });
});
