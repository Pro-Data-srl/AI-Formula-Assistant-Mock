"use client";

import { FormelProvider } from "@/contexts/formel-context";
import { Formelassistent } from "@/components/formel-assistent";
import { AssistantChat } from "@/components/assistant-chat";

export default function Home() {
  return (
    <FormelProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 p-4 font-sans dark:bg-zinc-950 md:p-6">
        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-4 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Formelassistent />
          </div>
          <div className="flex w-80 shrink-0 flex-col overflow-hidden md:w-96">
            <AssistantChat />
          </div>
        </main>
      </div>
    </FormelProvider>
  );
}
