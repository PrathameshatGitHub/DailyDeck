'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type TaskLog = {
  id: string;
  type: string;
  note: string | null;
  log_date: string;
  status: 'pending' | 'complete';
  created_at: string;
};

export function useTaskLogs() {
  const supabase = createClient();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_logs')
      .select('*')
      .order('log_date', { ascending: false });

    if (data) setLogs(data as TaskLog[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const addLog = async (type: string, note: string, log_date: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('task_logs')
      .insert({ type, note, log_date, user_id: userData.user.id })
      .select()
      .single();

    if (data) setLogs((prev) => [data as TaskLog, ...prev]);
  };

  const toggleStatus = async (log: TaskLog) => {
    const newStatus = log.status === 'pending' ? 'complete' : 'pending';
    setLogs((prev) =>
      prev.map((l) => (l.id === log.id ? { ...l, status: newStatus } : l))
    );
    await supabase.from('task_logs').update({ status: newStatus }).eq('id', log.id);
  };

  const deleteLog = async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await supabase.from('task_logs').delete().eq('id', id);
  };

  return { logs, loading, addLog, toggleStatus, deleteLog };
}
