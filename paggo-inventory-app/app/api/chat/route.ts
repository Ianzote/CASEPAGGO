import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CRITICAL_MIN = 70;
const ALERT_MIN = 30;

const INTRO_REPLY = `Olá! Sou o **SOL**, assistente de gestão de estoque da Paggo.

Posso te ajudar com coisas como:
• quantos itens estão em risco crítico, alerta ou estáveis
• lista dos SKUs mais urgentes
• consultas por categoria (APPAREL, FOOD, etc.)

Quando quiser ver algum dado, é só pedir — por exemplo: *quantos itens críticos tem?* ou *liste os 5 mais críticos*.`;

type SkuRow = {
  sku_id: string;
  sku_name: string;
  category: string;
  current_stock: number;
  reorder_point: number;
  score_risco: number;
};

type MessageIntent = 'greeting' | 'thanks' | 'help' | 'data' | 'chat';

function normalize(msg: string) {
  return msg
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function wantsFullList(msg: string) {
  return /\b(lista|listar|liste|listem|quais sao|top|ranking|piores|mostre|mostra|detalhe|bomba|zumbi|envie|envia|mande|manda)\b/.test(msg);
}

function wantsCount(msg: string) {
  return /\b(quantos|quantas|qtd|numero|total|contagem|contar)\b/.test(msg);
}

function mentionsCritical(msg: string) {
  return /\b(critico|criticos|risco alto|alto risco)\b/.test(msg);
}

function mentionsAlert(msg: string) {
  return /\b(alerta|operacional)\b/.test(msg);
}

function mentionsStable(msg: string) {
  return /\b(estabil|estavel|baixo risco|saudavel)\b/.test(msg);
}

function mentionsIdentity(msg: string) {
  return /\b(o que voce faz|quem e voce|significa sol|como funciona|ajuda)\b/.test(msg);
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

function classifyMessage(message: string): MessageIntent {
  const raw = message.trim();
  const msg = normalize(raw);

  const asksData =
    wantsCount(msg) ||
    wantsFullList(msg) ||
    /\b(me (diga|fale|passa|mostra)|informe|traga|preciso saber)\b/.test(msg) ||
    (mentionsCritical(msg) && /\b(quantos|lista|liste|top|piores|urgente|tem|ha)\b/.test(msg));

  if (asksData) return 'data';

  const greetingOnly =
    /^(oi|ola|oie|hey|e ai|eae|bom dia|boa tarde|boa noite|tudo bem|opa|fala|salve)[\s!.?]*$/.test(msg) ||
    /^(oi|ola|hey)[\s,]+/.test(msg) && msg.length < 40 && !asksData;

  if (greetingOnly) return 'greeting';

  if (/^(obrigad|valeu|brigad|thanks)/.test(msg)) return 'thanks';
  if (mentionsIdentity(msg)) return 'help';

  return 'chat';
}

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

function answerDataQuestion(
  message: string,
  stats: { critical: number; alert: number; stable: number; total: number },
  top: SkuRow[],
) {
  const msg = normalize(message);
  const category = extractCategory(message);

  if (wantsCount(msg)) {
    if (mentionsCritical(msg) || (!mentionsAlert(msg) && !mentionsStable(msg))) {
      const extra = category ? ` na categoria **${category}**` : '';
      return `Há **${stats.critical.toLocaleString('pt-BR')}** itens com risco crítico (score ≥ ${CRITICAL_MIN})${extra}.`;
    }
    if (mentionsAlert(msg)) {
      return `Há **${stats.alert.toLocaleString('pt-BR')}** itens em alerta operacional.`;
    }
    if (mentionsStable(msg)) {
      return `Há **${stats.stable.toLocaleString('pt-BR')}** itens estabilizados.`;
    }
    return `São **${stats.total.toLocaleString('pt-BR')}** SKUs no total: **${stats.critical.toLocaleString('pt-BR')}** críticos, **${stats.alert.toLocaleString('pt-BR')}** em alerta e **${stats.stable.toLocaleString('pt-BR')}** estáveis.`;
  }

  if (wantsFullList(msg) || /\b(piores|urgente|prioridade|bomba)\b/.test(msg)) {
    if (top.length === 0) return 'Não encontrei itens críticos no momento.';
    const n = Math.min(top.length, 8);
    const lines = top.slice(0, n).map(formatSkuLine).join('\n');
    return `Aqui estão os **${n}** SKUs mais críticos:\n\n${lines}`;
  }

  if (category) {
    return `Para **${category}**, posso listar os críticos ou informar totais. Exemplo: *liste os críticos de ${category}*.`;
  }

  return `Posso buscar: totais (críticos/alerta/estáveis) ou lista dos mais urgentes. O que você prefere?`;
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }

    const intent = classifyMessage(String(message));

    // Conversa comum: sem Supabase, sem Gemini, sem números
    if (intent === 'greeting') {
      return NextResponse.json({ reply: INTRO_REPLY });
    }
    if (intent === 'thanks') {
      return NextResponse.json({ reply: 'Por nada! Se precisar de algo do inventário, é só chamar.' });
    }
    if (intent === 'help') {
      return NextResponse.json({ reply: INTRO_REPLY });
    }
    if (intent === 'chat') {
      return NextResponse.json({
        reply:
          'Beleza! Quando quiser dados do estoque, me peça direto — por exemplo: *quantos itens críticos tem?* ou *liste os 5 mais críticos*.',
      });
    }

    // intent === 'data' — só aqui consultamos o banco
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase não configurado na Vercel (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).' },
        { status: 500 },
      );
    }

    const msgNorm = normalize(String(message));
    const needsList = wantsFullList(msgNorm) || /\b(piores|urgente|bomba|liste|lista|top)\b/.test(msgNorm);

    let stats;
    let topCritical: SkuRow[] = [];

    try {
      stats = await fetchInventoryStats();
      if (needsList) {
        topCritical = await fetchTopCritical(8);
      }
    } catch (dbError) {
      console.error('Supabase error (chat):', dbError);
      return NextResponse.json({ error: 'Falha ao consultar inventário no Supabase.' }, { status: 500 });
    }

    const localReply = answerDataQuestion(String(message), stats, topCritical);

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (geminiKey) {
      const contextForGemini = needsList
        ? `Contagens: críticos=${stats.critical}, alerta=${stats.alert}, estáveis=${stats.stable}, total=${stats.total}.\nLista (máx 8): ${topCritical.map((s) => s.sku_name).join(', ') || 'vazia'}.`
        : `Contagens: críticos=${stats.critical}, alerta=${stats.alert}, estáveis=${stats.stable}, total=${stats.total}.`;

      const systemInstruction = `Você é o SOL, assistente de estoque da Paggo.
Responda em português, curto (1-3 frases).
Use só os números do contexto. Não invente SKUs.
Não liste produtos a menos que o usuário peça lista/ranking/top.
Para "quantos", responda só o número.`;

      const prompt = `Pergunta: ${message}\n\nDados:\n${contextForGemini}`;

      for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
        try {
          const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
          const response = await model.generateContent(prompt);
          const text = response.response.text()?.trim();
          if (text && text.length < 1200) {
            return NextResponse.json({ reply: text });
          }
        } catch {
          // usa resposta local
        }
      }
    }

    return NextResponse.json({ reply: localReply });
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : 'Unknown error';
    console.error('Erro fatal na API de Chat:', err);
    return NextResponse.json({ error: 'Erro interno', details }, { status: 500 });
  }
}
