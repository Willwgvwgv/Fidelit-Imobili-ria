
import { createClient } from '@supabase/supabase-js';

// Projeto Supabase OFICIAL do app (onde ficam os lançamentos reais).
// Fixado como fallback para garantir que o app nunca conecte por engano em
// outro projeto (ex.: o projeto vazio da integração) caso as variáveis de
// ambiente faltem ou venham trocadas em algum build.
const OFFICIAL_SUPABASE_URL = 'https://dzcixpzyoxhfvskrftqe.supabase.co';
const OFFICIAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Y2l4cHp5b3hoZnZza3JmdHFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDg4NjksImV4cCI6MjA4NjU4NDg2OX0.NtqRJjQ3TzHYijbKpcF67xfT_JYRab3Z56UCI6GENVU';

const envUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);
const envAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined);

// Usa a variável de ambiente somente se ela apontar para o projeto oficial.
// Qualquer outro valor é ignorado em favor do projeto correto, evitando o
// cenário de "lançamentos sumiram" por conectar num banco vazio/errado.
const useEnv = envUrl === OFFICIAL_SUPABASE_URL && !!envAnonKey;

if (envUrl && envUrl !== OFFICIAL_SUPABASE_URL) {
  console.warn(
    `[supabase] VITE_SUPABASE_URL (${envUrl}) difere do projeto oficial. ` +
      'Ignorando e usando o projeto oficial para preservar os dados.'
  );
}

const supabaseUrl = useEnv ? (envUrl as string) : OFFICIAL_SUPABASE_URL;
const supabaseAnonKey = useEnv ? (envAnonKey as string) : OFFICIAL_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
