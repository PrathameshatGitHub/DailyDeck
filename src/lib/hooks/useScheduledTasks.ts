'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ScheduledTask = {
  id: string;
  title: string;
  scheduled_date: string;
  notes: string;
  type: string;
  status: 'pending' | 'done';
  created_at: string;
};

export function useScheduledTasks() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .order('scheduled_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (data) setTasks(data as ScheduledTask[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (title: string, scheduled_date: string, type: string, notes: string = '') => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('scheduled_tasks')
      .insert({ title, scheduled_date, type, notes, user_id: userData.user.id })
      .select()
      .single();

    if (data) {
      setTasks((prev) => [...prev, data as ScheduledTask]);
      return data as ScheduledTask;
    }
  };

  const updateTask = async (id: string, updates: Partial<ScheduledTask>) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );

    const { data } = await supabase
      .from('scheduled_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (data) {
      setTasks((prev) => prev.map((task) => (task.id === id ? (data as ScheduledTask) : task)));
    }
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('scheduled_tasks').delete().eq('id', id);
  };
  
  const toggleStatus = async (task: ScheduledTask) => {
    const newStatus = task.status === 'pending' ? 'done' : 'pending';
    await updateTask(task.id, { status: newStatus });
  };

  // Derive unique types from the current tasks
  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    tasks.forEach(t => {
      if (t.type) types.add(t.type);
    });
    return Array.from(types).sort();
  }, [tasks]);

  return { tasks, loading, uniqueTypes, addTask, updateTask, deleteTask, toggleStatus };
}
