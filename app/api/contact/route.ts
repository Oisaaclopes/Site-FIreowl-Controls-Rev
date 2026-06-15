import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { contactSubmissions } from "../../../lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, company, role, phone, email, city, message, interest, protocolId } = body;

    // Validate required fields
    if (!name || !company || !email || !message) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: nome, empresa, e-mail e mensagem são necessários." },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getDb();
    } catch (dbErr: any) {
      console.error("Database connection initialization failed:", dbErr);
      return NextResponse.json(
        { error: "O banco de dados não está configurado. Por favor, insira a variável DATABASE_URL nas configurações e reinicie." },
        { status: 503 }
      );
    }

    const [newSubmission] = await db
      .insert(contactSubmissions)
      .values({
        name,
        company,
        role: role || null,
        phone: phone || null,
        email,
        city: city || null,
        message,
        interest: interest || "all",
        protocolId: protocolId || null,
      })
      .returning({ id: contactSubmissions.id });

    return NextResponse.json({
      success: true,
      message: "Lead de contato salvo com sucesso no Supabase!",
      id: newSubmission.id,
    });
  } catch (error: any) {
    console.error("Error processing contact submission:", error);
    return NextResponse.json(
      { error: "Erro ao salvar contato: " + (error.message || error) },
      { status: 500 }
    );
  }
}
