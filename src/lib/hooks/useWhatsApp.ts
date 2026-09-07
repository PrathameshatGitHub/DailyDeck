'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type WhatsAppContact = {
  id: string;
  user_id: string;
  name: string | null;
  phone: string;
  company: string | null;
  message: string;
  batch_title: string | null;
  status: 'pending' | 'contacted';
  created_at: string;
};

export const DEFAULT_WHATSAPP_TEMPLATE = `Hi, I'm Prathamesh Mali, a Frontend Developer (React.js / Next.js) with 2 years of experience. I'm currently exploring new opportunities and wanted to check if there are any Frontend or Full Stack Developer openings with you.

Portfolio: https://profile-inky-iota.vercel.app/
Happy to share my resume if it's relevant.

Thank you!
Prathamesh Mali
7620537089
maliprathamesh3162@gmail.com`;

// Format phone number to clean international digits (defaulting 10 digits to 91 Indian prefix)
export function cleanPhoneNumber(raw: string): string {
  let cleaned = raw.replace(/\D/g, ''); // strip all non-digits
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = `91${cleaned.slice(1)}`;
  }
  return cleaned;
}

// Build direct wa.me link
export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message.trim());
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export function useWhatsApp() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<string>(DEFAULT_WHATSAPP_TEMPLATE);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load template from local cache first, then sync from Supabase
  useEffect(() => {
    try {
      const cached = localStorage.getItem('dailydeck_whatsapp_template');
      if (cached) setTemplate(cached);
    } catch {}
  }, []);

  const fetchTemplate = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .select('template')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!error && data?.template) {
        setTemplate(data.template);
        try {
          localStorage.setItem('dailydeck_whatsapp_template', data.template);
        } catch {}
      }
    } catch (err) {
      console.warn('Could not fetch whatsapp template from Supabase:', err);
    }
  }, [supabase]);

  const saveTemplate = async (newTemplate: string): Promise<boolean> => {
    const trimmed = newTemplate.trim();
    if (!trimmed) return false;

    setSavingTemplate(true);
    setTemplate(trimmed);
    try {
      localStorage.setItem('dailydeck_whatsapp_template', trimmed);
    } catch {}

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { error } = await supabase
          .from('user_whatsapp_config')
          .upsert(
            {
              user_id: userData.user.id,
              template: trimmed,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (error) {
          console.error('Error saving whatsapp template to Supabase:', error);
        }
      }
    } catch (err) {
      console.error('Exception saving whatsapp template:', err);
    }

    setSavingTemplate(false);
    return true;
  };

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContacts(data as WhatsAppContact[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchContacts();
    fetchTemplate();
  }, [fetchContacts, fetchTemplate]);

  const addContact = async (fields: {
    name?: string;
    phone: string;
    company?: string;
    message?: string;
    batch_title?: string;
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const cleanedPhone = cleanPhoneNumber(fields.phone);
    const finalMessage = fields.message || template || DEFAULT_WHATSAPP_TEMPLATE;

    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .insert({
        user_id: userData.user.id,
        name: fields.name || null,
        phone: cleanedPhone,
        company: fields.company || null,
        message: finalMessage,
        batch_title: fields.batch_title || null,
        status: 'pending',
      })
      .select()
      .single();

    if (!error && data) {
      setContacts((prev) => [data as WhatsAppContact, ...prev]);
      return data as WhatsAppContact;
    }
    return null;
  };

  const addBatchContacts = async (
    items: Array<{ name?: string; phone: string; company?: string; message?: string }>,
    batchTitle: string
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || items.length === 0) return false;

    const payload = items.map((item) => ({
      user_id: userData.user.id,
      name: item.name || null,
      phone: cleanPhoneNumber(item.phone),
      company: item.company || null,
      message: item.message || template || DEFAULT_WHATSAPP_TEMPLATE,
      batch_title: batchTitle,
      status: 'pending' as const,
    }));

    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .insert(payload)
      .select();

    if (!error && data) {
      setContacts((prev) => [...(data as WhatsAppContact[]), ...prev]);
      return true;
    }
    return false;
  };

  const toggleStatus = async (id: string) => {
    const current = contacts.find((c) => c.id === id);
    if (!current) return;
    const newStatus = current.status === 'pending' ? 'contacted' : 'pending';

    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );

    await supabase
      .from('whatsapp_contacts')
      .update({ status: newStatus })
      .eq('id', id);
  };

  const markContacted = async (id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'contacted' } : c))
    );

    await supabase
      .from('whatsapp_contacts')
      .update({ status: 'contacted' })
      .eq('id', id);
  };

  const updateContact = async (id: string, updates: Partial<WhatsAppContact>) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );

    await supabase
      .from('whatsapp_contacts')
      .update(updates)
      .eq('id', id);
  };

  const deleteContact = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('whatsapp_contacts').delete().eq('id', id);
  };

  const deleteContacts = async (ids: string[]) => {
    if (ids.length === 0) return;
    setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
    await supabase.from('whatsapp_contacts').delete().in('id', ids);
  };

  const updateContactsStatus = async (ids: string[], status: 'pending' | 'contacted') => {
    if (ids.length === 0) return;
    setContacts((prev) =>
      prev.map((c) => (ids.includes(c.id) ? { ...c, status } : c))
    );
    await supabase.from('whatsapp_contacts').update({ status }).in('id', ids);
  };

  const deleteBatch = async (batchTitle: string) => {
    setContacts((prev) => prev.filter((c) => c.batch_title !== batchTitle));
    await supabase.from('whatsapp_contacts').delete().eq('batch_title', batchTitle);
  };

  const stats = {
    total: contacts.length,
    pending: contacts.filter((c) => c.status === 'pending').length,
    contacted: contacts.filter((c) => c.status === 'contacted').length,
  };

  // Group unique batches
  const batches = Array.from(
    new Set(contacts.map((c) => c.batch_title).filter(Boolean) as string[])
  );

  return {
    contacts,
    loading,
    template,
    savingTemplate,
    saveTemplate,
    stats,
    batches,
    addContact,
    addBatchContacts,
    toggleStatus,
    markContacted,
    updateContact,
    deleteContact,
    deleteContacts,
    updateContactsStatus,
    deleteBatch,
    fetchContacts,
  };
}
