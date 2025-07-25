import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseAdmin'

type Context = { params: { address: string } }

/* ───────── GET /api/collections/[address] ───────── */
export async function GET(
  _req: NextRequest,
  { params }: Context,
) {
  const addr = params.address.toLowerCase()

  const { data, error } = await supabase
    .from('collections')
    .select('cid')
    .eq('address', addr)
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 400 },
    )
  }

  return NextResponse.json({ cid: data.cid })
}

/* ───────── PUT /api/collections/[address] ───────── */
export async function PUT(
  req: NextRequest,
  { params }: Context,
) {
  const { cid, owner } = await req.json()

  if (!cid || !owner) {
    return NextResponse.json(
      { error: 'cid or owner missing' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('collections')
    .upsert(
      {
        address : params.address.toLowerCase(),
        cid,
        owner   : owner.toLowerCase(),
      },
      { onConflict: 'address' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
