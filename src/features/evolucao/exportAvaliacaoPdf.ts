import { Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Asset } from 'expo-asset';
// A API nova (default de 'expo-file-system') não tem leitura de arquivo em
// base64 — só a legada tem `readAsStringAsync`, por isso o import explícito.
// Nenhuma das duas funciona no web (vira UnavailabilityError), então lá a
// gente usa a URI do asset direto em vez de ler e converter pra base64.
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Aluno } from '../alunos/api';
import { paraBR } from '../../lib/dataBR';
import { getAvatarUrl } from '../perfil/api';
import type { AvaliacaoEvolucaoResumo, CriterioAvaliacaoDetalhe } from './types';

const STATUS_LABEL: Record<AvaliacaoEvolucaoResumo['status'], string> = {
  nao_iniciado: 'Não iniciado',
  aprendendo: 'Aprendendo',
  em_desenvolvimento: 'Em desenvolvimento',
  dominado: 'Dominado',
  consolidado: 'Consolidado',
};

const ANO_ATUAL = new Date().getFullYear();

// Mesmas fontes carregadas pelo app (app/_layout.tsx) — os módulos exportados
// pelos pacotes @expo-google-fonts já são asset IDs resolvíveis por Asset.
const FONTES_PDF = {
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} as const;

// expo-print não carrega imagens/fontes por require() direto no HTML —
// precisa do caminho local resolvido pelo Asset e lido como base64 pra virar
// um `data:` URI, senão o ícone e a tipografia da escola não aparecem no PDF.
// No web o próprio navegador busca a URI do asset direto, sem precisar ler
// o arquivo (que ali nem é suportado).
// A janela/iframe de impressão no web parte de about:blank — sem isso, a
// URI do asset (relativa) não resolve e a imagem/fonte não carrega.
function absolutizarUrl(uri: string) {
  try {
    return new URL(uri, window.location.href).toString();
  } catch {
    return uri;
  }
}

async function assetParaBase64(modulo: number) {
  const asset = Asset.fromModule(modulo);
  await asset.downloadAsync();
  return FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: 'base64' });
}

async function iconeEscolaBase64() {
  if (Platform.OS === 'web') {
    return absolutizarUrl(Asset.fromModule(require('../../../assets/icon.png')).uri);
  }
  const base64 = await assetParaBase64(require('../../../assets/icon.png'));
  return `data:image/png;base64,${base64}`;
}

async function fontFaceCss() {
  if (Platform.OS === 'web') {
    const entradas = Object.entries(FONTES_PDF).map(([nome, modulo]) => {
      const uri = absolutizarUrl(Asset.fromModule(modulo).uri);
      return `
        @font-face {
          font-family: '${nome}';
          src: url(${uri}) format('truetype');
        }`;
    });
    return entradas.join('\n');
  }

  const entradas = await Promise.all(
    Object.entries(FONTES_PDF).map(async ([nome, modulo]) => {
      const base64 = await assetParaBase64(modulo);
      return `
        @font-face {
          font-family: '${nome}';
          src: url(data:font/ttf;base64,${base64}) format('truetype');
        }`;
    })
  );
  return entradas.join('\n');
}

async function avatarAlunoPdf(aluno: Aluno) {
  const url = getAvatarUrl(aluno.avatar_path ?? null);
  if (!url) return null;
  if (Platform.OS === 'web') return absolutizarUrl(url);

  const destino = `${FileSystem.cacheDirectory}aluno-avatar-${aluno.id}`;
  const arquivo = await FileSystem.downloadAsync(url, destino);
  const base64 = await FileSystem.readAsStringAsync(arquivo.uri, { encoding: 'base64' });
  return `data:image/jpeg;base64,${base64}`;
}

type ItemSessao = { avaliacao: AvaliacaoEvolucaoResumo; criterios: CriterioAvaliacaoDetalhe[] };

function montarHtml(
  data: string,
  aluno: Aluno,
  itens: ItemSessao[],
  iconeBase64: string,
  fontFaces: string,
  avatarBase64: string | null
) {
  const secoes = itens
    .map(({ avaliacao, criterios }) => {
      const linhasCriterios = criterios
        .map(
          (criterio) => `
        <tr>
          <td>${criterio.nome}</td>
          <td class="centro">${criterio.peso}</td>
          <td class="centro">${criterio.percentual}%</td>
        </tr>`
        )
        .join('');

      return `
        <div class="faixa">
          <p class="categoria">${avaliacao.categoriaNome}</p>
          <h2>${avaliacao.habilidadeNome}</h2>
          <div class="linha-dado"><span>Status</span><strong>${STATUS_LABEL[avaliacao.status]}</strong></div>
          ${
            avaliacao.percentualGeral != null
              ? `<div class="linha-dado"><span>Percentual geral</span><strong>${avaliacao.percentualGeral}%</strong></div>`
              : ''
          }
          <div class="linha-dado"><span>Professor</span><strong>${avaliacao.professorNome ?? '—'}</strong></div>

          ${
            criterios.length
              ? `<table>
                  <thead>
                    <tr><th>Critério</th><th class="centro">Peso</th><th class="centro">Percentual</th></tr>
                  </thead>
                  <tbody>${linhasCriterios}</tbody>
                </table>`
              : ''
          }

          ${
            avaliacao.observacoes
              ? `<p class="observacoes"><strong>Observações:</strong> ${avaliacao.observacoes}</p>`
              : ''
          }
        </div>`;
    })
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <style>
          ${fontFaces}
          * { box-sizing: border-box; }
          body {
            font-family: 'Poppins_400Regular', -apple-system, Helvetica, Arial, sans-serif;
            color: #333333;
            margin: 0;
            padding: 32px;
          }
          .cabecalho {
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 3px solid #00B4CC;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .cabecalho img { width: 56px; height: 56px; object-fit: cover; }
          .cabecalho .foto-aluno { border-radius: 50%; }
          .cabecalho .tag {
            font-family: 'Poppins_500Medium';
            color: #00B4CC;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1px;
            margin: 0 0 4px;
          }
          .cabecalho h1 { font-family: 'Montserrat_700Bold'; font-size: 22px; margin: 0; }
          .resumo { font-size: 14px; margin-bottom: 20px; }
          .resumo strong { font-family: 'Poppins_600SemiBold'; }
          .faixa {
            background: #E6F7FA;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
          }
          .faixa h2 { font-family: 'Montserrat_600SemiBold'; margin: 0 0 4px; font-size: 18px; }
          .faixa .categoria {
            font-family: 'Poppins_500Medium';
            color: #00B4CC;
            text-transform: uppercase;
            font-size: 12px;
            margin: 0 0 12px;
          }
          .linha-dado { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
          .linha-dado strong { font-family: 'Poppins_600SemiBold'; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #DCE7EB; font-size: 13px; }
          th { font-family: 'Poppins_500Medium'; color: #6B7280; text-transform: uppercase; font-size: 11px; }
          .centro { text-align: center; }
          .observacoes { font-size: 14px; margin: 8px 0 0; }
          .observacoes strong { font-family: 'Poppins_600SemiBold'; }
          .rodape { text-align: center; color: #6B7280; font-size: 11px; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="cabecalho">
          <img class="${avatarBase64 ? 'foto-aluno' : ''}" src="${avatarBase64 ?? iconeBase64}" />
          <div>
            <p class="tag">Escola Schmidt</p>
            <h1>Avaliação de evolução</h1>
          </div>
        </div>

        <p class="resumo">
          <strong>Aluno:</strong> ${aluno.nome} · <strong>Data:</strong> ${paraBR(data)} ·
          <strong>${itens.length}</strong> habilidade${itens.length === 1 ? '' : 's'} avaliada${itens.length === 1 ? '' : 's'}
        </p>

        ${secoes}

        <p class="rodape">© ${ANO_ATUAL} V&amp;P SOLUTIONS LTDA. Todos os direitos reservados.</p>
      </body>
    </html>
  `;
}

// Popup + document.write imprimia em branco: a janela nova parte de
// about:blank e o print() disparava antes da imagem/fonte carregar. Um
// iframe oculto anexado à própria página resolve os dois problemas — espera
// o load (imagem incluída) e as fontes (`document.fonts.ready`) antes de
// chamar print(), e some sozinho depois.
async function imprimirHtmlNoWeb(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error('Não foi possível preparar a impressão.'));
    document.body.appendChild(iframe);

    const documentoIframe = iframe.contentDocument;
    if (!documentoIframe) {
      reject(new Error('Não foi possível preparar a impressão.'));
      return;
    }
    documentoIframe.open();
    documentoIframe.write(html);
    documentoIframe.close();
  });

  await iframe.contentDocument?.fonts?.ready;

  const janela = iframe.contentWindow;
  if (!janela) {
    document.body.removeChild(iframe);
    throw new Error('Não foi possível preparar a impressão.');
  }
  janela.focus();
  janela.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

/** Gera um único PDF com todas as habilidades avaliadas na mesma sessão
 * (mesma data) — não um documento por habilidade — e abre o share sheet,
 * mesmo padrão de src/features/chamada/export.ts. No web, expo-print não
 * gera um arquivo de verdade (só chama `window.print()` sem conteúdo), então
 * montamos um iframe oculto com o HTML e disparamos o print dele, que é como
 * se exporta "PDF" nesse ambiente (o usuário escolhe "Salvar como PDF" no
 * diálogo nativo do navegador). */
export async function exportarAvaliacaoPdf(data: string, itens: ItemSessao[], aluno: Aluno) {
  const [iconeBase64, fontFaces, avatarBase64] = await Promise.all([
    iconeEscolaBase64(),
    fontFaceCss(),
    avatarAlunoPdf(aluno),
  ]);
  const html = montarHtml(data, aluno, itens, iconeBase64, fontFaces, avatarBase64);

  if (Platform.OS === 'web') {
    await imprimirHtmlNoWeb(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }
}
