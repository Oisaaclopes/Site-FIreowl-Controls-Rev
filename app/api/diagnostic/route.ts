import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { sdaiDiagnostics } from "../../../lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, company, phone, profileTitle, recommendation, answers } = body;

    // Validate required fields
    if (!name || !company || !phone) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: nome, empresa e telefone são necessários." },
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

    // Convert answers serialize output
    const serializedAnswers = typeof answers === "object" ? JSON.stringify(answers) : answers;

    const [newSubmission] = await db
      .insert(sdaiDiagnostics)
      .values({
        name,
        company,
        phone,
        profileTitle: profileTitle || null,
        recommendation: recommendation || null,
        answers: serializedAnswers || null,
      })
      .returning({ id: sdaiDiagnostics.id });

    return NextResponse.json({
      success: true,
      message: "Diagnóstico Inteligente SDAI salvo com sucesso no Supabase!",
      id: newSubmission.id,
    });
  } catch (error: any) {
    console.error("Error processing diagnostic submission:", error);
    return NextResponse.json(
      { error: "Erro ao salvar diagnóstico: " + (error.message || error) },
      { status: 500 }
    );
  }
}
