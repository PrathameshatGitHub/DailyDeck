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

  const shareEmails = async (emailIds: string[], passcode: string): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;

      // 1. Resolve owner name (look in metadata, preferences, or email)
      let ownerName = userData.user.user_metadata?.full_name || '';
      if (!ownerName) {
        // Fallback to preferences
        const { data: prefData } = await supabase
          .from('ai_email_preferences')
          .select('full_name')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (prefData?.full_name) {
          ownerName = prefData.full_name;
        }
      }
      if (!ownerName) {
        ownerName = userData.user.email || 'Nagin';
      }

      // 2. Generate share key
      const randHex = Math.random().toString(36).substring(2, 8);
      const shareKey = `share-${randHex}`;

      // 3. Insert share header
      const { data: shareData, error: shareErr } = await supabase
        .from('email_shares')
        .insert({
          owner_id: userData.user.id,
          owner_name: ownerName,
          share_key: shareKey,
          passcode: passcode,
        })
        .select()
        .single();

      if (shareErr || !shareData) {
        console.error('Failed to create email share:', shareErr?.message);
        return null;
      }

      // 4. Fetch selected templates
      const { data: selectedTemplates, error: fetchErr } = await supabase
        .from('emails')
        .select('title, category, content')
        .in('id', emailIds);

      if (fetchErr || !selectedTemplates || selectedTemplates.length === 0) {
        // Clean up share
        await supabase.from('email_shares').delete().eq('id', shareData.id);
        return null;
      }

      // 5. Insert share items
      const shareItems = selectedTemplates.map((t) => ({
        share_id: shareData.id,
        title: t.title || 'Untitled',
        category: t.category || '',
        content: t.content || '',
      }));

      const { error: itemsErr } = await supabase
        .from('email_share_items')
        .insert(shareItems);

      if (itemsErr) {
        console.error('Failed to save share items:', itemsErr.message);
        await supabase.from('email_shares').delete().eq('id', shareData.id);
        return null;
      }

      return shareKey;
    } catch (err) {
      console.error('Failed to share emails:', err);
      return null;
    }
  };

  const importEmails = async (shareKey: string, passcode: string): Promise<{ success: boolean; ownerName?: string; count?: number }> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { success: false };

      const { data, error } = await supabase.rpc('import_shared_emails', {
        p_share_key: shareKey.trim(),
        p_passcode: passcode.trim(),
        p_importer_id: userData.user.id,
      });

      if (error || !data) {
        console.error('Failed to import shared emails:', error?.message);
        return { success: false };
      }

      // Refresh state
      await fetchEmails();

      return {
        success: true,
        ownerName: data.owner_name,
        count: data.imported_count,
      };
    } catch (err) {
      console.error('Import emails error:', err);
      return { success: false };
    }
  };

  return { emails, loading, addEmail, updateEmail, deleteEmail, duplicateEmail, shareEmails, importEmails, refetch: fetchEmails };
}