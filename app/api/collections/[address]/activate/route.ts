import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ address: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { address } = await params;             // 👈 await
  const { cid } = await req.json();
  if (!cid)
    return NextResponse.json({ error: 'cid missing' }, { status: 400 });

  /* 1️⃣  deactivate previous active row */
  await supabase.from('collections').update({ active: false }).eq('active', true);

  /* 2️⃣  upsert this row as active */
  const { error } = await supabase
    .from('collections')
    .upsert({ address: address.toLowerCase(), cid, active: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
