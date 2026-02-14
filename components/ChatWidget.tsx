"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChatMessage } from "@/lib/types";

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeature: { type: string; id: string; name: string } | null;
  currentLesson: number | null;
  visibleLayers: string[];
  onFeatureHighlight: (featureId: string | null) => void;
}

function parseMessageContent(
  content: string,
  onFeatureClick: (featureId: string) => void
): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const displayName = match[1];
    const featureId = match[2];
    parts.push(
      <button
        key={key++}
        onClick={() => onFeatureClick(featureId)}
        className="text-green-700 hover:text-green-900 underline decoration-dotted underline-offset-2 font-semibold transition-colors"
        title="Click to highlight on map"
      >
        {displayName}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

export function ChatWidget({
  isOpen,
  onClose,
  selectedFeature,
  currentLesson,
  visibleLayers,
  onFeatureHighlight,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build full conversation history for AI context
      const conversationHistory = [
        ...messages,
        userMessage,
      ].map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          messages: conversationHistory,
          mapContext: {
            currentLesson,
            visibleLayers,
            selectedFeature,
          },
        }),
      });

      const data = await response.json();

      if (data.error && !data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${data.error}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            featureReferences: data.featureReferences,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble connecting. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFeatureClick = (featureId: string) => {
    onFeatureHighlight(featureId);
    setTimeout(() => onFeatureHighlight(null), 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:inset-auto md:bottom-4 md:right-4 md:w-[420px] md:h-[600px] bg-white md:rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-trail-green to-trail-green-dark text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="font-semibold">GIS Field Coach</h3>
          <p className="text-xs opacity-80">
            Ask about GIS, maintenance patterns, or SSPR features
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-2xl hover:opacity-80 leading-none"
          aria-label="Close chat"
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-lg mb-2">
              Hey! I&apos;m your GIS Field Coach.
            </p>
            <p className="text-sm mb-4">
              Ask me about GIS concepts, maintenance patterns, or
              anything about the SSPR trail system.
            </p>
            <div className="space-y-2">
              {[
                "Why does erosion keep happening near the same spots?",
                "What GIS concepts am I using when I toggle map layers?",
                "How can I use my maintenance data to request more resources?",
                "Why do trails near waterways need more maintenance?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-trail-green text-white"
                  : "bg-white shadow-sm border border-gray-200 text-gray-900"
              }`}
            >
              <div className={`text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === "assistant" ? "text-gray-800" : ""
              }`}>
                {msg.role === "assistant"
                  ? parseMessageContent(msg.content, handleFeatureClick)
                  : msg.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm border border-gray-100 rounded-lg px-4 py-2.5">
              <div className="flex space-x-1.5">
                <div
                  className="w-2 h-2 bg-trail-green rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-trail-green rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-trail-green rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about GIS, maintenance, or SSPR..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-trail-green focus:border-transparent outline-none text-gray-900"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-trail-green text-white rounded-lg text-sm font-medium hover:bg-trail-green-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
