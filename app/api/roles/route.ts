// app/api/roles/route.ts
export const runtime = 'nodejs';      // keep this!

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';;

/* GET  /api/roles ----------------------------------------------------------- */
export async function GET() {
  const { data, error } = await supabase
    .from('dashboard_roles')
    .select('id,email,role');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/* POST  /api/roles  { email, role }  (super_admin only) -------------------- */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase
    .from('dashboard_roles')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data[0]);
}

/* DELETE  /api/roles  { id }  (super_admin only) --------------------------- */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabase
    .from('dashboard_roles')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({}, { status: 204 });
}
