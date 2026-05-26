import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const category = searchParams.get('category');
  
  const itemsPerPage = 15;
  const from = (page - 1) * itemsPerPage;
  const to = from + itemsPerPage - 1;

  try {
    let query = supabase
      .from('skus')
      .select('*', { count: 'exact' });

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query
      .order('score_risco', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      page,
      totalPages: Math.ceil((count || 0) / itemsPerPage),
      totalItems: count
    });

  } catch (err) {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
