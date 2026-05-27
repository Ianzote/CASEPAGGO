"use client";

import React, { useEffect, useState, useRef } from "react";

type SKU = { [key: string]: any };

export default function DashboardPage() {
  const [data, setData] = useState<SKU[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [category, setCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(false);

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

        // Se houver erro na API, mostra console e trata
        if (json.error) {
          console.error("API error:", json.error);
          setData([]);
          setTotalPages(1);
        } else {
          setData(Array.isArray(json.data) ? json.data : []);
          setTotalPages(json.totalPages || 1);
        }
      } catch (err) {
        console.error("Failed to load skus", err);
        if (mounted) {
          setData([]);
          setTotalPages(1);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchSkus();
    return () => {
      mounted = false;
    };
  }, [page, category]);

  // Auto-scroll para a última mensagem do chat
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
              Dashboard de Inventário
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Visão geral de riscos, categorias e recomendações de IA.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm font-medium text-gray-600">
              Filtrar por categoria
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
          </div>
        </header>

        {/* METRICS CARDS */}
        <section className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">
              Risco Crítico
            </div>
            <div className="mt-4 text-5xl font-semibold text-red-600">835</div>
            <p className="mt-2 text-sm text-gray-500">Exigem ação imediata.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">
              Alerta Operacional
            </div>
            <div className="mt-4 text-5xl font-semibold text-orange-500">
              574
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Precisam de monitoramento.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-medium text-gray-500">
              Estabilizados
            </div>
            <div className="mt-4 text-5xl font-semibold text-emerald-600">
              6.591
            </div>
            <p className="mt-2 text-sm text-gray-500">Inventário estável.</p>
          </div>
        </section>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* TABELA DE SKUs */}
          <main className="lg:col-span-3 space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Lista de SKUs
                  </h2>
                  <p className="text-sm text-gray-500">
                    Filtre e navegue pelos SKUs ordenados por criticidade.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 self-start md:self-auto">
                  Página {page} de {totalPages}
                </span>
              </div>

              {/* WRAPPER RESPONSIVO PARA PROTEGER A TABELA */}
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Estoque
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Vendas (30d)
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          Carregando...
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          Nenhum SKU encontrado.
                        </td>
                      </tr>
                    ) : (
                      data.map((item, idx) => {
                        const id = item.sku_id ?? "—";
                        const name = item.sku_name ?? "—";
                        const cat = item.category ?? "—";
                        const stock = item.current_stock ?? 0;
                        const avg =
                          item.sales_30d ??
                          item.vendas_30d ??
                          item.daily_sales_30d_avg ??
                          0;
                        const score = Number(item.score_risco ?? 0);
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-gray-700 font-mono text-xs">
                              {id}
                            </td>
                            <td className="px-4 py-4 text-gray-700 font-medium">
                              {name}
                            </td>
                            <td className="px-4 py-4 text-gray-500">{cat}</td>
                            <td className="px-4 py-4 text-gray-700">{stock}</td>
                            <td className="px-4 py-4 text-gray-700">{avg}</td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(score)}`}
                              >
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
                  <p className="text-sm font-semibold text-gray-900">
                    Ranking de Atenção
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Categorias prioritárias.
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  Top 3
                </span>
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

        {/* CHAT FLUTUANTE DA IA */}
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
                  <h3 className="font-semibold text-sm text-gray-900">
                    SOL - Consultor IA
                  </h3>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    ● Conectado ao Supabase
                  </p>
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
                  <p className="text-sm font-medium text-gray-700">
                    Olá! Eu sou o SOL. 🫡
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Estou munido com a análise de risco do seu estoque. Pode me
                    perguntar sobre os SKUs mais críticos ou diagnósticos das
                    categorias!
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
                    <span className="animate-bounce [animation-delay:0.2s]">
                      ●
                    </span>
                    <span className="animate-bounce [animation-delay:0.4s]">
                      ●
                    </span>
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
                setMessages((prev) => [
                  ...prev,
                  { role: "user", text: userText },
                ]);
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
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: String(reply) },
                  ]);
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
