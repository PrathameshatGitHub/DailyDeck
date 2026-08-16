'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RecipientCard } from '@/components/RecipientCard';

interface CampaignStatus {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  campaign_status: string;
  subject?: string;
}

interface Attachment {
  filename:    string;
  content:     string;
  contentType: string;
}

export interface SmtpConfig {
  smtp_email:        string;
  smtp_password:     string;
  smtp_sender_name:  string;
  sending_speed:     'slow' | 'medium' | 'fast';
  campaign_subject:  string;
  campaign_body:     string;
}

interface CampaignContextType {
  activeCampaignId: string | null;
  isRelayActive:    boolean;
  status:           CampaignStatus;
  lastEmailSent:    string;
  relayError:       string | null;
  allRecipients:    RecipientCard[];
  attachments:      Attachment[];
  setAttachments:   React.Dispatch<React.SetStateAction<Attachment[]>>;
  sendingSpeed:     'slow' | 'medium' | 'fast';
  setSendingSpeed:  React.Dispatch<React.SetStateAction<'slow' | 'medium' | 'fast'>>;
  // Config stored in DB
  smtpConfig:       SmtpConfig;
  configLoading:    boolean;
  saveSmtpConfig:   (config: Partial<SmtpConfig>) => Promise<{ success: boolean; error?: string }>;
  startCampaign:    (
    subject:    string,
    body:       string,
    recipients: string | RecipientCard[],
    replyTo:    string
  ) => Promise<boolean>;
  toggleRelay:   (active: boolean) => void;
  resetCampaign: () => void;
}

const defaultConfig: SmtpConfig = {
  smtp_email:        '',
  smtp_password:     '',
  smtp_sender_name:  '',
  sending_speed:     'medium',
  campaign_subject:  '',
  campaign_body:     '',
};

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isRelayActive,    setIsRelayActive]    = useState(false);
  const [lastEmailSent,    setLastEmailSent]    = useState<string>('');
  const [relayError,       setRelayError]       = useState<string | null>(null);
  const [attachments,      setAttachments]      = useState<Attachment[]>([]);
  const [allRecipients,    setAllRecipients]    = useState<RecipientCard[]>([]);
  const [sendingSpeed,     setSendingSpeed]     = useState<'slow' | 'medium' | 'fast'>('medium');

  // DB-backed SMTP config
  const [smtpConfig,    setSmtpConfig]    = useState<SmtpConfig>(defaultConfig);
  const [configLoading, setConfigLoading] = useState(true);

  const [status, setStatus] = useState<CampaignStatus>({
    total: 0, pending: 0, sent: 0, failed: 0, campaign_status: '',
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef  = useRef<NodeJS.Timeout | null>(null);

  // ── 1. Load config from DB on mount ──────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setConfigLoading(false); return; }

      const res = await fetch('/api/config', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (data.config) {
        const cfg = data.config as SmtpConfig;
        setSmtpConfig({
          smtp_email:       cfg.smtp_email       || '',
          smtp_password:    cfg.smtp_password    || '',
          smtp_sender_name: cfg.smtp_sender_name || '',
          sending_speed:    cfg.sending_speed    || 'medium',
          campaign_subject: cfg.campaign_subject || '',
          campaign_body:    cfg.campaign_body    || '',
        });
        setSendingSpeed(cfg.sending_speed || 'medium');
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
    setConfigLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── 2. Persist activeCampaignId / relay state in localStorage (session-level only) ──
  useEffect(() => {
    const savedId          = localStorage.getItem('activeCampaignId');
    const savedRelayActive = localStorage.getItem('isRelayActive');
    if (savedId)                     setActiveCampaignId(savedId);
    if (savedRelayActive === 'true') setIsRelayActive(true);
  }, []);

  useEffect(() => {
    if (activeCampaignId) {
      localStorage.setItem('activeCampaignId', activeCampaignId);
    } else {
      localStorage.removeItem('activeCampaignId');
    }
  }, [activeCampaignId]);

  useEffect(() => {
    localStorage.setItem('isRelayActive', String(isRelayActive));
  }, [isRelayActive]);

  // ── 3. saveSmtpConfig — explicit save to DB ───────────────────────────────
  const saveSmtpConfig = useCallback(async (partial: Partial<SmtpConfig>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'Not authenticated' };

      const merged: SmtpConfig = { ...smtpConfig, ...partial };
      setSmtpConfig(merged);
      if (partial.sending_speed) setSendingSpeed(partial.sending_speed);

      const res = await fetch('/api/config', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          smtp_email:       merged.smtp_email,
          smtp_password:    merged.smtp_password,
          smtp_sender_name: merged.smtp_sender_name,
          sending_speed:    merged.sending_speed,
          campaign_subject: merged.campaign_subject,
          campaign_body:    merged.campaign_body,
        }),
      });

      const data = await res.json();
      if (!data.success) return { success: false, error: data.error };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [smtpConfig, supabase]);

  // ── 4. Status Polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCampaignId) return;

    const fetchStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res  = await fetch(`/api/campaigns/status?campaign_id=${activeCampaignId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (data.error) return;

        setStatus({
          total:           data.total,
          pending:         data.pending,
          sent:            data.sent,
          failed:          data.failed,
          campaign_status: data.campaign_status,
          subject:         data.subject,
        });

        const combined: RecipientCard[] = [
          ...(data.sent_recipients    || []).map((r: any) => ({ ...r, status: 'sent'    as const })),
          ...(data.pending_recipients || []).map((r: any) => ({ ...r, status: 'pending' as const })),
          ...(data.failed_recipients  || []).map((r: any) => ({ ...r, status: 'failed'  as const })),
        ];
        setAllRecipients(combined);

        if (data.campaign_status === 'completed') {
          setIsRelayActive(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeCampaignId, supabase]);

  // ── 5. Relay Loop — reads from smtpConfig (DB-backed) ────────────────────
  useEffect(() => {
    if (!isRelayActive || !activeCampaignId) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const sendNext = async () => {
      try {
        const { smtp_email, smtp_password, smtp_sender_name } = smtpConfig;

        if (!smtp_email || !smtp_password) {
          setRelayError('SMTP credentials missing. Please configure them in Campaign Settings and save.');
          setIsRelayActive(false);
          return;
        }

        const delayMap = { slow: 10000, medium: 5000, fast: 2000 };
        const delay_ms = delayMap[sendingSpeed];

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/campaigns/send-next', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            campaign_id:      activeCampaignId,
            smtp_user:        smtp_email,
            smtp_pass:        smtp_password,
            smtp_sender_name: smtp_sender_name || smtp_email,
            attachments,
            delay_ms,
          }),
        });

        const data = await res.json();

        if (data.status === 'smtp_error' || data.error) {
          setRelayError(data.error || 'SMTP or server error occurred.');
          setIsRelayActive(false);
          return;
        }
        if (data.status === 'completed') {
          setIsRelayActive(false);
          return;
        }
        if (data.status === 'sent_one') {
          setLastEmailSent(data.processed_email);
          setRelayError(null);
        }

        timerRef.current = setTimeout(sendNext, delay_ms);
      } catch (error) {
        console.error('Relay error:', error);
        timerRef.current = setTimeout(sendNext, 10000);
      }
    };

    sendNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isRelayActive, activeCampaignId, attachments, sendingSpeed, smtpConfig, supabase]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startCampaign = async (
    subject:    string,
    body:       string,
    recipients: string | RecipientCard[],
    replyTo:    string
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user }   } = await supabase.auth.getUser();
      if (!user) return false;

      const res = await fetch('/api/campaigns/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ subject, content: body, recipients, user_id: user.id, reply_to: replyTo }),
      });

      const data = await res.json();
      if (data.success) {
        setRelayError(null);
        setLastEmailSent('');
        setAllRecipients([]);
        setActiveCampaignId(data.campaign_id);
        setIsRelayActive(true);
        return true;
      }
      alert(data.error || 'Failed to create campaign');
      return false;
    } catch (err) {
      console.error(err);
      alert('Network error while creating campaign');
      return false;
    }
  };

  const toggleRelay = (active: boolean) => setIsRelayActive(active);

  const resetCampaign = () => {
    setActiveCampaignId(null);
    setIsRelayActive(false);
    setStatus({ total: 0, pending: 0, sent: 0, failed: 0, campaign_status: '' });
    setAllRecipients([]);
    setLastEmailSent('');
    setRelayError(null);
    setAttachments([]);
    localStorage.removeItem('activeCampaignId');
    localStorage.setItem('isRelayActive', 'false');
  };

  return (
    <CampaignContext.Provider
      value={{
        activeCampaignId,
        isRelayActive,
        status,
        lastEmailSent,
        relayError,
        allRecipients,
        attachments,
        setAttachments,
        sendingSpeed,
        setSendingSpeed,
        smtpConfig,
        configLoading,
        saveSmtpConfig,
        startCampaign,
        toggleRelay,
        resetCampaign,
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (context === undefined) throw new Error('useCampaign must be used within a CampaignProvider');
  return context;
}
