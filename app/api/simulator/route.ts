import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { simulatorSubmissions } from "../../../lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, company, role, phone, email, additionalNotes, area, buildingType, estimatedValue } = body;

    // Validate required fields
    if (!name || !company || !email) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes: nome, empresa e e-mail são necessários." },
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
      .insert(simulatorSubmissions)
      .values({
        name,
        company,
        role: role || null,
        phone: phone || null,
        email,
        additionalNotes: additionalNotes || null,
        area: area ? parseInt(area.toString(), 10) : null,
        buildingType: buildingType || null,
        estimatedValue: estimatedValue || null,
      })
      .returning({ id: simulatorSubmissions.id });

    return NextResponse.json({
      success: true,
      message: "Lead do simulador de custos salvo com sucesso no Supabase!",
      id: newSubmission.id,
    });
  } catch (error: any) {
    console.error("Error processing simulator submission:", error);
    return NextResponse.json(
      { error: "Erro ao salvar simulação: " + (error.message || error) },
      { status: 500 }
    );
  }
}
