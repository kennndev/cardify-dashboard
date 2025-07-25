import { supabase } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

/* ──────────────────────────────────────────────────────────────
   GET  /api/collections/:address
   →  { cid } | 404
   ──────────────────────────────────────────────────────────────*/
export async function GET(
  _req: Request,
  { params }: { params: { address: string } },
) {
  /* normalise to lowercase ‑ the PK is stored that way */
  const addr = params.address.toLowerCase();

  const { data, error } = await supabase
    .from('collections')
    .select('cid')
    .eq('address', addr)
    .single();                           // want exactly one row

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 400 }, // 116 = no rows
    );

  return NextResponse.json({ cid: data.cid });
}

/* ──────────────────────────────────────────────────────────────
   PUT  /api/collections/:address
   body → { cid, owner }
   Upsert (insert‑or‑update) the row keyed by address
   ──────────────────────────────────────────────────────────────*/
export async function PUT(
  req: Request,
  { params }: { params: { address: string } },
) {
  const { cid, owner } = await req.json();

  if (!cid || !owner)
    return NextResponse.json(
      { error: 'cid or owner missing' },
      { status: 400 },
    );

  const { error } = await supabase
    .from('collections')
    .upsert(
      {
        address : params.address.toLowerCase(), // PK stored lowercase
        cid,
        owner   : owner.toLowerCase(),
      },
      { onConflict: 'address' },               // “insert‑or‑update”
    );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
