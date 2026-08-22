'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type JobApplication = {
  id: string;
  user_id?: string;
  recruiter_name?: string | null;
  company?: string | null;
  role?: string | null;
  location?: string | null;
  experience?: string | null;
  skills?: string[] | null;
  to_email: string;
  phone?: string | null;
  subject: string;
  body: string;
  status: 'pending' | 'completed';
  created_at: string;
};

export function useJobApplications() {
  const supabase = createClient();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const local = localStorage.getItem('dailydeck_job_apps');
      if (local) {
        setApplications(JSON.parse(local));
      }
    } catch {}
  }, []);

  const saveToLocal = (items: JobApplication[]) => {
    try {
      localStorage.setItem('dailydeck_job_apps', JSON.stringify(items));
    } catch {}
  };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setApplications(data as JobApplication[]);
        saveToLocal(data as JobApplication[]);
      }
    } catch (err) {
      console.warn('Could not fetch job_applications from database, using cached:', err);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const addBatchApplications = async (
    items: Array<{
      recruiter_name?: string;
      company?: string;
      role?: string;
      location?: string;
      experience?: string;
      skills?: string[];
      to_email: string;
      phone?: string;
      subject: string;
      body: string;
    }>
  ) => {
    if (!items || items.length === 0) return [];

    const now = new Date().toISOString();
    
    // Create local optimistic items with unique IDs
    const optimisticItems: JobApplication[] = items.map((it, idx) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `app_${Date.now()}_${idx}`,
      recruiter_name: it.recruiter_name || null,
      company: it.company || null,
      role: it.role || null,
      location: it.location || null,
      experience: it.experience || null,
      skills: it.skills || [],
      to_email: it.to_email,
      phone: it.phone || null,
      subject: it.subject,
      body: it.body,
      status: 'pending' as const,
      created_at: now,
    }));

    // Instantly put at the very top of local state!
    setApplications((prev) => {
      const next = [...optimisticItems, ...prev];
      saveToLocal(next);
      return next;
    });

    // Try inserting into Supabase without custom string ID
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const payload = items.map((it) => ({
          user_id: userData.user.id,
          recruiter_name: it.recruiter_name || null,
          company: it.company || null,
          role: it.role || null,
          location: it.location || null,
          experience: it.experience || null,
          skills: it.skills || [],
          to_email: it.to_email,
          phone: it.phone || null,
          subject: it.subject,
          body: it.body,
          status: 'pending' as const,
          created_at: now,
        }));

        const { data: dbData, error } = await supabase
          .from('job_applications')
          .insert(payload)
          .select();

        if (!error && dbData && dbData.length > 0) {
          // Replace optimistic items with real DB rows
          setApplications((prev) => {
            const remaining = prev.filter((p) => !optimisticItems.some((o) => o.id === p.id));
            const next = [...(dbData as JobApplication[]), ...remaining];
            saveToLocal(next);
            return next;
          });
          return dbData as JobApplication[];
        } else if (error) {
          console.error('Supabase insert job_applications error:', error.message, error.details);
        }
      }
    } catch (e) {
      console.error('Supabase job_applications sync error:', e);
    }

    return optimisticItems;
  };

  const toggleStatus = async (id: string) => {
    const current = applications.find((a) => a.id === id);
    if (!current) return;
    const newStatus: 'pending' | 'completed' = current.status === 'pending' ? 'completed' : 'pending';

    setApplications((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a));
      saveToLocal(next);
      return next;
    });

    try {
      await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', id);
    } catch {}
  };

  const updateApplication = async (id: string, updates: Partial<JobApplication>) => {
    setApplications((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
      saveToLocal(next);
      return next;
    });

    try {
      await supabase
        .from('job_applications')
        .update(updates)
        .eq('id', id);
    } catch {}
  };

  const deleteApplication = async (id: string) => {
    setApplications((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveToLocal(next);
      return next;
    });

    try {
      await supabase.from('job_applications').delete().eq('id', id);
    } catch {}
  };

  const shareApplication = async (cardId: string, passcode: string): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;

      // Generate a short readable random key
      const randHex = Math.random().toString(36).substring(2, 8);
      const shareKey = `app-${randHex}`;

      const { error } = await supabase
        .from('job_shares')
        .insert({
          owner_id: userData.user.id,
          card_id: cardId,
          share_key: shareKey,
          passcode: passcode,
        });

      if (error) {
        console.error('Failed to create job share:', error.message);
        return null;
      }
      return shareKey;
    } catch (err) {
      console.error('Share application error:', err);
      return null;
    }
  };

  const importApplication = async (shareKey: string, passcode: string): Promise<boolean> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return false;

      const { data, error } = await supabase.rpc('import_shared_card', {
        p_share_key: shareKey.trim(),
        p_passcode: passcode.trim(),
        p_importer_id: userData.user.id,
      });

      if (error || !data) {
        console.error('Failed to import shared card:', error?.message);
        return false;
      }

      // Refresh applications from database
      await fetchApplications();
      return true;
    } catch (err) {
      console.error('Import application error:', err);
      return false;
    }
  };

  // Sort applications: Pending on top (0), Completed at bottom (1), then newest first
  const sortedApplications = [...applications].sort((a, b) => {
    const aOrder = a.status === 'pending' ? 0 : 1;
    const bOrder = b.status === 'pending' ? 0 : 1;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    completed: applications.filter((a) => a.status === 'completed').length,
  };

  return {
    applications: sortedApplications,
    rawApplications: applications,
    loading,
    stats,
    addBatchApplications,
    toggleStatus,
    updateApplication,
    deleteApplication,
    fetchApplications,
    shareApplication,
    importApplication,
  };
}
