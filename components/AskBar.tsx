"use client";

import React, { useState } from "react";

export function AskBar({
  onSubmit,
  disabled
}: {
  onSubmit: (q: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        onSubmit(q.trim());
        setQ("");
      }}
      className="w-1/3"
    >
      <div className="relative">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          rows={4}
          className="w-full px-6 py-4 pr-12 rounded-2xl bg-white/95 outline-none text-gray-900 shadow
                     border border-gray-200 focus:border-gray-400 resize-none"
        />
        <button
          type="submit"
          disabled={disabled}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#6b7280'
          }}
          className="hover:text-gray-800 disabled:opacity-60"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
      </div>
    </form>
  );
}
