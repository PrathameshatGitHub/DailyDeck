'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Note = {
  id: string;
  note_date: string;
  content: string;
  is_pinned?: boolean;
  created_at: string;
};

const LOCAL_PINNED_KEY = 'dailydeck_pinned_notes';

function getLocalPinnedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PINNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPinnedId(id: string, isPinned: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalPinnedIds();
    let updated: string[];
    if (isPinned) {
      updated = Array.from(new Set([...current, id]));
    } else {
      updated = current.filter((x) => x !== id);
    }
    localStorage.setItem(LOCAL_PINNED_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function useNotes() {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      const localPinned = getLocalPinnedIds();
      const enrichedNotes: Note[] = (data as Note[]).map((note) => ({
        ...note,
        is_pinned: note.is_pinned ?? localPinned.includes(note.id),
      }));
      setNotes(enrichedNotes);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (content: string, noteDate?: string, isPinned: boolean = false) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const targetDate = noteDate || new Date().toISOString().split('T')[0];

    // Try inserting with is_pinned
    let createdNote: Note | null = null;
    const { data, error } = await supabase
      .from('notes')
      .insert({ content, user_id: userData.user.id, note_date: targetDate, is_pinned: isPinned })
      .select()
      .single();

    if (!error && data) {
      createdNote = { ...(data as Note), is_pinned: isPinned };
    } else if (error) {
      // Fallback in case is_pinned column hasn't been created in Supabase yet
      const fallback = await supabase
        .from('notes')
        .insert({ content, user_id: userData.user.id, note_date: targetDate })
        .select()
        .single();
      if (fallback.data) {
        createdNote = { ...(fallback.data as Note), is_pinned: isPinned };
      }
    }

    if (createdNote) {
      if (isPinned) saveLocalPinnedId(createdNote.id, true);
      setNotes((prev) => [createdNote!, ...prev]);
    }
  };

  const updateNote = async (id: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content } : n))
    );
    await supabase.from('notes').update({ content }).eq('id', id);
  };

  const togglePin = async (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    const nextPinned = !target.is_pinned;

    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_pinned: nextPinned } : n))
    );
    saveLocalPinnedId(id, nextPinned);

    try {
      await supabase.from('notes').update({ is_pinned: nextPinned }).eq('id', id);
    } catch {
      // Silent catch if column not present yet
    }
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    saveLocalPinnedId(id, false);
    await supabase.from('notes').delete().eq('id', id);
  };

  const grouped = notes.reduce<Record<string, Note[]>>((acc, note) => {
    acc[note.note_date] = acc[note.note_date] || [];
    acc[note.note_date].push(note);
    return acc;
  }, {});

  return { notes, grouped, loading, addNote, updateNote, togglePin, deleteNote };
}
