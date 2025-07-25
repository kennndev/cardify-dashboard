import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/* PUT body { cid }  → marks this row active, clears all others */
export async function PUT(req: NextRequest, { params }: { params: { address: string } }) {
  const { cid } = await req.json();
  const address = params.address.toLowerCase();

  if (!cid)
    return NextResponse.json({ error: 'cid missing' }, { status: 400 });

  /* ❶ deactivate any previously‑active row */
  await supabase
    .from('collections')
    .update({ active: false })
    .eq('active', true);

  /* ❷ upsert the new active row */
  const { error } = await supabase
    .from('collections')
    .upsert({ address, cid, active: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
