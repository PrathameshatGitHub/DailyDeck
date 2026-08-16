'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type FinanceEntry = {
  id: string;
  entry_date: string;
  bank_money: number;
  udhar: number;
  bank_change_reason?: string;
  udhar_change_reason?: string;
  created_at: string;
};

export type FinanceEntryWithCalculations = FinanceEntry & {
  bank_diff: number;
  udhar_diff: number;
  total: number;
  total_diff: number;
};

export function useFinance() {
  const supabase = createClient();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_logs')
      .select('*')
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching finance logs:', error);
    } else if (data) {
      // Coerce numeric types which come back as strings from PostgreSQL
      const parsedData = (data as any[]).map(item => ({
        ...item,
        bank_money: parseFloat(item.bank_money || 0),
        udhar: parseFloat(item.udhar || 0)
      }));
      setEntries(parsedData as FinanceEntry[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Compute calculated entries (deltas and totals) chronologically
  const getCalculatedEntries = useCallback((): FinanceEntryWithCalculations[] => {
    // 1. Sort entries chronologically (oldest first) to compute deltas
    const sortedAsc = [...entries].sort((a, b) => 
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const calculated: FinanceEntryWithCalculations[] = sortedAsc.map((entry, idx) => {
      const prev = idx > 0 ? sortedAsc[idx - 1] : null;
      
      const bank_diff = prev ? entry.bank_money - prev.bank_money : entry.bank_money;
      const udhar_diff = prev ? entry.udhar - prev.udhar : entry.udhar;
      const total = entry.bank_money + entry.udhar;
      const prev_total = prev ? prev.bank_money + prev.udhar : 0;
      const total_diff = prev ? total - prev_total : total;

      return {
        ...entry,
        bank_diff,
        udhar_diff,
        total,
        total_diff
      };
    });

    // 2. Return sorted descending (newest first) for timeline display
    return calculated.sort((a, b) => 
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );
  }, [entries]);

  const addEntry = async (
    entry_date: string,
    bank_money: number,
    udhar: number,
    bank_change_reason?: string,
    udhar_change_reason?: string
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: 'No authenticated user found' };

    const { data, error } = await supabase
      .from('finance_logs')
      .upsert({
        user_id: userData.user.id,
        entry_date,
        bank_money,
        udhar,
        bank_change_reason: bank_change_reason || null,
        udhar_change_reason: udhar_change_reason || null
      }, {
        onConflict: 'user_id,entry_date'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving finance log:', error);
      return { error };
    }

    if (data) {
      const parsedEntry: FinanceEntry = {
        ...data,
        bank_money: parseFloat(data.bank_money || 0),
        udhar: parseFloat(data.udhar || 0)
      };

      setEntries((prev) => {
        // Remove existing entry if it's an update, then insert the new one and sort
        const filtered = prev.filter((item) => item.entry_date !== parsedEntry.entry_date);
        const updatedList = [parsedEntry, ...filtered];
        return updatedList.sort((a, b) => 
          new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        );
      });
    }

    return { success: true };
  };

  const deleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    const { error } = await supabase.from('finance_logs').delete().eq('id', id);
    if (error) {
      console.error('Error deleting finance log:', error);
      // Re-fetch to ensure local state matches server state if deletion fails
      fetchLogs();
    }
  };

  return {
    entries,
    calculatedEntries: getCalculatedEntries(),
    loading,
    addEntry,
    deleteEntry,
    refresh: fetchLogs
  };
}
