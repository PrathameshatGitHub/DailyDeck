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

const LOCAL_STORAGE_KEY = 'dailydeck_global_shares';

export function useGlobalSpace() {
  const supabase = createClient();
  const [shares, setShares] = useState<GlobalShare[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial state from local storage cache
  useEffect(() => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        setShares(JSON.parse(local));
      }
    } catch {}
  }, []);

  const saveToLocal = (items: GlobalShare[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  };

  const fetchGlobalShares = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_shares')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setShares(data as GlobalShare[]);
        saveToLocal(data as GlobalShare[]);
      }
    } catch (err) {
      console.warn('Could not fetch global_shares from Supabase, using local cache:', err);
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
          senderName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Member';
        }
      }
    } catch {}

    if (!senderName) {
      // Try local email preferences
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
    const newShare: GlobalShare = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      title: title || `${type === 'email' ? 'Emails' : 'Phone Numbers'} Collection`,
      sender_name: senderName,
      user_id: userId,
      items: validItems,
      created_at: now,
    };

    // Optimistic update
    setShares((prev) => {
      const updated = [newShare, ...prev];
      saveToLocal(updated);
      return updated;
    });

    // Try sync to Supabase database
    try {
      const { data, error } = await supabase
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

      if (!error && data) {
        setShares((prev) => prev.map((s) => (s.id === newShare.id ? (data as GlobalShare) : s)));
        return data as GlobalShare;
      }
    } catch (err) {
      console.warn('Saved global share locally (Supabase table offline/pending):', err);
    }

    return newShare;
  };

  const deleteGlobalShare = async (id: string) => {
    setShares((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      saveToLocal(filtered);
      return filtered;
    });

    try {
      await supabase.from('global_shares').delete().eq('id', id);
    } catch {}
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
    fetchGlobalShares,
    shareToGlobal,
    deleteGlobalShare,
    sharedEmailsSet,
    sharedPhonesSet,
    getUnsharedItems,
  };
}

