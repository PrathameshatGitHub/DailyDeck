'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Note = {
  id: string;
  note_date: string;
  content: string;
  created_at: string;
};

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

    if (data) setNotes(data as Note[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (content: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('notes')
      .insert({ content, user_id: userData.user.id, note_date: today })
      .select()
      .single();

    if (data) setNotes((prev) => [data as Note, ...prev]);
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notes').delete().eq('id', id);
  };

  const grouped = notes.reduce<Record<string, Note[]>>((acc, note) => {
    acc[note.note_date] = acc[note.note_date] || [];
    acc[note.note_date].push(note);
    return acc;
  }, {});

  return { notes, grouped, loading, addNote, deleteNote };
}
