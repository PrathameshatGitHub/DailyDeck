'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Send, Play, Pause, AlertCircle, CheckCircle2, Lock, KeyRound,
  Upload, FileSpreadsheet, X, Copy, Users, Info, Save, Check,
} from 'lucide-react';
import { useCampaign }                     from '@/lib/context/CampaignContext';
import { RecipientCardItem, type RecipientCard } from '@/components/RecipientCard';

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser (client-side, no library)
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text: string): RecipientCard[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const emailIdx = headers.findIndex(h =>
    ['email', 'email address', 'emailaddress', 'e-mail'].includes(h)
  );
  const nameIdx = headers.findIndex(h =>
    ['name', 'first name', 'firstname', 'first_name', 'full name', 'fullname', 'full_name'].includes(h)
  );
  const companyIdx = headers.findIndex(h =>
    ['company', 'company name', 'companyname', 'company_name', 'organization', 'org'].includes(h)
  );

  if (emailIdx === -1) return [];

  const results: RecipientCard[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx]?.trim();
    if (!email || !email.includes('@')) continue;

    results.push({
      email,
      name:    nameIdx    >= 0 ? (cols[nameIdx]?.trim()    || undefined) : undefined,
      company: companyIdx >= 0 ? (cols[companyIdx]?.trim() || undefined) : undefined,
      status: 'pending',
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  // SMTP — local draft state seeded from DB config
  const [smtpEmail,        setSmtpEmail]        = useState('');
  const [smtpPassword,     setSmtpPassword]     = useState('');
  const [smtpSenderName,   setSmtpSenderName]   = useState('');
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [configSaving,     setConfigSaving]     = useState(false);
  const [configSaved,      setConfigSaved]      = useState(false);
  const [configError,      setConfigError]      = useState<string | null>(null);
  const [draftSpeed,       setDraftSpeed]       = useState<'slow' | 'medium' | 'fast'>('medium');

  // Form
  const [subject,          setSubject]          = useState('');
  const [body,             setBody]             = useState('');
  const [creating,         setCreating]         = useState(false);

  // Recipient mode
  const [importMode,         setImportMode]         = useState<'paste' | 'csv'>('paste');
  const [pasteRecipients,    setPasteRecipients]    = useState('');
  const [importedRecipients, setImportedRecipients] = useState<RecipientCard[]>([]);
  const [csvInfo,            setCsvInfo]            = useState<{ count: number; hasName: boolean; hasCompany: boolean } | null>(null);
  const [csvError,           setCsvError]           = useState<string | null>(null);
  const [isDragging,         setIsDragging]         = useState(false);
  const [isReadingFile,      setIsReadingFile]      = useState(false);

  // Dashboard tabs
  const [activeTab,     setActiveTab]     = useState<'dashboard' | 'history' | 'reputation'>('dashboard');
  const [history,       setHistory]       = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reputation,    setReputation]   = useState<any>(null);
  const [reputationLoading, setReputationLoading] = useState(false);

  const {
    activeCampaignId, isRelayActive, status, lastEmailSent, relayError,
    allRecipients, attachments, setAttachments, sendingSpeed, setSendingSpeed,
    smtpConfig, configLoading, saveSmtpConfig,
    startCampaign, toggleRelay, resetCampaign,
  } = useCampaign();

  // ── Seed local draft state from DB config once loaded ────────────────────
  useEffect(() => {
    if (configLoading) return;
    setSmtpEmail(smtpConfig.smtp_email || '');
    setSmtpPassword(smtpConfig.smtp_password || '');
    setSmtpSenderName(smtpConfig.smtp_sender_name || '');
    setDraftSpeed(smtpConfig.sending_speed || 'medium');
    if (smtpConfig.campaign_subject) setSubject(smtpConfig.campaign_subject);
    if (smtpConfig.campaign_body)    setBody(smtpConfig.campaign_body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading]);

  // ── Save Configuration to DB ─────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigError(null);
    const result = await saveSmtpConfig({
      smtp_email:       smtpEmail,
      smtp_password:    smtpPassword,
      smtp_sender_name: smtpSenderName,
      sending_speed:    draftSpeed,
      campaign_subject: subject,
      campaign_body:    body,
    });
    setConfigSaving(false);
    if (result.success) {
      setSendingSpeed(draftSpeed);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } else {
      setConfigError(result.error || 'Failed to save configuration.');
    }
  };

  // ── History fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'history') return;
    const fetch = async () => {
      setHistoryLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res  = await window.fetch('/api/campaigns/history', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (data.history) setHistory(data.history);
      } catch (e) { console.error(e); }
      finally { setHistoryLoading(false); }
    };
    fetch();
  }, [activeTab, supabase]);

  // ── Reputation fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'reputation' || !activeCampaignId) return;
    const fetch = async () => {
      setReputationLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res  = await window.fetch(`/api/campaigns/reputation?campaign_id=${activeCampaignId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (data.reputation) setReputation(data);
      } catch (e) { console.error(e); }
      finally { setReputationLoading(false); }
    };
    fetch();
  }, [activeTab, activeCampaignId, supabase]);

  // ── CSV handling ──────────────────────────────────────────────────────────
  const handleCSVText = useCallback((text: string) => {
    setCsvError(null);
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      setCsvError('No valid emails found. Make sure your CSV has an "email" column header.');
      setImportedRecipients([]);
      setCsvInfo(null);
      return;
    }
    setImportedRecipients(parsed);
    setCsvInfo({
      count:      parsed.length,
      hasName:    parsed.some(r => !!r.name),
      hasCompany: parsed.some(r => !!r.company),
    });
  }, []);

  const handleCSVFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Please upload a .csv file.');
      return;
    }
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload  = (e) => { handleCSVText(e.target?.result as string); setIsReadingFile(false); };
    reader.onerror = () => { setCsvError('Failed to read file.'); setIsReadingFile(false); };
    reader.readAsText(file);
  }, [handleCSVText]);

  const clearCSV = () => {
    setImportedRecipients([]);
    setCsvInfo(null);
    setCsvError(null);
  };

  // ── Create campaign ───────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim() || !user) return;

    if (!smtpEmail || !smtpPassword) {
      alert('Please configure your Gmail SMTP settings first.');
      setShowSmtpSettings(true);
      return;
    }

    if (importMode === 'csv' && importedRecipients.length === 0) {
      alert('Please import a CSV file with at least one valid email address.');
      return;
    }
    if (importMode === 'paste' && !pasteRecipients.trim()) return;

    const recipients: string | RecipientCard[] =
      importMode === 'csv' ? importedRecipients : pasteRecipients;

    setCreating(true);
    await startCampaign(subject, body, recipients, smtpEmail);
    setCreating(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const percentComplete  = status.total > 0
    ? Math.round(((status.sent + status.failed) / status.total) * 100)
    : 0;
  const isSmtpConfigured = smtpEmail.length > 0 && smtpPassword.length > 0;

  const sentCards    = allRecipients.filter(r => r.status === 'sent');
  const pendingCards = allRecipients.filter(r => r.status === 'pending');
  const failedCards  = allRecipients.filter(r => r.status === 'failed');

  // Detect which campaign type based on imported data
  const campaignType = !csvInfo ? 1
    : csvInfo.hasCompany ? 3
    : csvInfo.hasName    ? 2
    : 1;

  // ── Attachment handler ────────────────────────────────────────────────────
  const handleAttachmentFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { alert('File size exceeds 10MB limit.'); return; }
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64Data = result.split(',')[1];
      setAttachments(prev => [...prev, { filename: file.name, content: base64Data, contentType: file.type || 'application/octet-stream' }]);
      setIsReadingFile(false);
    };
    reader.onerror = () => { alert('Failed to read file.'); setIsReadingFile(false); };
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans relative">

      {/* Dev Stats Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-[#89295E] font-bold">&gt;</span>
          <span>bulk_mail_relay:</span>
          <span className="text-zinc-200 ml-1">{isRelayActive ? 'RUNNING' : 'IDLE'}</span>
        </div>
        <button
          onClick={() => setShowSmtpSettings(!showSmtpSettings)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
            isSmtpConfigured ? 'text-[#7FE7C4] hover:bg-[#7FE7C4]/10' : 'text-[#E8B54D] hover:bg-[#E8B54D]/10'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-widest font-bold">
            {isSmtpConfigured ? 'SMTP CONFIGURED' : 'CONFIGURE SMTP'}
          </span>
        </button>
      </div>

      {/* SMTP Settings Panel */}
      {showSmtpSettings && (
        <div className="bg-[#1F2329] p-4 border border-[#242930] rounded-xl flex flex-col gap-4">
          {/* Panel Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 uppercase font-bold tracking-wider">
              <KeyRound className="w-4 h-4 text-[#E8B54D]" />
              SMTP Configuration
            </div>
            {configSaved && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#7FE7C4] animate-in fade-in">
                <Check className="w-3 h-3" />
                Saved to database
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500 font-mono">
            Credentials are <span className="text-[#7FE7C4] font-bold">saved to your account database</span> — available on all devices.
          </p>

          {configLoading ? (
            <div className="py-4 font-mono text-xs text-zinc-500 animate-pulse">&gt; loading_config...</div>
          ) : (
            <>
              {/* Credential Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Sender Name',        value: smtpSenderName, setter: setSmtpSenderName, type: 'text',     placeholder: 'e.g. John from Acme' },
                  { label: 'Gmail Address',       value: smtpEmail,      setter: setSmtpEmail,      type: 'email',    placeholder: 'you@gmail.com' },
                  { label: 'Gmail App Password',  value: smtpPassword,   setter: setSmtpPassword,   type: 'password', placeholder: '16-character app password' },
                ].map(({ label, value, setter, type, placeholder }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={e => { setter(e.target.value); setConfigSaved(false); }}
                      placeholder={placeholder}
                      className="w-full bg-[#15181D] px-3 py-2 rounded border border-[#242930] outline-none focus:border-[#E8B54D]/50 text-sm text-zinc-200 font-mono"
                    />
                  </div>
                ))}
              </div>

              {/* Sending Speed */}
              <div className="pt-2 border-t border-[#242930]">
                <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-2">Sending Speed (Anti-Spam Protection)</label>
                <div className="flex gap-2">
                  {[
                    { value: 'slow'   as const, label: 'Slow (10s)',   desc: 'Best for large campaigns' },
                    { value: 'medium' as const, label: 'Medium (5s)',  desc: 'Balanced speed' },
                    { value: 'fast'   as const, label: 'Fast (2s)',    desc: 'Quick delivery' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setDraftSpeed(value); setConfigSaved(false); }}
                      className={`flex-1 px-3 py-2 rounded border text-left transition-all ${
                        draftSpeed === value
                          ? 'bg-[#89295E] border-[#89295E] text-white'
                          : 'bg-[#15181D] border-[#242930] text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold uppercase">{label}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 border-t border-[#242930] flex items-center justify-between gap-4">
                {configError && (
                  <p className="text-[10px] text-red-400 font-mono">{configError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className={`ml-auto flex items-center gap-2 px-5 py-2 rounded-lg font-mono text-xs font-bold tracking-wide transition-all shadow ${
                    configSaved
                      ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/40'
                      : 'bg-[#89295E] hover:bg-[#a03672] text-white disabled:opacity-50'
                  }`}
                >
                  {configSaving ? (
                    <span className="animate-pulse">Saving...</span>
                  ) : configSaved ? (
                    <><Check className="w-3.5 h-3.5" /> Configuration Saved</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Save Configuration</>
                  )}
                </button>
              </div>

              {/* SPF/DKIM Info */}
              <div className="pt-2 border-t border-[#242930]">
                <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-2">Domain Authentication (SPF/DKIM)</label>
                <div className="bg-[#15181D] p-3 rounded border border-[#242930] text-[10px] text-zinc-400 font-mono space-y-2">
                  <p className="text-[#E8B54D] font-bold">⚠️ Important for Deliverability</p>
                  <p>To improve email deliverability and avoid spam folders, add these DNS records to your domain:</p>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[#7FE7C4] font-bold">SPF Record:</span>
                      <code className="block bg-[#0D0F12] p-1.5 rounded mt-1 text-zinc-300">v=spf1 include:_spf.google.com ~all</code>
                    </div>
                    <div>
                      <span className="text-[#7FE7C4] font-bold">DKIM:</span>
                      <p className="mt-1">Generate DKIM keys in Gmail Workspace admin and add the CNAME record provided.</p>
                    </div>
                  </div>
                  <p className="text-zinc-500">These settings help email providers verify your emails are legitimate.</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex bg-[#15181D] p-0.5 rounded border border-[#242930] font-mono text-xs w-fit">
        {(['dashboard', 'history', 'reputation'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab ? 'bg-[#89295E] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'dashboard' ? 'Campaign Dashboard' : tab === 'history' ? 'Send History' : 'Reputation'}
          </button>
        ))}
      </div>

      {/* ── REPUTATION TAB ── */}
      {activeTab === 'reputation' ? (
        <div className="space-y-6">
          {reputationLoading ? (
            <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
              <span className="animate-pulse">&gt; loading_reputation_data...</span>
            </div>
          ) : !reputation ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#242930] rounded font-mono">
              <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">No reputation data available. Start a campaign first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Reputation Score Card */}
              <div className="bg-[#15181D] border border-[#242930] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-zinc-200 font-mono uppercase tracking-wider">Domain Reputation Score</h3>
                  <span className={`px-3 py-1 rounded text-[10px] font-bold font-mono uppercase ${
                    reputation.reputation.status === 'excellent' ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/30' :
                    reputation.reputation.status === 'good' ? 'bg-[#E8B54D]/20 text-[#E8B54D] border border-[#E8B54D]/30' :
                    reputation.reputation.status === 'fair' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {reputation.reputation.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold font-mono text-zinc-200">{reputation.reputation.score}</div>
                  <div className="flex-1 h-3 bg-[#1F2329] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        reputation.reputation.score >= 80 ? 'bg-[#7FE7C4]' :
                        reputation.reputation.score >= 60 ? 'bg-[#E8B54D]' :
                        reputation.reputation.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${reputation.reputation.score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Sent', value: reputation.metrics.totalSent, color: 'text-[#7FE7C4]' },
                  { label: 'Success Rate', value: `${reputation.metrics.successRate}%`, color: 'text-[#7FE7C4]' },
                  { label: 'Bounce Rate', value: `${reputation.metrics.bounceRate}%`, color: reputation.metrics.bounceRate > 5 ? 'text-red-400' : 'text-[#E8B54D]' },
                  { label: 'Account Age', value: `${reputation.metrics.accountAgeDays}d`, color: 'text-zinc-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#15181D] border border-[#242930] rounded p-4">
                    <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Current Limit */}
              <div className="bg-[#15181D] border border-[#242930] rounded p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Current Daily Limit</div>
                    <div className="text-2xl font-bold text-zinc-200">{reputation.metrics.currentLimit} emails/day</div>
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono max-w-xs text-right">
                    Based on warm-up schedule. Send consistently to increase your limit.
                  </div>
                </div>
              </div>

              {/* Daily Stats */}
              {reputation.dailyStats && reputation.dailyStats.length > 0 && (
                <div className="bg-[#15181D] border border-[#242930] rounded p-4">
                  <h4 className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-3">Last 7 Days</h4>
                  <div className="space-y-2">
                    {reputation.dailyStats.map((day: any) => (
                      <div key={day.date} className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-400">{day.date}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-[#7FE7C4]">{day.sent} sent</span>
                          <span className={day.failed > 0 ? 'text-red-400' : 'text-zinc-600'}>{day.failed} failed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        <div className="space-y-6">
          {historyLoading ? (
            <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
              <span className="animate-pulse">&gt; loading_send_history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#242930] rounded font-mono">
              <Send className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">No send history found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {history.map(dayGroup => (
                <div key={dayGroup.dateKey} className="bg-[#15181D] border border-[#242930] hover:border-zinc-700/80 rounded-2xl overflow-hidden transition-colors flex flex-col">
                  <div className="p-4 border-b border-[#242930] bg-[#0D0F12]/30 flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="text-sm font-bold text-zinc-200 truncate">{dayGroup.formattedDate}</h3>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider">{dayGroup.count} emails sent</span>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(dayGroup.emails.join(', ')); }}
                      className="px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-zinc-800 border border-[#242930] text-[#7FE7C4] text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                    >
                      Copy List
                    </button>
                  </div>
                  <div className="p-4 flex-1">
                    <textarea
                      readOnly
                      value={dayGroup.emails.join(', ')}
                      className="w-full h-32 bg-[#0D0F12]/50 p-2.5 rounded border border-[#242930] outline-none text-xs text-zinc-400 font-mono resize-none leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : !activeCampaignId ? (
        /* ── CAMPAIGN CREATION FORM ── */
        <form onSubmit={handleCreate} className="bg-[#15181D] p-5 border border-[#242930] rounded-xl space-y-5">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 uppercase font-bold tracking-wider pb-3 border-b border-[#242930]">
            <Send className="w-4 h-4 text-[#89295E]" />
            New Email Campaign
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Subject
              <span className="ml-2 normal-case text-zinc-600">— supports {'{name}'} and {'{company}'}</span>
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Hi {name}, quick question for you"
              className="w-full bg-[#1F2329] px-3 py-2.5 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 font-mono"
              required
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-start justify-between mb-1.5 gap-3">
              <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Body Content</label>
              {/* Placeholder hint */}
              <div className="flex items-center gap-3 font-mono text-[9px] bg-[#1F2329] border border-[#242930] px-2.5 py-1.5 rounded-lg shrink-0">
                <Info className="w-3 h-3 text-[#E8B54D] shrink-0" />
                <span className="text-zinc-400">Use <span className="text-[#7FE7C4] font-bold">{'{name}'}</span> and <span className="text-[#E8B54D] font-bold">{'{company}'}</span> as placeholders</span>
              </div>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={`Hi {name},\n\nI came across {company} and wanted to reach out...\n\nBest,\n[Your name]`}
              className="w-full h-44 bg-[#1F2329] px-3 py-2.5 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 font-sans resize-none leading-relaxed"
              required
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="flex justify-between text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              <span>Attachments</span>
              <span className="text-zinc-600 text-[9px]">Max 10MB per file</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#242930] hover:border-[#89295E]/50 rounded-lg p-4 cursor-pointer bg-[#1F2329]/50 transition-colors">
              <Upload className="w-5 h-5 text-zinc-600 mb-1.5" />
              <p className="text-xs text-zinc-500 font-mono">
                {isReadingFile ? 'Processing...' : 'Click to attach a file'}
              </p>
              <input
                type="file"
                className="hidden"
                disabled={isReadingFile}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachmentFile(f); }}
              />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 bg-[#1F2329] border border-[#242930] rounded-lg p-2.5 space-y-2">
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">Attached ({attachments.length}):</span>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-[#15181D] px-2.5 py-1 rounded text-xs text-zinc-300 font-mono border border-[#242930]">
                      <span className="truncate max-w-[150px]">{file.filename}</span>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 font-bold">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Recipients Section ── */}
          <div>
            {/* Mode Tabs */}
            <div className="flex items-center gap-3 mb-3">
              <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Recipients</label>
              <div className="flex bg-[#1F2329] p-0.5 rounded border border-[#242930] font-mono">
                <button
                  type="button"
                  onClick={() => { setImportMode('paste'); clearCSV(); }}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                    importMode === 'paste' ? 'bg-[#89295E] text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Send className="w-2.5 h-2.5" /> Paste Emails
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('csv')}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                    importMode === 'csv' ? 'bg-[#89295E] text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <FileSpreadsheet className="w-2.5 h-2.5" /> Import CSV
                </button>
              </div>

              {/* Campaign type badge */}
              {importMode === 'csv' && csvInfo && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[9px] font-bold uppercase tracking-wider ${
                  campaignType === 3 ? 'bg-[#89295E]/15 border-[#89295E]/30 text-[#89295E]'
                  : campaignType === 2 ? 'bg-[#7FE7C4]/10 border-[#7FE7C4]/30 text-[#7FE7C4]'
                  : 'bg-[#1F2329] border-[#242930] text-zinc-400'
                }`}>
                  <Users className="w-2.5 h-2.5" />
                  Type {campaignType}: {campaignType === 1 ? 'Blast' : campaignType === 2 ? 'Named' : 'Full Personalized'}
                </div>
              )}
            </div>

            {/* Paste Mode */}
            {importMode === 'paste' ? (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] font-mono text-zinc-600">Comma or newline separated</span>
                  <span className="text-[9px] font-mono text-[#E8B54D]">Up to 4,000 emails</span>
                </div>
                <textarea
                  value={pasteRecipients}
                  onChange={e => setPasteRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com, ..."
                  className="w-full h-24 bg-[#1F2329] px-3 py-2.5 rounded border border-[#242930] outline-none focus:border-zinc-700 text-sm text-zinc-400 placeholder:text-zinc-700 font-mono resize-none leading-relaxed"
                  required={importMode === 'paste'}
                />
              </div>
            ) : (
              /* CSV Import Mode */
              <div className="space-y-3">
                {/* Drop Zone */}
                {!csvInfo ? (
                  <label
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleCSVFile(f);
                    }}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                      isDragging
                        ? 'border-[#89295E] bg-[#89295E]/5'
                        : 'border-[#242930] hover:border-[#89295E]/40 bg-[#1F2329]/50'
                    }`}
                  >
                    <FileSpreadsheet className="w-8 h-8 text-zinc-600 mb-3" />
                    <p className="text-xs text-zinc-400 font-mono font-bold text-center">
                      {isReadingFile ? 'Reading CSV...' : 'Drag & drop a CSV file or click to browse'}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-1.5 text-center">
                      Required column: <span className="text-zinc-400">email</span> &nbsp;·&nbsp;
                      Optional: <span className="text-[#7FE7C4]">name</span>, <span className="text-[#E8B54D]">company</span>
                    </p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={isReadingFile}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }}
                    />
                  </label>
                ) : (
                  /* Post-import: detection banner + preview grid */
                  <div className="space-y-3">
                    {/* Detection banner */}
                    <div className="flex items-center justify-between bg-[#1F2329] border border-[#242930] rounded-lg px-3.5 py-2.5 font-mono">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                          <Users className="w-3.5 h-3.5 text-[#89295E]" />
                          {csvInfo.count} recipients
                        </div>
                        <div className={`text-[10px] font-bold ${csvInfo.hasName ? 'text-[#7FE7C4]' : 'text-zinc-700 line-through'}`}>
                          {'{name}'} {csvInfo.hasName ? '✓' : '✗'}
                        </div>
                        <div className={`text-[10px] font-bold ${csvInfo.hasCompany ? 'text-[#E8B54D]' : 'text-zinc-700 line-through'}`}>
                          {'{company}'} {csvInfo.hasCompany ? '✓' : '✗'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearCSV}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded"
                        title="Remove CSV"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Preview card grid */}
                    <div>
                      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider font-bold mb-2">
                        Preview (first {Math.min(importedRecipients.length, 12)} of {importedRecipients.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                        {importedRecipients.slice(0, 12).map((r, i) => (
                          <RecipientCardItem key={`${r.email}-${i}`} {...r} />
                        ))}
                        {importedRecipients.length > 12 && (
                          <div className="flex items-center justify-center bg-[#1F2329] border border-dashed border-[#242930] rounded-lg p-3 font-mono text-[10px] text-zinc-600 font-bold">
                            +{importedRecipients.length - 12} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* CSV Error */}
                {csvError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-950/20 border border-red-900/30 rounded px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {csvError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={creating || !isSmtpConfigured || (importMode === 'csv' && importedRecipients.length === 0)}
              className="w-full py-3 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold font-mono tracking-widest uppercase transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {!isSmtpConfigured
                ? 'CONFIGURE SMTP FIRST'
                : creating
                ? 'INITIALIZING...'
                : importMode === 'csv' && csvInfo
                ? `START CAMPAIGN → ${csvInfo.count} RECIPIENTS`
                : 'START CAMPAIGN QUEUE'}
            </button>
          </div>
        </form>

      ) : (
        /* ── PROGRESS MONITOR ── */
        <div className="bg-[#15181D] p-6 border border-[#242930] rounded-xl space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#242930]">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Campaign Status</span>
              <h2 className="text-xl font-bold text-zinc-200 truncate pr-4 max-w-md">{status.subject || subject || 'Ongoing Campaign'}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { if (confirm('Reset this campaign monitor? You can create a new one after.')) resetCampaign(); }}
                className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono font-bold uppercase bg-[#1F2329] border border-[#242930] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
              >
                New Campaign
              </button>
              {status.campaign_status !== 'completed' && (
                <button
                  onClick={() => toggleRelay(!isRelayActive)}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                    isRelayActive
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                      : 'bg-[#7FE7C4]/10 text-[#7FE7C4] hover:bg-[#7FE7C4]/20 border border-[#7FE7C4]/20'
                  }`}
                >
                  {isRelayActive ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-[10px] uppercase font-bold tracking-wider">
              <span className="text-zinc-400">Progress: {percentComplete}%</span>
              <span className="text-zinc-500">{status.sent + status.failed} / {status.total} processed</span>
            </div>
            <div className="w-full h-3 bg-[#1F2329] rounded-full overflow-hidden border border-[#242930]">
              <div className="h-full bg-[#89295E] transition-all duration-1000 ease-out" style={{ width: `${percentComplete}%` }} />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Sent',    value: status.sent,    color: 'text-[#7FE7C4]' },
              { label: 'Pending', value: status.pending, color: 'text-[#E8B54D]' },
              { label: 'Failed',  value: status.failed,  color: 'text-red-400'  },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#1F2329] border border-[#242930] rounded p-3 flex flex-col items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider mb-1">{label}</span>
                <span className={`text-xl font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* ── Recipient Card Grid ── */}
          {allRecipients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Recipient Status</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(sentCards.map(r => r.email).join(', '))}
                    disabled={sentCards.length === 0}
                    className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#7FE7C4] hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy Sent
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(pendingCards.map(r => r.email).join(', '))}
                    disabled={pendingCards.length === 0}
                    className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#E8B54D] hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy Pending
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
                {allRecipients.map((r, i) => (
                  <RecipientCardItem key={`${r.email}-${i}`} {...r} />
                ))}
              </div>
            </div>
          )}

          {/* Activity log */}
          <div className="bg-[#0D0F12] border border-[#242930] rounded p-3 font-mono text-[10px] space-y-1">
            <div className="text-zinc-500 uppercase font-bold tracking-widest mb-2 border-b border-[#242930] pb-2">Live Relay Feed</div>
            {relayError ? (
              <div className="text-red-400 flex flex-col gap-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-3 h-3 shrink-0" /> RELAY STOPPED — ERROR
                </div>
                <p className="text-red-300/80 pl-5 leading-relaxed break-all">{relayError}</p>
              </div>
            ) : isRelayActive ? (
              <div className="text-[#E8B54D] animate-pulse flex items-center gap-2">
                <span className="w-2 h-2 bg-[#E8B54D] rounded-full" />
                Processing queue... (6s pace)
              </div>
            ) : status.campaign_status === 'completed' ? (
              <div className="text-[#7FE7C4] flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" /> Campaign finished. All emails processed.
              </div>
            ) : (
              <div className="text-red-400 flex items-center gap-2">
                <Pause className="w-3 h-3" /> Relay paused. Click resume to continue.
              </div>
            )}
            {lastEmailSent && (
              <div className="text-zinc-400 mt-2">
                <span className="text-[#7FE7C4]">&gt; sent_success:</span> {lastEmailSent}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
