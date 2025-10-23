"use client";

import React from "react";

export function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} my-2`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow
          ${isUser ? "bg-white/90 border border-gray-200" : "bg-black/80 text-white"}`}
      >
        {content}
      </div>
    </div>
  );
}
