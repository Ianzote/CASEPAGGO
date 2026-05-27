import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Força a rota a ser dinâmica, puxando do banco a cada F5 sem quebrar na nuvem
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const category = searchParams.get("category");

  const itemsPerPage = 15;
  const from = (page - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  try {
    let query = supabase.from("skus").select("*", { count: "exact" });

    if (category && category !== "ALL") {
      query = query.eq("category", category);
    }

    const { data, error, count } = await query
      .order("score_risco", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        {
          error: error.message,
          data: [],
          page,
          totalPages: 0,
          totalItems: 0,
        },
        { status: 500 },
      );
    }

    // Garante que data nunca seja null ou undefined
    const safeData = Array.isArray(data) ? data : [];

    return NextResponse.json({
      data: safeData,
      page,
      totalPages: Math.ceil((count || 0) / itemsPerPage),
      totalItems: count,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      {
        error: "Erro interno no servidor",
        data: [],
        page,
        totalPages: 0,
        totalItems: 0,
      },
      { status: 500 },
    );
  }
}
