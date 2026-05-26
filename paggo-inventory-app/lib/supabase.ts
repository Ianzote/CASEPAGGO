import { createClient } from '@supabase/supabase-js';

// Se a Vercel não achar as chaves no build, ela usa essas strings válidas temporárias 
// para não quebrar a compilação. Em produção na web, o Next.js pega as variáveis reais.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);