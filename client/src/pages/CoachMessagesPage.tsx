import { useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderUsername: string;
  createdAt: string;
  read: boolean;
};

export default function CoachMessagesPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const relationshipId = params.get("relationshipId") ?? "";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [] } = useQuery<Message[]>({
    queryKey: ["/api/coaching/messages", relationshipId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/messages/${relationshipId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!relationshipId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/coaching/messages", { coachPlayerId: relationshipId, content });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/messages", relationshipId] });
    },
  });

  const handleSend = () => {
    if (text.trim()) sendMutation.mutate(text.trim());
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full py-4 flex flex-col h-[calc(100vh-12rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <button onClick={() => navigate("/coach")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl uppercase tracking-wider">Messages</h1>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {msgs.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">No messages yet. Say hello!</p>
          )}
          {msgs.map(msg => {
            const isMe = msg.senderId === user?.id;
            const senderName = [msg.senderFirstName, msg.senderLastName].filter(Boolean).join(" ") || msg.senderUsername;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                  {!isMe && <p className="text-[10px] font-semibold mb-1 opacity-60">{senderName}</p>}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Send form */}
        <div className="border-t border-border pt-4 flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="icon" onClick={handleSend} disabled={!text.trim() || sendMutation.isPending}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </Layout>
  );
}
