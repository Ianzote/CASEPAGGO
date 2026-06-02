import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CRITICAL_MIN = 70;
const ALERT_MIN = 30;

type SkuRow = {
  sku_id: string;
  sku_name: string;
  category: string;
  current_stock: number;
  reorder_point: number;
  score_risco: number;
};

async function fetchInventoryStats() {
  const [criticalRes, alertRes, stableRes, totalRes] = await Promise.all([
    supabase
      .from('skus')
      .select('*', { count: 'exact', head: true })
      .gte('score_risco', CRITICAL_MIN),
    supabase
      .from('skus')
      .select('*', { count: 'exact', head: true })
      .gte('score_risco', ALERT_MIN)
      .lt('score_risco', CRITICAL_MIN),
    supabase
      .from('skus')
      .select('*', { count: 'exact', head: true })
      .lt('score_risco', ALERT_MIN),
    supabase.from('skus').select('*', { count: 'exact', head: true }),
  ]);

  const firstError = criticalRes.error ?? alertRes.error ?? stableRes.error ?? totalRes.error;
  if (firstError) throw firstError;

  return {
    critical: criticalRes.count ?? 0,
    alert: alertRes.count ?? 0,
    stable: stableRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

async function fetchTopCritical(limit = 10) {
  const { data, error } = await supabase
    .from('skus')
    .select('sku_id, sku_name, category, current_stock, reorder_point, score_risco')
    .gte('score_risco', CRITICAL_MIN)
    .order('score_risco', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SkuRow[];
}

function formatSkuLine(s: SkuRow) {
  const status = s.current_stock <= s.reorder_point ? 'BOMBA/FALTA' : 'ALERTA';
  return `- ${s.sku_name} (${s.sku_id}) · ${s.category} · estoque ${s.current_stock}/${s.reorder_point} · score ${s.score_risco} · ${status}`;
}

function wantsFullList(msg: string) {
  return /\b(lista|listar|liste|quais s[aã]o|top|ranking|piores|mostre|detalhe|bomba|zumbi)\b/.test(msg);
}

function wantsCount(msg: string) {
  return /\b(quantos|quantas|qtd|numero|n[uú]mero|total|contagem|contar)\b/.test(msg);
}

function mentionsCritical(msg: string) {
  return /\b(cr[ií]tico|cr[ií]ticos|risco alto|alto risco)\b/.test(msg);
}

function mentionsAlert(msg: string) {
  return /\b(alerta|operacional|m[eé]dio)\b/.test(msg);
}

function mentionsStable(msg: string) {
  return /\b(estabil|est[aá]vel|baixo risco|saud[aá]vel)\b/.test(msg);
}

function mentionsIdentity(msg: string) {
  return /\b(o que voc[eê] faz|quem [eé] voc[eê]|significa sol)\b/.test(msg);
}

function extractCategory(msg: string) {
  const categories = [
    'APPAREL',
    'AUTOMOTIVE',
    'BEVERAGES',
    'CLEANING',
    'ELECTRONICS',
    'FOOD',
    'HEALTH',
    'OFFICE',
  ];
  const upper = msg.toUpperCase();
  return categories.find((c) => upper.includes(c)) ?? null;
}

function answerLocally(message: string, stats: { critical: number; alert: number; stable: number; total: number }, top: SkuRow[]) {
  const msg = message.toLowerCase();

  if (mentionsIdentity(msg)) {
    return 'Sou o **SOL**, consultor de gestão de estoque da Paggo. Posso informar totais de risco, categorias críticas e os SKUs mais urgentes — é só perguntar de forma direta.';
  }

  const category = extractCategory(msg);

  if (wantsCount(msg)) {
    if (mentionsCritical(msg) || (!mentionsAlert(msg) && !mentionsStable(msg) && /\b(itens?|produtos?|skus?)\b/.test(msg))) {
      const extra = category ? ` na categoria **${category}**` : '';
      return `Há **${stats.critical.toLocaleString('pt-BR')}** itens com risco crítico (score ≥ ${CRITICAL_MIN})${extra} no inventário.`;
    }
    if (mentionsAlert(msg)) {
      return `Há **${stats.alert.toLocaleString('pt-BR')}** itens em alerta operacional (score entre ${ALERT_MIN} e ${CRITICAL_MIN - 1}).`;
    }
    if (mentionsStable(msg)) {
      return `Há **${stats.stable.toLocaleString('pt-BR')}** itens estabilizados (score abaixo de ${ALERT_MIN}).`;
    }
    return `O inventário tem **${stats.total.toLocaleString('pt-BR')}** SKUs: **${stats.critical.toLocaleString('pt-BR')}** críticos, **${stats.alert.toLocaleString('pt-BR')}** em alerta e **${stats.stable.toLocaleString('pt-BR')}** estabilizados.`;
  }

  if (wantsFullList(msg) || /\b(piores|urgente|prioridade|bomba)\b/.test(msg)) {
    if (top.length === 0) {
      return 'Não encontrei itens críticos no momento.';
    }
    const lines = top.slice(0, 8).map(formatSkuLine).join('\n');
    return `Os **${Math.min(top.length, 8)}** SKUs mais críticos agora:\n\n${lines}`;
  }

  if (category) {
    return `Na categoria **${category}**, o inventário segue com **${stats.critical.toLocaleString('pt-BR')}** itens críticos no total. Para ver os piores da categoria, pergunte: "liste os críticos de ${category}".`;
  }

  if (mentionsCritical(msg) || mentionsAlert(msg) || /\b(estoque|invent[aá]rio)\b/.test(msg)) {
    const preview = top.slice(0, 3).map((s) => s.sku_name).join(', ');
    return `Resumo: **${stats.critical.toLocaleString('pt-BR')}** críticos, **${stats.alert.toLocaleString('pt-BR')}** em alerta, **${stats.stable.toLocaleString('pt-BR')}** estabilizados. Os mais urgentes agora: ${preview || '—'}. Para a lista completa, peça "liste os 10 mais críticos".`;
  }

  return `Posso ajudar com o inventário. Exemplos: "quantos itens críticos tem?" ou "liste os 5 mais críticos". Hoje há **${stats.critical.toLocaleString('pt-BR')}** itens críticos.`;
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase não configurado na Vercel (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).' },
        { status: 500 },
      );
    }

    let stats = { critical: 0, alert: 0, stable: 0, total: 0 };
    let topCritical: SkuRow[] = [];

    try {
      stats = await fetchInventoryStats();
      const msgLower = String(message).toLowerCase();
      const needsTop =
        wantsFullList(msgLower) ||
        /\b(piores|urgente|prioridade|bomba|liste|lista|top|ranking)\b/.test(msgLower);
      if (needsTop) {
        topCritical = await fetchTopCritical(10);
      } else {
        topCritical = await fetchTopCritical(3);
      }
    } catch (dbError) {
      console.error('Supabase error (chat):', dbError);
      return NextResponse.json(
        { error: 'Falha ao consultar inventário no Supabase.' },
        { status: 500 },
      );
    }

    const contextSummary = `Totais: ${stats.critical} críticos (score≥${CRITICAL_MIN}), ${stats.alert} em alerta, ${stats.stable} estabilizados, ${stats.total} SKUs no total.
Top críticos (amostra): ${topCritical.map((s) => `${s.sku_name} (${s.sku_id}, score ${s.score_risco})`).join('; ') || 'nenhum'}.`;

    const systemInstruction = `Você é o SOL, consultor de estoque da Paggo.
Responda em português, de forma curta (1 a 4 frases na maioria dos casos).
Use apenas os números e SKUs do contexto fornecido.
NÃO despeje listas longas de SKUs, a menos que o usuário peça explicitamente uma lista ou ranking.
Para perguntas de quantidade ("quantos"), responda só com o número e uma frase de contexto.`;

    const prompt = `Pergunta: ${message}

Dados do Supabase:
${contextSummary}

Responda de forma direta e concisa.`;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      for (const modelName of models) {
        try {
          const model = ai.getGenerativeModel({
            model: modelName,
            systemInstruction,
          });
          const response = await model.generateContent(prompt);
          const text = response.response.text();
          if (text?.trim()) {
            return NextResponse.json({ reply: text.trim() });
          }
        } catch (apiError) {
          console.warn(`Gemini (${modelName}) indisponível:`, apiError);
        }
      }
    }

    const reply = answerLocally(String(message), stats, topCritical);
    return NextResponse.json({ reply });

  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : 'Unknown error';
    console.error('Erro fatal na API de Chat:', err);
    return NextResponse.json({ error: 'Erro interno', details }, { status: 500 });
  }
}
