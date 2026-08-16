'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Task = {
  id: string;
  title: string;
  status: 'pending' | 'complete';
  is_recurring: boolean;
  last_reset_date: string;
  streak_count: number;
  created_at: string;
};

export function useTasks() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // auto-reset recurring tasks whose last_reset_date is not today
      const toReset = data.filter(
        (t) => t.is_recurring && t.last_reset_date !== today
      );

      if (toReset.length > 0) {
        await Promise.all(
          toReset.map((t) => {
            // If it was left pending, streak breaks (goes to 0). If complete, streak is preserved.
            const newStreak = t.status === 'complete' ? t.streak_count : 0;
            return supabase
              .from('tasks')
              .update({ status: 'pending', last_reset_date: today, streak_count: newStreak })
              .eq('id', t.id);
          })
        );

        data.forEach((t) => {
          if (t.is_recurring && t.last_reset_date !== today) {
            t.streak_count = t.status === 'complete' ? t.streak_count : 0;
            t.status = 'pending';
            t.last_reset_date = today;
          }
        });
      }

      setTasks(data as Task[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (title: string, is_recurring: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('tasks')
      .insert({
        title,
        is_recurring,
        user_id: userData.user.id,
        streak_count: 0,
        last_reset_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (data) setTasks((prev) => [data as Task, ...prev]);
  };

  const toggleStatus = async (task: Task) => {
    const isNowComplete = task.status === 'pending';
    const newStatus = isNowComplete ? 'complete' : 'pending';
    
    // Streak calculations:
    let newStreak = task.streak_count;
    if (task.is_recurring) {
      if (isNowComplete) {
        newStreak = task.streak_count + 1;
      } else {
        newStreak = Math.max(0, task.streak_count - 1);
      }
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, streak_count: newStreak } : t))
    );

    await supabase
      .from('tasks')
      .update({ status: newStatus, streak_count: newStreak })
      .eq('id', task.id);
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  return { tasks, loading, addTask, toggleStatus, deleteTask };
}
