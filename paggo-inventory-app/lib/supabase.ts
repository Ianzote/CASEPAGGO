import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Validar variáveis de ambiente em tempo de construção
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase environment variables not configured:", {
    url: supabaseUrl ? "✓" : "✗",
    key: supabaseAnonKey ? "✓" : "✗",
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
