"use client";

import React, { useEffect, useState, useRef } from "react";

type SKU = { [key: string]: any };

export default function DashboardPage() {
  const [data, setData] = useState<SKU[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [category, setCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "financial">("inventory");
  
  // Chat states
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [inputText, setInputText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchSkus() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/skus?page=${page}&category=${encodeURIComponent(category)}`,
        );
        const json = await res.json();
        if (!mounted) return;
        setData(json.data || []);
        setTotalPages(json.totalPages || 1);
      } catch (err) {
        console.error("Failed to load skus", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchSkus();
    return () => {
      mounted = false;
    };
  }, [page, category]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showChat]);

  const badgeClass = (score: number) => {
    if (score >= 70) return "bg-red-100 text-red-800";
    if (score >= 30) return "bg-orange-100 text-orange-800";
    return "bg-green-100 text-green-800";
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages || 1, p + 1));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 w-full max-w-full overflow-x-hidden font-sans">
      <div className="w-full">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-white px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              SOL & Paggo Logistics Hub
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Análise inteligente de inventário e saúde financeira do estoque.
            </p>
          </div>
          
          {/* NAVEGAÇÃO ENTRE ABAS */}
          <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner self-start md:self-auto">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activeTab === "inventory"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📦 Inventário
            </button>
            <button
              onClick={() => setActiveTab("financial")}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activeTab === "financial"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              💰 Impacto Financeiro
            </button>
          </div>
        </header>

        {/* METRICS CARDS */}
        <section className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">Risco Crítico</div>
            <div className="mt-4 text-5xl font-semibold text-red-600">835</div>
            <p className="mt-2 text-sm text-gray-500">Exigem ação imediata.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">Alerta Operacional</div>
            <div className="mt-4 text-5xl font-semibold text-orange-500">574</div>
            <p className="mt-2 text-sm text-gray-500">Precisam de monitoramento.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">Estabilizados</div>
            <div className="mt-4 text-5xl font-semibold text-emerald-600">6.591</div>
            <p className="mt-2 text-sm text-gray-500">Inventário estável.</p>
          </div>
        </section>

        {/* CONTEÚDO DINÂMICO BASEADO NA ABA ATIVA */}
        {activeTab === "inventory" ? (
          <div className="grid gap-6 lg:grid-cols-4 animate-in fade-in duration-200">
            
            {/* TABELA DE SKUs */}
            <main className="lg:col-span-3 space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Lista de SKUs</h2>
                    <p className="text-sm text-gray-500">Filtre e navegue pelos SKUs ordenados por criticidade.</p>
                  </div>
                  <div className="flex items-center gap-4 self-start md:self-auto">
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option>ALL</option>
                      <option>APPAREL</option>
                      <option>AUTOMOTIVE</option>
                      <option>BEVERAGES</option>
                      <option>CLEANING</option>
                      <option>ELECTRONICS</option>
                      <option>FOOD</option>
                      <option>HEALTH</option>
                      <option>OFFICE</option>
                    </select>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Pág. {page} de {totalPages}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Categoria</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Estoque</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendas (30d)</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Carregando...</td>
                        </tr>
                      ) : data.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum SKU encontrado.</td>
                        </tr>
                      ) : (
                        data.map((item, idx) => {
                          const id = item.sku_id ?? "—";
                          const name = item.sku_name ?? "—";
                          const cat = item.category ?? "—";
                          const stock = item.current_stock ?? 0;
                          const avg = item.sales_30d ?? item.vendas_30d ?? item.daily_sales_30d_avg ?? 0;
                          const score = Number(item.score_risco ?? 0);
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-gray-700 font-mono text-xs">{id}</td>
                              <td className="px-4 py-4 text-gray-700 font-medium">{name}</td>
                              <td className="px-4 py-4 text-gray-500">{cat}</td>
                              <td className="px-4 py-4 text-gray-700">{stock}</td>
                              <td className="px-4 py-4 text-gray-700">{avg}</td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(score)}`}>
                                  {score}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINAÇÃO */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-500">
                    Mostrando página {page} de {totalPages}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={goPrev}
                      disabled={page <= 1}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={goNext}
                      disabled={page >= totalPages}
                      className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              </div>
            </main>

            {/* COLUNA LATERAL - RANKING DE ATENÇÃO */}
            <aside className="lg:col-span-1">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ranking de Atenção</p>
                    <p className="mt-1 text-xs text-gray-500">Categorias prioritárias.</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Top 3</span>
                </div>
                <ol className="mt-4 space-y-3 text-sm text-gray-700">
                  <li className="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-700">
                    <span>1. APPAREL</span>
                    <span>🔥</span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 font-semibold text-orange-700">
                    <span>2. AUTOMOTIVE</span>
                    <span>⚡</span>
                  </li>
                  <li className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-700">
                    <span>3. BEVERAGES</span>
                    <span>🔔</span>
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        ) : (
          /* ABA FINANCEIRA GERADA DOS CÁLCULOS DO PYTHON */
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-3xl bg-gradient-to-r from-red-500 to-orange-600 p-8 text-white shadow-lg">
              <div className="text-sm font-medium uppercase tracking-wider opacity-80">Impacto Financeiro Total Estimado</div>
              <div className="mt-2 text-4xl md:text-5xl font-bold">R$ 14.724.736,28</div>
              <p className="mt-4 text-sm max-w-2xl opacity-90">
                Prejuízo latente calculado com base no custo de oportunidade de itens **Bomba** (Ruptura/Falta de Estoque) somado ao capital de giro travado em itens **Zumbi** (Excesso de Estoque/Encalhado).
              </p>
            </div>

            {/* CARD DE METRICAS CORRIGIDO PARA VALORES REAIS (11,2 Mi e 3,5 Mi) */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 border-l-4 border-red-500">
                <h3 className="text-base font-semibold text-gray-900">🚨 Ruptura e Falta (Itens Bomba)</h3>
                <p className="text-sm text-gray-500 mt-1">Vendas potencialmente perdidas por falta de estoque mínimo ideal.</p>
                <div className="mt-4 text-3xl font-bold text-red-600">~ R$ 11,2 Mi</div>
              </div>
              
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 border-l-4 border-orange-500">
                <h3 className="text-base font-semibold text-gray-900">🧟 Capital Travado (Itens Zumbi)</h3>
                <p className="text-sm text-gray-500 mt-1">Custo de armazenamento e dinheiro parado em itens sem giro.</p>
                <div className="mt-4 text-3xl font-bold text-orange-600">~ R$ 3,5 Mi</div>
              </div>
            </div>

            {/* SEÇÃO INTEGRANDO OS ARQUIVOS INTERATIVOS GERADOS */}
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Relatórios Avançados de Impacto</h3>
              <p className="text-sm text-gray-500 mb-6">
                Os scripts analíticos do Python consolidaram relatórios interativos avançados na raiz do seu projeto.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase">Dashboard Completo</span>
                    <h4 className="font-semibold text-gray-800 mt-1">Unificado (3 Abas)</h4>
                  </div>
                  <span className="text-xs text-gray-400 font-mono mt-4">dashboard_unificado.html</span>
                </div>
                
                {/* CARD DA PLANILHA COM O LINK CORRETAMENTE AJUSTADO E ALINHADO */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <a 
                      href="/impacto_financeiro.csv" 
                      download="impacto_financeiro_paggo.csv"
                      className="group block text-left focus:outline-none mb-1"
                    >
                      <span className="text-xs font-bold text-emerald-600 uppercase hover:underline cursor-pointer">
                        Planilha Comercial 📥
                      </span>
                    </a>
                    <h4 className="font-semibold text-gray-800">Exportação Excel</h4>
                  </div>
                  <span className="text-xs text-gray-400 font-mono mt-4">impacto_financeiro.csv</span>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-red-600 uppercase">Mapa de Calor</span>
                    <h4 className="font-semibold text-gray-800 mt-1">Gráficos de Impacto</h4>
                  </div>
                  <span className="text-xs text-gray-400 font-mono mt-4">impacto_financeiro.html</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-800 leading-relaxed">
                💡 **Dica de Negócio:** Você pode usar o assistente **SOL** no canto inferior direito para cruzar esses dados! Experimente perguntar: *“Qual é o impacto financeiro dos itens bomba hoje?”* ou *“Como reduzir os R$ 14,7 milhões de impacto?”*. O SOL está alimentado com o contexto do banco de dados!
              </div>
            </div>
          </div>
        )}

        {/* CHAT FLUTUANTE DA IA (SOL) */}
        <button
          onClick={() => setShowChat((s) => !s)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl transition-all transform hover:scale-110 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
          title="Consultor IA"
        >
          {showChat ? (
            <span className="text-xl font-bold">✕</span>
          ) : (
            <span className="text-2xl animate-pulse">✨</span>
          )}
        </button>

        {showChat && (
          <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-96 flex-col rounded-3xl border border-gray-100 bg-white shadow-2xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-6">
            
            <div className="flex items-center justify-between border-b border-gray-100 p-4 bg-gray-50 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">SOL - Consultor IA</h3>
                  <p className="text-[11px] text-emerald-600 font-medium">● Conectado ao Supabase</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-sm font-medium text-gray-700">Olá! Eu sou o SOL.</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Diga oi para começar. Quando quiser dados do estoque, peça direto — por exemplo: quantos itens críticos tem?
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        m.role === "user" 
                          ? "bg-indigo-600 text-white rounded-br-none" 
                          : "bg-white text-gray-900 border border-gray-100 rounded-bl-none leading-relaxed"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-4 py-2 text-xs shadow-sm flex items-center gap-2">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce [animation-delay:0.2s]">●</span>
                    <span className="animate-bounce [animation-delay:0.4s]">●</span>
                    <span>Analisando estoque...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inputText.trim() || sending) return;
                const userText = inputText.trim();
                setMessages((prev) => [...prev, { role: "user", text: userText }]);
                setInputText("");
                setSending(true);
                try {
                  const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: userText }),
                  });
                  const json = await res.json();
                  const reply = json.reply || "Sem resposta da IA.";
                  setMessages((prev) => [...prev, { role: "assistant", text: String(reply) }]);
                } catch (err) {
                  console.error("Erro no chat:", err);
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: "Erro ao contactar a IA." },
                  ]);
                } finally {
                  setSending(false);
                }
              }}
              className="border-t border-gray-100 p-3 bg-white rounded-b-3xl flex gap-2"
            >
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pergunte ao SOL sobre o inventário..."
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-inner focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors"
              >
                Enviar
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}