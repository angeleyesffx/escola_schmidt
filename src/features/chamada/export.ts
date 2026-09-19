import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import type { Aluno, StatusPresenca } from './api';

export type FormatoExportacao = 'xlsx' | 'csv';

export type RegistroLocalExportacao = { status: StatusPresenca; registradoEm: string | null };

export type ExportarChamadaParams = {
  alunos: Aluno[];
  presencas: Record<string, RegistroLocalExportacao>;
  data: string;
  horario: string | null;
  formato: FormatoExportacao;
};

const LABEL_STATUS: Record<StatusPresenca, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_justificada: 'Falta justificada',
};

const MIME: Record<FormatoExportacao, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

// UTI só importa no iOS, pra o app escolher o app de destino certo no share sheet.
const UTI: Record<FormatoExportacao, string> = {
  xlsx: 'org.openxmlformats.spreadsheetml.sheet',
  csv: 'public.comma-separated-values-text',
};

function montarPlanilha({ alunos, presencas, data, horario }: Omit<ExportarChamadaParams, 'formato'>) {
  const linhas = [
    [`Chamada${horario ? ` ${horario}` : ''} — ${data}`],
    ['Aluno', 'Módulo', 'Status', 'Registrado em'],
    ...alunos.map((aluno) => {
      const registro = presencas[aluno.id];
      const registradoEm = registro?.registradoEm
        ? new Date(registro.registradoEm).toLocaleString('pt-BR')
        : '';
      return [
        aluno.nome,
        aluno.modulo,
        registro ? LABEL_STATUS[registro.status] : 'Não registrado',
        registradoEm,
      ];
    }),
  ];
  const planilha = XLSX.utils.aoa_to_sheet(linhas);
  planilha['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 20 }];
  return planilha;
}

function nomeArquivo(data: string, horario: string | null, formato: FormatoExportacao) {
  const horaLimpa = horario ? `_${horario.replace(':', 'h')}` : '';
  return `chamada_${data}${horaLimpa}.${formato}`;
}

function base64ParaBytes(base64: string) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

function baixarNoWeb(nome: string, formato: FormatoExportacao, conteudo: string, base64: boolean) {
  const bytes = base64 ? base64ParaBytes(conteudo) : new TextEncoder().encode(conteudo);
  const blob = new Blob([bytes], { type: MIME[formato] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function salvarECompartilharNoDispositivo(
  nome: string,
  formato: FormatoExportacao,
  conteudo: string,
  base64: boolean
) {
  const arquivo = new File(Paths.cache, nome);
  arquivo.create({ overwrite: true });
  arquivo.write(conteudo, base64 ? { encoding: 'base64' } : undefined);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: MIME[formato],
      dialogTitle: 'Exportar chamada',
      UTI: UTI[formato],
    });
  }
}

// Excel e Google Sheets abrem xlsx e csv nativamente — geramos os dois com a
// mesma planilha, só trocando o bookType de saída do SheetJS.
export async function exportarChamada({ alunos, presencas, data, horario, formato }: ExportarChamadaParams) {
  const planilha = montarPlanilha({ alunos, presencas, data, horario });
  const nome = nomeArquivo(data, horario, formato);

  if (formato === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(planilha);
    if (Platform.OS === 'web') {
      baixarNoWeb(nome, formato, csv, false);
      return;
    }
    await salvarECompartilharNoDispositivo(nome, formato, csv, false);
    return;
  }

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Chamada');
  const base64 = XLSX.write(livro, { type: 'base64', bookType: 'xlsx' }) as string;

  if (Platform.OS === 'web') {
    baixarNoWeb(nome, formato, base64, true);
    return;
  }
  await salvarECompartilharNoDispositivo(nome, formato, base64, true);
}
