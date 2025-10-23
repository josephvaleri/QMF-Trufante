"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ask, type ChatTurn } from "./(site)/useAsk";
import { ChatMessage } from "@/components/ChatMessage";
import { AskBar } from "@/components/AskBar";

export default function HomePage() {
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [paddingTop, setPaddingTop] = useState("40px");
  const streamBuffer = useRef("");

  async function handleAsk(q: string) {
    // Push user turn
    setChat((c) => [...c, { role: "user", content: q }]);
    setShowChat(true);
    setIsThinking(true);
    streamBuffer.current = "";
    const localHistory = [...chat, { role: "user" as const, content: q }];

    await ask(q, localHistory, (chunk) => {
      streamBuffer.current += chunk;

      // Stream chunks -> we want only SSE data chars (simple approach)
      // The OpenAI Responses SSE chunks are plain text; append as they arrive.
      setChat((prev) => {
        const last = prev[prev.length - 1];
        // if last is assistant, update it; else add a new assistant message
        if (last?.role === "assistant") {
          const copy = prev.slice(0, -1);
          return [...copy, { role: "assistant" as const, content: (last.content || "") + chunk }];
        } else {
          return [...prev, { role: "assistant" as const, content: chunk }];
        }
      });
    }).catch((err) => {
      setChat((c) => [...c, { role: "assistant", content: "Sorry—there was an error fetching the answer." }]);
      console.error(err);
    }).finally(() => setIsThinking(false));
  }

  return (
    <main className="relative min-h-screen w-full">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/bg.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "var(--bg-overlay)" }} />
      </div>

      {/* Hero / Input */}
      <div className="w-full flex flex-col items-center text-center pb-12 px-4" style={{ paddingTop: paddingTop }}>
        <div className="relative w-[260px] h-[260px] mb-6">
          <Image
            src="/qmf-logo.png"
            alt="Question My Faith"
            fill
            sizes="260px"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>

        <p className="text-blue-900 italic mb-6" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)', color: '#1e3a8a', fontSize: '20px' }}>How is your faith?</p>

        {!showChat && (
          <div className="w-full flex flex-col items-center gap-6">
            <AskBar onSubmit={handleAsk} disabled={isThinking} />
            <p className="text-white text-sm max-w-2xl font-bold" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)', color: 'white', fontWeight: 'bold', fontSize: '13px', lineHeight: '1.5' }}>
              What follows isn't a quiz or sermon.<br />
              It's a private dialogue meant to help you name<br />
              where you are in faith and life - at your own pace.
            </p>
          </div>
        )}

      </div>

      {/* Chat */}
      {showChat && (
        <section className="w-full max-w-4xl mx-auto px-4 pb-24">
          <div className="rounded-3xl bg-white/85 backdrop-blur-sm p-4 md:p-6 shadow border border-white/50">
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              {chat.map((t, i) => (
                <ChatMessage key={i} role={t.role} content={t.content} />
              ))}
              {isThinking && (
                <div className="text-gray-500 text-sm italic px-1 py-2">Thinking…</div>
              )}
            </div>
            <div className="mt-4">
              <AskBar onSubmit={handleAsk} disabled={isThinking} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}