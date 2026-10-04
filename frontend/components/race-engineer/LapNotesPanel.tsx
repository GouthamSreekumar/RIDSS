"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, User, Clock, AlertCircle } from "lucide-react";
import axiosInstance from "@/lib/axios";
import type { UserMeResponse } from "@/features/auth/schemas/loginSchema";

export interface LapNote {
  id: string;
  user_id: string;
  session_id: string;
  driver: string;
  lap_number: number;
  content: string;
  created_at: string;
  user_email?: string | null;
  user_full_name?: string | null;
}

interface LapNotesPanelProps {
  sessionId: string;
  driver: string;
  lapNumber: number;
  currentUser: UserMeResponse | null;
}

export function LapNotesPanel({
  sessionId,
  driver,
  lapNumber,
  currentUser,
}: LapNotesPanelProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryKey = ["lapNotes", sessionId, driver, lapNumber];

  const { data: notes = [], isLoading, isError } = useQuery<LapNote[]>({
    queryKey,
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/race-engineer/lap-notes", {
        params: {
          session_id: sessionId,
          driver,
          lap: lapNumber,
        },
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteContent: string) => {
      const res = await axiosInstance.post("/api/v1/race-engineer/lap-notes", {
        session_id: sessionId,
        driver,
        lap_number: lapNumber,
        content: noteContent,
      });
      return res.data;
    },
    onSuccess: () => {
      setContent("");
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || "Failed to create note.");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await axiosInstance.delete(`/api/v1/race-engineer/lap-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to delete note.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createNoteMutation.mutate(content.trim());
  };

  const isAuthorOrAdmin = (note: LapNote) => {
    if (!currentUser) return false;
    if (currentUser.user_id === note.user_id) return true;
    const role = currentUser.role?.toLowerCase() || "";
    return role === "administrator" || role === "admin";
  };

  return (
    <div className="border border-slate-800 bg-slate-surface p-4 border-l-2 border-l-cyan-400 space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center gap-2">
          <MessageSquare size={16} className="text-cyan-400" />
          Lap Annotations & Engineer Notes
        </h3>
        <span className="sharp-tag bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {errorMsg}
        </div>
      )}

      {/* Existing Notes List */}
      {isLoading ? (
        <div className="text-xs text-slate-400 font-mono py-3">Loading lap notes...</div>
      ) : isError ? (
        <div className="text-xs text-red-400 py-2">Error loading notes.</div>
      ) : notes.length === 0 ? (
        <div className="text-xs text-slate-500 font-mono py-4 text-center border border-dashed border-slate-800 bg-slate-950/50">
          No engineering notes added for Driver {driver} Lap #{lapNumber} yet.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className="border border-slate-800 bg-slate-950 p-3 relative group transition-colors hover:border-slate-700"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5 border-b border-slate-900 pb-1">
                <span className="flex items-center gap-1 text-slate-300 font-semibold">
                  <User size={12} className="text-cyan-400" />
                  {note.user_full_name || note.user_email || `User ${note.user_id.slice(0, 8)}`}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock size={10} />
                  {new Date(note.created_at).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                {note.content}
              </p>

              {isAuthorOrAdmin(note) && (
                <button
                  onClick={() => {
                    if (confirm("Delete this lap note?")) {
                      deleteNoteMutation.mutate(note.id);
                    }
                  }}
                  disabled={deleteNoteMutation.isPending}
                  className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                  title="Delete note"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Note Form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Add engineering annotation for Lap #${lapNumber}...`}
            rows={2}
            className="w-full border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none placeholder:text-slate-600"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createNoteMutation.isPending || !content.trim()}
            className="inline-flex items-center gap-1.5 bg-cyan-400 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />
            {createNoteMutation.isPending ? "Adding..." : "Add Note"}
          </button>
        </div>
      </form>
    </div>
  );
}
