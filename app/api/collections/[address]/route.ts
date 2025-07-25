import { supabase } from '@/lib/supabaseAdmin';
import { NextResponse, NextRequest } from 'next/server';

// helper to avoid repeating the long type
type Ctx = { params: Promise<{ address: string }> };

/* ───────────────────────────────────────────────
   GET /api/collections/:address  -> { cid } | 404
   ───────────────────────────────────────────────*/
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { address } = await params;           // await ⇐ new
  const addr = address.toLowerCase();

  const { data, error } = await supabase
    .from('collections')
    .select('cid')
    .eq('address', addr)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 400 },
    );
  }
  return NextResponse.json({ cid: data!.cid });
}

/* ───────────────────────────────────────────────
   PUT /api/collections/:address
   body → { cid, owner }
   ───────────────────────────────────────────────*/
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { address } = await params;           // await ⇐ new
  const { cid, owner } = await req.json();

  if (!cid || !owner) {
    return NextResponse.json({ error: 'cid or owner missing' }, { status: 400 });
  }

  const { error } = await supabase
    .from('collections')
    .upsert(
      {
        address : address.toLowerCase(),
        cid,
        owner   : owner.toLowerCase(),
      },
      { onConflict: 'address' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
