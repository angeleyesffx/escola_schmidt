// Baixa todos os objetos do bucket informado para BACKUP_DIR, preservando os caminhos.
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'avatars';
const OUT_DIR = process.env.BACKUP_DIR ?? 'storage-backup';

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY);

async function listAll(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;

  const files = [];
  for (const entry of data ?? []) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Pastas nao tem metadata.size; arquivos tem.
    if (entry.id === null) {
      files.push(...(await listAll(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

async function main() {
  const files = await listAll('');
  console.log(`Encontrados ${files.length} objetos no bucket "${BUCKET}".`);

  for (const filePath of files) {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error) throw error;

    const destPath = path.join(OUT_DIR, filePath);
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
  }

  console.log(`Backup do bucket "${BUCKET}" salvo em "${OUT_DIR}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
