import { NextRequest, NextResponse } from "next/server";
import { loadMessages } from "@/lib/chat-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }
  try {
    const messages = await loadMessages(id);
    return NextResponse.json({ id, messages });
  } catch (err) {
    console.error("[api/conversations/[id]]", err);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}
