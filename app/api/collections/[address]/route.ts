import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseAdmin'

/* ───────── GET /api/collections/[address] ───────── */
export async function GET(req: NextRequest) {
  const addr = req.nextUrl.pathname.split('/').pop()?.toLowerCase()

  if (!addr) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

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
export async function PUT(req: NextRequest) {
  const addr = req.nextUrl.pathname.split('/').pop()?.toLowerCase()
  const { cid, owner } = await req.json()

  if (!cid || !owner || !addr) {
    return NextResponse.json(
      { error: 'cid, owner or address missing' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('collections')
    .upsert(
      {
        address: addr,
        cid,
        owner: owner.toLowerCase(),
      },
      { onConflict: 'address' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
