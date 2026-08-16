'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Email = {
  id: string;
  title: string;
  category: string;
  content: string;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
};

export function useEmails() {
  const supabase = createClient();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setEmails(data as Email[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const addEmail = async (title: string, category: string, content: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('emails')
      .insert({ title, category, content, user_id: userData.user.id })
      .select()
      .single();

    if (data) {
      setEmails((prev) => [data as Email, ...prev]);
      return data as Email;
    }
  };

  const updateEmail = async (id: string, updates: Partial<Email>) => {
    // Optimistic UI update
    setEmails((prev) =>
      prev.map((email) => (email.id === id ? { ...email, ...updates, updated_at: new Date().toISOString() } : email))
    );

    const { data } = await supabase
      .from('emails')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (data) {
      setEmails((prev) => prev.map((email) => (email.id === id ? (data as Email) : email)));
    }
  };

  const deleteEmail = async (id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('emails').delete().eq('id', id);
  };

  const duplicateEmail = async (email: Email) => {
    await addEmail(`${email.title} (Copy)`, email.category, email.content);
  };

  return { emails, loading, addEmail, updateEmail, deleteEmail, duplicateEmail };
}
