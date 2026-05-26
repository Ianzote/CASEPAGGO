import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }

    // 1. RAG: Buscar itens críticos do banco
    const { data: criticalSkus } = await supabase
      .from('skus')
      .select('sku_id, sku_name, category, current_stock, reorder_point, score_risco, regra_bomba, regra_sazonal, regra_zumbi')
      .order('score_risco', { ascending: false })
      .limit(10);

    const contextText = criticalSkus
      ? criticalSkus.map((s: any) => 
          `- SKU: ${s.sku_name} (${s.sku_id}) | Cat: ${s.category} | Estoque: ${s.current_stock} (Mínimo Ideal: ${s.reorder_point}) | Score: ${s.score_risco} | Status: ${s.regra_bomba ? 'BOMBA/FALTA' : s.regra_zumbi ? 'ZUMBI/ENCALHADO' : 'ALERTA'}`
        ).join('\n')
      : 'Nenhum dado crítico disponível no momento.';

    const systemInstruction = `Você é o SOL (Smart Optimized Logistics), o Consultor de IA especialista em Gestão de Estoque da Paggo.
Seu objetivo é auxiliar o analista com respostas diretas e inteligentes.

CONTEXTO DOS ITENS MAIS CRÍTICOS DO ESTOQUE ATUAL:
${contextText}`;

    // --- BLINDAGEM CONTRA BLOQUEIO DE COTA DO GOOGLE ---
    try {
      const model = ai.getGenerativeModel({ 
        model: 'gemini-1.5-pro', 
        systemInstruction: systemInstruction 
      });

      const response = await model.generateContent(message);
      const text = response.response.text();
      
      return NextResponse.json({ reply: text });

    } catch (apiError) {
      console.warn('Google API indisponível ou sem cota. Usando resposta local do SOL.');
      
      const msgLower = (message || '').toLowerCase();
      let reply = "";

      if (msgLower.includes('o que você faz') || msgLower.includes('quem é você') || msgLower.includes('significa sol')) {
        reply = "Olá! Eu sou o **SOL (Smart Optimized Logistics)**, o Consultor de IA especialista em Gestão de Estoque da Paggo. Meu objetivo é analisar o inventário atual, identificar riscos operacionais (como itens 'Bomba' ou 'Zumbi') e ajudar você a tomar decisões rápidas para otimizar a logística e evitar prejuízos financeiros.";
      } else if (msgLower.includes('estoque') || msgLower.includes('crítico') || msgLower.includes('bomba') || msgLower.includes('zumbi')) {
        reply = `Com base na análise do banco de dados, os itens que lideram o ranking de risco crítico são:\n\n${contextText}\n\nRecomendo priorizar os itens com status **BOMBA/FALTA** para compras imediatas, e avaliar liquidações para os itens **ZUMBI/ENCALHADO**.`;
      } else {
        reply = "Olá! Sou o **SOL**, assistente de logística da Paggo. No momento estou operando em modo de contingência local devido ao limite de requisições do servidor central, mas consigo acessar o banco de dados! Se quiser saber sobre os itens críticos ou o que eu faço, pode perguntar.";
      }

      return NextResponse.json({ reply });
    }

  } catch (err: any) {
    console.error('Erro fatal na API de Chat:', err);
    return NextResponse.json({ error: 'Erro interno', details: err.message }, { status: 500 });
  }
}