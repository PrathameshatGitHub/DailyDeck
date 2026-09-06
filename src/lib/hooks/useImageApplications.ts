'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ImageApplication = {
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
  source_image?: string | null; // URL or base64 of the source image
};

export function useImageApplications() {
  const supabase = createClient();
  const [applications, setApplications] = useState<ImageApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const local = localStorage.getItem('dailydeck_image_apps');
      if (local) {
        setApplications(JSON.parse(local));
      }
    } catch {}
  }, []);

  const saveToLocal = (items: ImageApplication[]) => {
    try {
      localStorage.setItem('dailydeck_image_apps', JSON.stringify(items));
    } catch {}
  };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('image_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setApplications(data as ImageApplication[]);
        saveToLocal(data as ImageApplication[]);
      }
    } catch (err) {
      console.warn('Could not fetch image_applications from database, using cached:', err);
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
      source_image?: string;
    }>
  ) => {
    if (!items || items.length === 0) return [];

    const now = new Date().toISOString();
    
    // Create local optimistic items with unique IDs
    const optimisticItems: ImageApplication[] = items.map((it, idx) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `img_${Date.now()}_${idx}`,
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
      source_image: it.source_image || null,
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
          source_image: it.source_image || null,
        }));

        const { data: dbData, error } = await supabase
          .from('image_applications')
          .insert(payload)
          .select();

        if (!error && dbData && dbData.length > 0) {
          // Replace optimistic items with real DB rows
          setApplications((prev) => {
            const remaining = prev.filter((p) => !optimisticItems.some((o) => o.id === p.id));
            const next = [...(dbData as ImageApplication[]), ...remaining];
            saveToLocal(next);
            return next;
          });
          return dbData as ImageApplication[];
        } else if (error) {
          console.error('Supabase insert image_applications error:', error.message, error.details);
        }
      }
    } catch (e) {
      console.error('Supabase image_applications sync error:', e);
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
        .from('image_applications')
        .update({ status: newStatus })
        .eq('id', id);
    } catch {}
  };

  const updateApplication = async (id: string, updates: Partial<ImageApplication>) => {
    setApplications((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
      saveToLocal(next);
      return next;
    });

    try {
      await supabase
        .from('image_applications')
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
      await supabase.from('image_applications').delete().eq('id', id);
    } catch {}
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
  };
}