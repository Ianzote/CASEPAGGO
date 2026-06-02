import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CRITICAL_MIN = 70;
const ALERT_MIN = 30;

const INTRO_REPLY = `Olá! Sou o **SOL**, assistente de gestão de estoque da Paggo.

Posso te ajudar com:
• totais e listas de itens críticos
• qual SKU está mais urgente (geral ou por categoria, ex. APPAREL)
• sugestões de estratégia com base no inventário

Quando quiser dados, é só pedir — por exemplo: *quantos itens críticos tem?* ou *qual o item APPAREL mais crítico agora?*`;

type SkuRow = {
  sku_id: string;
  sku_name: string;
  category: string;
  current_stock: number;
  reorder_point: number;
  score_risco: number;
  regra_bomba?: boolean;
  regra_zumbi?: boolean;
  daily_sales_30d_avg?: number;
};

type InventoryStats = {
  critical: number;
  alert: number;
  stable: number;
  total: number;
};

type MessageIntent = 'greeting' | 'thanks' | 'help' | 'chat' | 'data' | 'insight' | 'strategy';

const SKU_SELECT =
  'sku_id, sku_name, category, current_stock, reorder_point, score_risco, regra_bomba, regra_zumbi, daily_sales_30d_avg';

function normalize(msg: string) {
  return msg
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function wantsFullList(msg: string) {
  return /\b(lista|listar|liste|listem|quais sao|top|ranking|piores|mostre|mostra|detalhe|envie|envia|mande|manda)\b/.test(
    msg,
  );
}

function wantsCount(msg: string) {
  return /\b(quantos|quantas|qtd|numero|total|contagem|contar)\b/.test(msg);
}

function mentionsCritical(msg: string) {
  return /\b(critico|criticos|risco alto|alto risco|urgente|urgencia)\b/.test(msg);
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

function wantsInsight(msg: string) {
  return (
    /\b(qual|quais|que item|qual item|mais critico|maior risco|pior|mais urgente|destaque)\b/.test(msg) &&
    (mentionsCritical(msg) || /\b(item|sku|produto)\b/.test(msg) || extractCategory(msg) !== null)
  );
}

function wantsStrategy(msg: string) {
  return /\b(estrategia|recomend|o que fazer|como (reduzir|melhorar|resolver|agir|priorizar)|sugest|prioriz|plano de acao|devo fazer|melhor caminho)\b/.test(
    msg,
  );
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
  const msg = normalize(message);

  const asksData =
    wantsCount(msg) ||
    wantsFullList(msg) ||
    /\b(me (diga|fale|passa|mostra)|informe|traga|preciso saber)\b/.test(msg) ||
    (mentionsCritical(msg) && /\b(quantos|lista|liste|top|piores|tem|ha)\b/.test(msg));

  if (asksData) return 'data';
  if (wantsStrategy(msg)) return 'strategy';
  if (wantsInsight(msg)) return 'insight';

  const greetingOnly =
    /^(oi|ola|oie|hey|e ai|eae|bom dia|boa tarde|boa noite|tudo bem|opa|fala|salve)[\s!.?]*$/.test(msg) ||
    (/^(oi|ola|hey)[\s,]+/.test(msg) && msg.length < 40);

  if (greetingOnly) return 'greeting';
  if (/^(obrigad|valeu|brigad|thanks)/.test(msg)) return 'thanks';
  if (mentionsIdentity(msg)) return 'help';

  // Perguntas abertas sobre estoque sem palavras-chave exatas
  if (/\b(estoque|inventario)\b/.test(msg) && msg.length > 12) return 'insight';

  return 'chat';
}

function skuStatus(s: SkuRow) {
  return s.current_stock <= s.reorder_point ? 'BOMBA/FALTA' : 'ALERTA';
}

function formatSkuBrief(s: SkuRow) {
  return `${s.sku_name} (${s.sku_id}) — score ${s.score_risco}, estoque ${s.current_stock}/${s.reorder_point}, ${skuStatus(s)}`;
}

function formatSkuLine(s: SkuRow) {
  return `- ${formatSkuBrief(s)} · ${s.category}`;
}

async function fetchInventoryStats() {
  const [criticalRes, alertRes, stableRes, totalRes] = await Promise.all([
    supabase.from('skus').select('*', { count: 'exact', head: true }).gte('score_risco', CRITICAL_MIN),
    supabase
      .from('skus')
      .select('*', { count: 'exact', head: true })
      .gte('score_risco', ALERT_MIN)
      .lt('score_risco', CRITICAL_MIN),
    supabase.from('skus').select('*', { count: 'exact', head: true }).lt('score_risco', ALERT_MIN),
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

async function fetchTopCritical(limit = 10, category?: string | null) {
  let query = supabase
    .from('skus')
    .select(SKU_SELECT)
    .gte('score_risco', CRITICAL_MIN)
    .order('score_risco', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SkuRow[];
}

async function fetchCategoryCriticalCount(category: string) {
  const { count, error } = await supabase
    .from('skus')
    .select('*', { count: 'exact', head: true })
    .eq('category', category)
    .gte('score_risco', CRITICAL_MIN);

  if (error) throw error;
  return count ?? 0;
}

function answerDataQuestion(message: string, stats: InventoryStats, top: SkuRow[]) {
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
    return `São **${stats.total.toLocaleString('pt-BR')}** SKUs: **${stats.critical.toLocaleString('pt-BR')}** críticos, **${stats.alert.toLocaleString('pt-BR')}** em alerta e **${stats.stable.toLocaleString('pt-BR')}** estáveis.`;
  }

  if (wantsFullList(msg) || /\b(piores|urgente|bomba|zumbi)\b/.test(msg)) {
    if (top.length === 0) return 'Não encontrei itens críticos com esses filtros.';
    const n = Math.min(top.length, 8);
    const lines = top.slice(0, n).map(formatSkuLine).join('\n');
    return `Aqui estão os **${n}** SKUs mais críticos:\n\n${lines}`;
  }

  return `Posso informar totais ou listar os mais urgentes. O que você prefere?`;
}

function answerInsight(message: string, top: SkuRow[], category: string | null, categoryCriticalCount?: number) {
  const item = top[0];
  if (!item) {
    return category
      ? `Não encontrei SKUs críticos em **${category}** no momento.`
      : 'Não encontrei itens críticos no inventário agora.';
  }

  const catLabel = category ? ` em **${category}**` : '';
  const extra =
    category && categoryCriticalCount !== undefined
      ? ` Há **${categoryCriticalCount.toLocaleString('pt-BR')}** itens críticos nessa categoria.`
      : '';

  const tipo =
    item.regra_bomba || skuStatus(item) === 'BOMBA/FALTA'
      ? 'Risco de **ruptura** (estoque abaixo do ideal com giro).'
      : 'Risco elevado no score — vale monitorar reposição.';

  let reply = `O item${catLabel} mais crítico agora é **${item.sku_name}** (${item.sku_id}).\n\n`;
  reply += `Score **${item.score_risco}**, estoque **${item.current_stock}** (mínimo ideal **${item.reorder_point}**), status **${skuStatus(item)}**. ${tipo}`;
  reply += extra;

  if (top.length > 1 && /\b(segundo|outros|tambem|também)\b/i.test(message)) {
    reply += `\n\nEm seguida: ${formatSkuBrief(top[1])}.`;
  }

  return reply;
}

function answerStrategy(stats: InventoryStats, top: SkuRow[], category: string | null) {
  const focus = top[0];
  const parts: string[] = [];

  parts.push(
    `Com **${stats.critical.toLocaleString('pt-BR')}** itens críticos no total, sugiro esta ordem de ação:`,
  );

  parts.push(
    '1. **Ruptura (Bomba)** — repor primeiro SKUs com venda ativa e estoque abaixo do ponto ideal.',
  );
  parts.push('2. **Alerta operacional** — ajustar pedidos antes que virem críticos.');
  parts.push('3. **Zumbi** — reduzir excesso parado para liberar capital de giro.');

  if (category) {
    parts.push(
      `\nEm **${category}**, concentre esforço nos itens com maior \`score_risco\` e estoque abaixo do \`reorder_point\`.`,
    );
  }

  if (focus) {
    parts.push(`\nComece por **${focus.sku_name}** (${focus.sku_id}) — hoje está entre os mais urgentes.`);
  }

  return parts.join('\n');
}

function buildGeminiContext(
  intent: MessageIntent,
  stats: InventoryStats,
  top: SkuRow[],
  category: string | null,
  categoryCriticalCount?: number,
  includeLongList = false,
) {
  const lines = [
    `Totais: críticos=${stats.critical}, alerta=${stats.alert}, estáveis=${stats.stable}, total=${stats.total}.`,
  ];

  if (category) {
    lines.push(`Categoria foco: ${category} (${categoryCriticalCount ?? '?'} críticos nela).`);
  }

  if (top.length > 0) {
    const sample = top
      .slice(0, includeLongList ? 8 : 3)
      .map((s) => `${s.sku_name}|${s.sku_id}|${s.category}|score=${s.score_risco}|est=${s.current_stock}/${s.reorder_point}|${skuStatus(s)}`)
      .join('; ');
    lines.push(`SKUs referência: ${sample}.`);
  }

  return lines.join('\n');
}

async function tryGeminiReply(message: string, intent: MessageIntent, context: string) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const systemInstruction =
    intent === 'strategy'
      ? `Você é o SOL, consultor de estoque da Paggo. Responda em português.
Dê uma estratégia prática em 3-5 bullets curtos, baseada só nos dados fornecidos.
Não invente SKUs. Não liste mais de 3 produtos. Sem textão.`
      : intent === 'insight'
        ? `Você é o SOL, consultor de estoque da Paggo. Responda em português.
Responda a pergunta aberta de forma direta (2-5 frases). Cite no máximo 1 SKU principal (+ opcional 1 alternativa).
Use só os dados do contexto. Não invente números.`
        : `Você é o SOL, consultor de estoque da Paggo. Responda em português, curto.
Use só os números do contexto. Liste SKUs apenas se o usuário pedir lista/ranking.`;

  const prompt = `Pergunta: ${message}\n\nDados do inventário (Supabase):\n${context}`;

  for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const model = ai.getGenerativeModel({ model: modelName, systemInstruction });
      const response = await model.generateContent(prompt);
      const text = response.response.text()?.trim();
      if (text && text.length < 2000) return text;
    } catch {
      // tenta próximo modelo
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }

    const intent = classifyMessage(String(message));

    if (intent === 'greeting') return NextResponse.json({ reply: INTRO_REPLY });
    if (intent === 'thanks') {
      return NextResponse.json({ reply: 'Por nada! Se precisar de algo do inventário, é só chamar.' });
    }
    if (intent === 'help') return NextResponse.json({ reply: INTRO_REPLY });
    if (intent === 'chat') {
      return NextResponse.json({
        reply:
          'Posso responder perguntas abertas também — por exemplo: *qual o item APPAREL mais crítico?* ou *qual estratégia usar para reduzir rupturas?*',
      });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase não configurado na Vercel (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).' },
        { status: 500 },
      );
    }

    const msgNorm = normalize(String(message));
    const category = extractCategory(String(message));
    const needsList =
      intent === 'data' &&
      (wantsFullList(msgNorm) || /\b(piores|urgente|bomba|zumbi|liste|lista|top)\b/.test(msgNorm));

    let stats: InventoryStats;
    let topCritical: SkuRow[] = [];
    let categoryCriticalCount: number | undefined;

    try {
      stats = await fetchInventoryStats();

      if (intent === 'insight') {
        topCritical = await fetchTopCritical(category ? 3 : 1, category);
        if (category) categoryCriticalCount = await fetchCategoryCriticalCount(category);
      } else if (intent === 'strategy') {
        topCritical = await fetchTopCritical(3, category);
        if (category) categoryCriticalCount = await fetchCategoryCriticalCount(category);
      } else if (needsList) {
        topCritical = await fetchTopCritical(8, category);
      }
    } catch (dbError) {
      console.error('Supabase error (chat):', dbError);
      return NextResponse.json({ error: 'Falha ao consultar inventário no Supabase.' }, { status: 500 });
    }

    const geminiContext = buildGeminiContext(
      intent,
      stats,
      topCritical,
      category,
      categoryCriticalCount,
      needsList,
    );
    const geminiReply = await tryGeminiReply(String(message), intent, geminiContext);
    if (geminiReply) return NextResponse.json({ reply: geminiReply });

    if (intent === 'insight') {
      return NextResponse.json({
        reply: answerInsight(String(message), topCritical, category, categoryCriticalCount),
      });
    }
    if (intent === 'strategy') {
      return NextResponse.json({ reply: answerStrategy(stats, topCritical, category) });
    }

    return NextResponse.json({ reply: answerDataQuestion(String(message), stats, topCritical) });
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : 'Unknown error';
    console.error('Erro fatal na API de Chat:', err);
    return NextResponse.json({ error: 'Erro interno', details }, { status: 500 });
  }
}
