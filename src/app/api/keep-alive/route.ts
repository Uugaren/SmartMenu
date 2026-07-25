import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Perform a lightweight ping query to Supabase to keep the DB active
    const { data, error } = await supabase.from('tenants').select('id, name').limit(1);

    if (error) {
      return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Supabase pinged successfully. Database active!',
      timestamp: new Date().toISOString(),
      tenantCount: data ? data.length : 0,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ status: 'error', error: errorMessage }, { status: 500 });
  }
}
