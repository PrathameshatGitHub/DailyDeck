'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type EmailPreferences = {
  full_name: string;
  your_email: string;
  phone: string;
  portfolio_url: string;
  linkedin_url: string;
  your_role: string;
  experience: string;
  key_skills: string;
  example_subject: string;
  example_body: string;
};

export const DEFAULT_PREFERENCES: EmailPreferences = {
  full_name: '',
  your_email: '',
  phone: '',
  portfolio_url: '',
  linkedin_url: '',
  your_role: '',
  experience: '',
  key_skills: '',
  example_subject: '',
  example_body: '',
};

const LOCAL_KEY = 'dailydeck_ai_email_prefs';

export function useEmailPreferences() {
  const supabase = createClient();
  const [preferences, setPreferences] = useState<EmailPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const local = localStorage.getItem(LOCAL_KEY);
      if (local) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(local) });
      }
    } catch {}
  }, []);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('ai_email_preferences')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!error && data) {
        const prefs: EmailPreferences = {
          full_name: data.full_name || '',
          your_email: data.your_email || '',
          phone: data.phone || '',
          portfolio_url: data.portfolio_url || '',
          linkedin_url: data.linkedin_url || '',
          your_role: data.your_role || '',
          experience: data.experience || '',
          key_skills: data.key_skills || '',
          example_subject: data.example_subject || '',
          example_body: data.example_body || '',
        };
        setPreferences(prefs);
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs)); } catch {}
      }
    } catch (err) {
      console.warn('Could not fetch ai_email_preferences:', err);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async (prefs: EmailPreferences): Promise<boolean> => {
    setSaving(true);
    setPreferences(prefs);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs)); } catch {}

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setSaving(false);
        return false;
      }

      const payload = {
        user_id: userData.user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('ai_email_preferences')
        .upsert(payload, { onConflict: 'user_id' });

      setSaving(false);
      return !error;
    } catch (err) {
      console.error('Failed to save ai_email_preferences:', err);
      setSaving(false);
      return false;
    }
  };

  const hasPreferences =
    !!preferences.full_name.trim() ||
    !!preferences.your_email.trim() ||
    !!preferences.example_body.trim();

  return { preferences, loading, saving, savePreferences, hasPreferences, refetch: fetchPreferences };
}