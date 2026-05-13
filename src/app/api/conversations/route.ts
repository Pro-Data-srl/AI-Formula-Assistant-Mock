import { NextResponse } from "next/server";
import { listConversations } from "@/lib/chat-store";

export async function GET() {
  try {
    const conversations = await listConversations(50);
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("[api/conversations]", err);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
