import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/* PUT body { cid }  → marks this row active, clears all others */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const addrLc = (await params).address.toLowerCase();   // force lower‑case
  const { cid } = await req.json();
  if (!cid) return NextResponse.json({ error: 'cid missing' }, { status: 400 });

  /* row must exist first */
  const { error: selErr } = await supabase
    .from('collections')
    .select('owner')
    .eq('address', addrLc)
    .single();

  if (selErr)
    return NextResponse.json({ error: 'collection not found' }, { status: 404 });

  /* flip active flag */
  await supabase.from('collections').update({ active: false }).eq('active', true);
  const { error } = await supabase
    .from('collections')
    .update({ cid, active: true })
    .eq('address', addrLc);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

