"use client";

import React from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatContainer({ messages, isLoading }: ChatContainerProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-muted-foreground">
          <p className="text-lg">How is your faith?</p>
          <p className="text-sm mt-2">Start a conversation to explore your spiritual journey</p>
        </div>
      ) : (
        messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-3">
            <div className="flex items-center space-x-2">
              <div className="animate-pulse">Thinking...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
