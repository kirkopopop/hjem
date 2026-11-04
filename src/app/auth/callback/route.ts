import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

// Email confirmation lands here. If the confirmation was opened on a different
// browser than the one used to sign up (e.g. Safari vs the installed app), the
// code exchange fails, but the email is already confirmed, so we just ask the
// person to sign in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
