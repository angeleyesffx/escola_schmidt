import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { colors, type } from '../constants/theme';

export type EixoRadar = {
  id: string;
  label: string;
  percentual: number;
};

type Props = {
  eixos: EixoRadar[];
  tamanho?: number;
};

const ANEIS = [0.25, 0.5, 0.75, 1];

function pontoNoEixo(indice: number, total: number, raioRelativo: number, centro: number, raioMaximo: number) {
  // Começa no topo (-90°) e distribui os eixos em sentido horário — mesma
  // convenção visual de qualquer radar/spider chart (Epico 4 do documento
  // de visão original, docs/minha-evolucao.md).
  const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / total;
  const raio = raioMaximo * raioRelativo;
  return {
    x: centro + raio * Math.cos(angulo),
    y: centro + raio * Math.sin(angulo),
  };
}

/** Radar pedagógico com 3-7 eixos (uma macroárea por eixo) — substitui a
 * lista de barras horizontais que cobria o mesmo dado sem a forma pedida
 * pelo Epico 4 do documento de visão (achado 4.3 de
 * docs/product/evolucao-vs-desempenho.md). Desenhado com react-native-svg
 * em vez de biblioteca de gráfico pronta — o app não tem nenhuma outra
 * dependência de chart, e um radar de poucos eixos é pouca matemática pra
 * justificar puxar uma lib inteira. */
export function RadarChart({ eixos, tamanho = 220 }: Props) {
  if (eixos.length < 3) {
    return null;
  }

  const rotuloEspaco = 34;
  const centro = tamanho / 2;
  const raioMaximo = tamanho / 2 - rotuloEspaco;
  const total = eixos.length;

  const pontosDado = eixos
    .map((eixo, indice) => pontoNoEixo(indice, total, Math.max(eixo.percentual, 0) / 100, centro, raioMaximo))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <Svg width={tamanho} height={tamanho} testID="radar-chart">
      {ANEIS.map((anel) => {
        const pontos = eixos
          .map((_, indice) => pontoNoEixo(indice, total, anel, centro, raioMaximo))
          .map((p) => `${p.x},${p.y}`)
          .join(' ');
        return (
          <Polygon key={anel} points={pontos} fill="none" stroke={colors.border} strokeWidth={1} />
        );
      })}

      {eixos.map((eixo, indice) => {
        const ponta = pontoNoEixo(indice, total, 1, centro, raioMaximo);
        return (
          <Line
            key={eixo.id}
            x1={centro}
            y1={centro}
            x2={ponta.x}
            y2={ponta.y}
            stroke={colors.border}
            strokeWidth={1}
          />
        );
      })}

      <Polygon points={pontosDado} fill={colors.primarySoft} fillOpacity={0.45} stroke={colors.primary} strokeWidth={2} />

      {eixos.map((eixo, indice) => {
        const ponto = pontoNoEixo(indice, total, Math.max(eixo.percentual, 0) / 100, centro, raioMaximo);
        return <Circle key={eixo.id} cx={ponto.x} cy={ponto.y} r={3} fill={colors.primary} />;
      })}

      {eixos.map((eixo, indice) => {
        const rotulo = pontoNoEixo(indice, total, 1.18, centro, raioMaximo);
        return (
          <SvgText
            key={eixo.id}
            x={rotulo.x}
            y={rotulo.y}
            fontSize={type.caption.fontSize}
            fill={colors.textMuted}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {eixo.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
