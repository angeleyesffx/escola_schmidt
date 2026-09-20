import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { RadarChart } from './RadarChart';

const EIXOS = [
  { id: 'a', label: 'Fundamentos', percentual: 80 },
  { id: 'b', label: 'Giros', percentual: 40 },
  { id: 'c', label: 'Saltos', percentual: 100 },
  { id: 'd', label: 'Passos', percentual: 0 },
];

function contarPorTipo(no: ReactTestRendererJSON | ReactTestRendererJSON[] | null, tipo: string): number {
  if (no == null) return 0;
  if (Array.isArray(no)) return no.reduce((soma, item) => soma + contarPorTipo(item, tipo), 0);
  const proprio = no.type === tipo ? 1 : 0;
  return proprio + contarPorTipo(no.children as ReactTestRendererJSON[] | null, tipo);
}

describe('RadarChart', () => {
  it('não renderiza nada com menos de 3 eixos', async () => {
    const { toJSON } = await render(<RadarChart eixos={EIXOS.slice(0, 2)} />);
    expect(toJSON()).toBeNull();
  });

  it('desenha um ponto por eixo e os anéis de grade + o polígono de dados', async () => {
    const { toJSON } = await render(<RadarChart eixos={EIXOS} />);
    const arvore = toJSON();

    expect(contarPorTipo(arvore, 'RNSVGCircle')).toBe(EIXOS.length);
    // Polygon é desenhado como RNSVGPath internamente pelo react-native-svg —
    // 4 anéis de grade (ANEIS) + 1 polígono com os dados do aluno, sempre 5
    // independente do número de eixos.
    expect(contarPorTipo(arvore, 'RNSVGPath')).toBe(5);
  });

  it('não quebra nas bordas do intervalo (0% e 100%)', async () => {
    await expect(render(<RadarChart eixos={EIXOS} />)).resolves.toBeTruthy();
  });

  it('aceita até 7 eixos sem quebrar', async () => {
    const seteEixos = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      label: `Eixo ${i}`,
      percentual: 50,
    }));

    const { toJSON } = await render(<RadarChart eixos={seteEixos} />);
    expect(contarPorTipo(toJSON(), 'RNSVGCircle')).toBe(7);
  });
});
