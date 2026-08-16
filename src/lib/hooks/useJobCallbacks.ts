'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ContactType = 'email' | 'phone' | 'linkedin' | 'whatsapp' | 'custom';
export type CallbackStatus = 'applied' | 'follow_up_pending' | 'completed' | 'archived';

export type JobCallback = {
  id: string;
  user_id: string;
  title: string;
  company: string | null;
  description: string | null;
  contact_type: ContactType;
  contact_value: string | null;
  applied_date: string;
  follow_up_date: string | null;
  status: CallbackStatus;
  snoozed_until: string | null;
  created_at: string;
};

export function useJobCallbacks() {
  const supabase = createClient();
  const [callbacks, setCallbacks] = useState<JobCallback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCallbacks = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('job_callbacks')
      .select('*')
      .order('follow_up_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Auto-promote to follow_up_pending if follow_up_date has arrived
      // and status is still 'applied' and not snoozed
      const toPromote = data.filter(
        (c) =>
          c.status === 'applied' &&
          c.follow_up_date &&
          c.follow_up_date <= today &&
          (!c.snoozed_until || c.snoozed_until <= today)
      );

      if (toPromote.length > 0) {
        await Promise.all(
          toPromote.map((c) =>
            supabase
              .from('job_callbacks')
              .update({ status: 'follow_up_pending' })
              .eq('id', c.id)
          )
        );
        toPromote.forEach((c) => {
          c.status = 'follow_up_pending';
        });
      }

      setCallbacks(data as JobCallback[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCallbacks();
  }, [fetchCallbacks]);

  const addCallback = async (fields: {
    title: string;
    company?: string;
    description?: string;
    contact_type: ContactType;
    contact_value?: string;
    applied_date: string;
    follow_up_date?: string;
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('job_callbacks')
      .insert({
        ...fields,
        user_id: userData.user.id,
        status: 'applied',
      })
      .select()
      .single();

    if (data) setCallbacks((prev) => [data as JobCallback, ...prev]);
  };

  const updateCallback = async (id: string, updates: Partial<JobCallback>) => {
    setCallbacks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
    await supabase.from('job_callbacks').update(updates).eq('id', id);
  };

  const completeCallback = async (id: string) => {
    await updateCallback(id, { status: 'completed', snoozed_until: null });
  };

  const snoozeCallback = async (id: string, days: number) => {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    const snoozed_until = snoozeDate.toISOString().split('T')[0];
    // Move back to 'applied' so it re-triggers when snooze expires
    await updateCallback(id, { status: 'applied', snoozed_until });
  };

  const deleteCallback = async (id: string) => {
    setCallbacks((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('job_callbacks').delete().eq('id', id);
  };

  const dueToday = callbacks.filter(
    (c) =>
      c.status === 'follow_up_pending'
  );

  const stats = {
    total: callbacks.length,
    applied: callbacks.filter((c) => c.status === 'applied').length,
    followUpDue: dueToday.length,
    completed: callbacks.filter((c) => c.status === 'completed').length,
  };

  return {
    callbacks,
    loading,
    stats,
    dueToday,
    addCallback,
    updateCallback,
    completeCallback,
    snoozeCallback,
    deleteCallback,
  };
}
