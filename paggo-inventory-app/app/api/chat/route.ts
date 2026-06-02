import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
export const dynamic = 'force-dynamic';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }

    // 1. RAG: Buscar itens críticos do banco (Apenas colunas seguras e existentes)
    const { data: criticalSkus, error: criticalSkusError } = await supabase
      .from('skus')
      .select('sku_id, sku_name, category, current_stock, reorder_point, score_risco')
      .order('score_risco', { ascending: false })
      .limit(10);

    if (criticalSkusError) {
      // Se a query falhar, o modelo vai ter um contexto vazio; pelo menos não vamos “mentir” com base falsa.
      console.error('Supabase error (RAG critical SKUs):', criticalSkusError);
    }

    const safeCriticalSkus = Array.isArray(criticalSkus) ? criticalSkus : [];

    // Ajustado o map para usar dados existentes (Estoque abaixo do mínimo ideal vira CRÍTICO)
    const contextText =
      safeCriticalSkus.length > 0
        ? safeCriticalSkus
            .map(
              (s: any) =>
                `- SKU: ${s.sku_name} (${s.sku_id}) | Cat: ${s.category} | Estoque: ${s.current_stock} (Mínimo Ideal: ${s.reorder_point}) | Score: ${s.score_risco} | Status: ${
                  s.current_stock <= s.reorder_point ? 'BOMBA/FALTA' : 'ALERTA'
                }`
            )
            .join('\n')
        : 'Nenhum dado crítico disponível no momento (ou falha ao buscar no Supabase).';

    const systemInstruction = `Você é o SOL (Smart Optimized Logistics), o Consultor de IA especialista em Gestão de Estoque da Paggo.
Seu objetivo é auxiliar o analista com respostas diretas e inteligentes.

Responda em português.
Use obrigatoriamente o contexto de inventário fornecido na mensagem do usuário. Se o contexto não contiver dados para responder, diga explicitamente que não há informação no contexto atual.`;

    const prompt = `Pergunta do analista:
${message}

Contexto dos ITENS MAIS CRÍTICOS DO ESTOQUE ATUAL (Supabase):
${contextText}

Instrução:
Responda de forma objetiva e prática, citando os SKUs do contexto sempre que relevante.`;

    // --- BLINDAGEM CONTRA BLOQUEIO DE COTA DO GOOGLE ---
    try {
      const model = ai.getGenerativeModel({ 
        model: 'gemini-1.5-pro', 
        systemInstruction: systemInstruction 
      });

      // Garantimos que o contexto do Supabase vai junto no conteúdo enviado ao modelo.
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      return NextResponse.json({ reply: text });

    } catch (apiError) {
      console.warn('Google API indisponível ou sem cota. Usando resposta local do SOL.');
      
      const msgLower = (message || '').toLowerCase();
      let reply = "";

      if (msgLower.includes('o que você faz') || msgLower.includes('quem é você') || msgLower.includes('significa sol')) {
        reply = "Olá! Eu sou o **SOL (Smart Optimized Logistics)**, o Consultor de IA especialista em Gestão de Estoque da Paggo. Meu objetivo é analisar o inventário atual, identificar riscos operacionais (como itens 'Bomba' ou 'Zumbi') e ajudar você a tomar decisões rápidas para otimizar a logística e evitar prejuízos financeiros.";
      } else if (msgLower.includes('estoque') || msgLower.includes('crítico') || msgLower.includes('bomba') || msgLower.includes('zumbi')) {
        reply = `Com base na análise do banco de dados, os itens que lideram o ranking de risco crítico são:\n\n${contextText}\n\nRecomendo priorizar os itens com status **BOMBA/FALTA** para compras imediatas, e avaliar liquidações para os itens de risco elevado.`;
      } else {
        reply = `Olá! Sou o **SOL**, assistente de logística da Paggo.
No momento estou em contingência local (sem Gemini), mas consigo acessar o banco de dados.

Contexto atual do Supabase (itens críticos):
${contextText}`;
      }

      return NextResponse.json({ reply });
    }

  } catch (err: any) {
    console.error('Erro fatal na API de Chat:', err);
    return NextResponse.json({ error: 'Erro interno', details: err.message }, { status: 500 });
  }
}