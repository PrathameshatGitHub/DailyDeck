'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

interface CampaignContextType {
  activeCampaignId: string | null;
  isRelayActive:    boolean;
  status:           CampaignStatus;
  lastEmailSent:    string;
  relayError:       string | null;
  allRecipients:    RecipientCard[];       // unified list with status per card
  attachments:      Attachment[];
  setAttachments:   React.Dispatch<React.SetStateAction<Attachment[]>>;
  sendingSpeed:     'slow' | 'medium' | 'fast';
  setSendingSpeed:  React.Dispatch<React.SetStateAction<'slow' | 'medium' | 'fast'>>;
  startCampaign:    (
    subject:    string,
    body:       string,
    recipients: string | RecipientCard[], // string = paste mode, array = CSV mode
    replyTo:    string
  ) => Promise<boolean>;
  toggleRelay:   (active: boolean) => void;
  resetCampaign: () => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isRelayActive,    setIsRelayActive]    = useState(false);
  const [lastEmailSent,    setLastEmailSent]    = useState<string>('');
  const [relayError,       setRelayError]       = useState<string | null>(null);
  const [attachments,      setAttachments]      = useState<Attachment[]>([]);
  const [allRecipients,    setAllRecipients]    = useState<RecipientCard[]>([]);
  const [sendingSpeed,    setSendingSpeed]    = useState<'slow' | 'medium' | 'fast'>('medium');

  const [status, setStatus] = useState<CampaignStatus>({
    total: 0, pending: 0, sent: 0, failed: 0, campaign_status: '',
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef  = useRef<NodeJS.Timeout | null>(null);

  // ── 1. Initial Load from LocalStorage ─────────────────────────────────────
  useEffect(() => {
    const savedId          = localStorage.getItem('activeCampaignId');
    const savedRelayActive = localStorage.getItem('isRelayActive');
    const savedSpeed       = localStorage.getItem('sendingSpeed') as 'slow' | 'medium' | 'fast' | null;
    if (savedId)                     setActiveCampaignId(savedId);
    if (savedRelayActive === 'true') setIsRelayActive(true);
    if (savedSpeed)                  setSendingSpeed(savedSpeed);
  }, []);

  // ── 2. Persist state to LocalStorage ──────────────────────────────────────
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

  useEffect(() => {
    localStorage.setItem('sendingSpeed', sendingSpeed);
  }, [sendingSpeed]);

  // ── 3. Status Polling (updates recipient card statuses) ───────────────────
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

        // Build unified recipient card list: sent first, then pending, then failed
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

  // ── 4. Relay Loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRelayActive || !activeCampaignId) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const sendNext = async () => {
      try {
        const smtpEmail      = localStorage.getItem('smtpEmail')      || '';
        const smtpPassword   = localStorage.getItem('smtpPassword')   || '';
        const smtpSenderName = localStorage.getItem('smtpSenderName') || smtpEmail;

        if (!smtpEmail || !smtpPassword) {
          setRelayError('SMTP credentials missing. Please configure them in Campaign Settings.');
          setIsRelayActive(false);
          return;
        }

        // Calculate delay based on sending speed
        const delayMap = { slow: 10000, medium: 5000, fast: 2000 };
        const delay_ms = delayMap[sendingSpeed];

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/campaigns/send-next', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body:    JSON.stringify({
            campaign_id:      activeCampaignId,
            smtp_user:        smtpEmail,
            smtp_pass:        smtpPassword,
            smtp_sender_name: smtpSenderName,
            attachments,
            delay_ms,
          })
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

        // Use a ref check so we don't read stale closure value
        timerRef.current = setTimeout(sendNext, delay_ms);
      } catch (error) {
        console.error('Relay error:', error);
        timerRef.current = setTimeout(sendNext, 10000);
      }
    };

    sendNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isRelayActive, activeCampaignId, attachments, sendingSpeed, supabase]);

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
        body:    JSON.stringify({
          subject,
          content:    body,
          recipients, // string → legacy, array → CSV personalized
          user_id:    user.id,
          reply_to:   replyTo,
        })
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
