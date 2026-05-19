import { NextResponse } from "next/server";
import { listConversations } from "@/lib/chat-store";

export async function GET() {
  try {
    const conversations = await listConversations(50);
    return NextResponse.json(conversations);
  } catch (err) {
    const isConnRefused =
      typeof err === "object" && err !== null && (err as { code?: string }).code === "ECONNREFUSED";

    if (isConnRefused) {
      // Print a prominent block so the dev server output is easy to spot.
      console.error(
        "\n╔══════════════════════════════════════════════════════╗\n" +
        "║  DATABASE UNREACHABLE — ECONNREFUSED                 ║\n" +
        "║  Start Postgres:  docker compose up -d               ║\n" +
        "║  Then migrate:    npm run db:migrate                 ║\n" +
        "╚══════════════════════════════════════════════════════╝\n"
      );
    } else {
      console.error("[api/conversations]", err);
    }

    return NextResponse.json(
      {
        error: isConnRefused
          ? "Database connection refused — run `docker compose up -d`."
          : "Failed to load conversations",
      },
      { status: 500 }
    );
  }
}
