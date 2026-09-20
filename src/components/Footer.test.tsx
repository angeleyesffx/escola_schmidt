import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { Footer } from './Footer';

function contemProp(no: ReactTestRendererJSON | ReactTestRendererJSON[] | null, prop: string, valor: unknown): boolean {
  if (no == null) return false;
  if (Array.isArray(no)) return no.some((item) => contemProp(item, prop, valor));
  if (no.props?.[prop] === valor) return true;
  return contemProp(no.children as ReactTestRendererJSON[] | null, prop, valor);
}

describe('Footer', () => {
  it('usa resizeMode "cover" no banner, não "stretch" (evita distorcer a imagem fora de proporção)', async () => {
    const { toJSON } = await render(<Footer />);

    expect(contemProp(toJSON(), 'resizeMode', 'cover')).toBe(true);
    expect(contemProp(toJSON(), 'resizeMode', 'stretch')).toBe(false);
  });

  it('mostra o copyright da empresa com o ano atual', async () => {
    const { getByText } = await render(<Footer />);

    const anoAtual = new Date().getFullYear();
    expect(getByText(`© ${anoAtual} V&P SOLUTIONS LTDA. Todos os direitos reservados.`)).toBeTruthy();
  });
});
