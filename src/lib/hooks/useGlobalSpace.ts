'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type GlobalShare = {
  id: string;
  type: 'email' | 'phone';
  title: string;
  sender_name: string;
  user_id?: string;
  items: string[];
  created_at: string;
};

export function useGlobalSpace() {
  const supabase = createClient();
  const [shares, setShares] = useState<GlobalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobalShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('global_shares')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Failed to fetch global_shares from Supabase:', fetchError);
        setError(`Database error: ${fetchError.message}`);
      } else {
        setShares((data as GlobalShare[]) || []);
      }
    } catch (err: any) {
      console.error('Network error fetching global_shares:', err);
      setError(`Network error: ${err?.message || 'Unknown error'}`);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchGlobalShares();
  }, [fetchGlobalShares]);

  const shareToGlobal = async (
    type: 'email' | 'phone',
    title: string,
    items: string[],
    customSenderName?: string
  ): Promise<GlobalShare | null> => {
    if (!items || items.length === 0) return null;

    const validItems = Array.from(new Set(items.map((i) => i.trim()).filter(Boolean)));
    if (validItems.length === 0) return null;

    let senderName = customSenderName || '';
    let userId: string | undefined = undefined;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
        if (!senderName) {
          senderName =
            userData.user.user_metadata?.full_name ||
            userData.user.email?.split('@')[0] ||
            'Member';
        }
      }
    } catch {}

    if (!senderName) {
      try {
        const prefRaw = localStorage.getItem('dailydeck_ai_email_prefs');
        if (prefRaw) {
          const parsed = JSON.parse(prefRaw);
          senderName = parsed.full_name || parsed.your_email || 'Member';
        }
      } catch {}
    }

    if (!senderName) senderName = 'Anonymous Member';

    const now = new Date().toISOString();
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newShare: GlobalShare = {
      id: newId,
      type,
      title: title || `${type === 'email' ? 'Emails' : 'Phone Numbers'} Collection`,
      sender_name: senderName,
      user_id: userId,
      items: validItems,
      created_at: now,
    };

    try {
      const { data, error: insertError } = await supabase
        .from('global_shares')
        .insert({
          id: newShare.id,
          type: newShare.type,
          title: newShare.title,
          sender_name: newShare.sender_name,
          user_id: userId,
          items: newShare.items,
          created_at: now,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert global share into Supabase:', insertError);
        return null;
      }

      if (data) {
        // Optimistically add to local state so UI updates immediately
        setShares((prev) => [data as GlobalShare, ...prev]);
        return data as GlobalShare;
      }
    } catch (err) {
      console.error('Exception inserting global share:', err);
      return null;
    }

    return null;
  };

  const deleteGlobalShare = async (id: string) => {
    // Optimistic local remove
    setShares((prev) => prev.filter((s) => s.id !== id));

    try {
      const { error: deleteError } = await supabase
        .from('global_shares')
        .delete()
        .eq('id', id);
      if (deleteError) {
        console.error('Failed to delete global share:', deleteError);
        fetchGlobalShares(); // Restore correct state on error
      }
    } catch (err) {
      console.error('Exception deleting global share:', err);
      fetchGlobalShares();
    }
  };

  const sharedEmailsSet = new Set(
    shares
      .filter((s) => s.type === 'email')
      .flatMap((s) => s.items)
      .map((e) => e.toLowerCase().trim())
  );

  const sharedPhonesSet = new Set(
    shares
      .filter((s) => s.type === 'phone')
      .flatMap((s) => s.items)
      .map((p) => p.replace(/\D/g, ''))
  );

  const getUnsharedItems = (type: 'email' | 'phone', items: string[]): string[] => {
    if (!items || items.length === 0) return [];
    if (type === 'email') {
      return items.filter((email) => {
        const clean = email.toLowerCase().trim();
        return clean && !sharedEmailsSet.has(clean);
      });
    } else {
      return items.filter((phone) => {
        const clean = phone.replace(/\D/g, '');
        return clean && !sharedPhonesSet.has(clean);
      });
    }
  };

  return {
    shares,
    loading,
    error,
    fetchGlobalShares,
    shareToGlobal,
    deleteGlobalShare,
    sharedEmailsSet,
    sharedPhonesSet,
    getUnsharedItems,
  };
}

