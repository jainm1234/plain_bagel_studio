import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      source?: string;
    };
    const email = normalizeEmail(body.email || "");
    const source = (body.source || "mailing-list").trim().slice(0, 64);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("mailing_list_emails").upsert(
      {
        email,
        source,
      },
      { onConflict: "email", ignoreDuplicates: true },
    );

    if (error) {
      throw new Error(
        error.code === "PGRST205"
          ? "Mailing list table missing — run the mailing_list_emails SQL in Supabase."
          : error.message,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to save email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
