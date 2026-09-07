'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEmails } from '@/lib/hooks/useEmails';
import { useWhatsApp, buildWhatsAppLink, DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/hooks/useWhatsApp';
import { useJobApplications, type JobApplication } from '@/lib/hooks/useJobApplications';
import { useImageApplications, type ImageApplication } from '@/lib/hooks/useImageApplications';
import { useEmailPreferences, type EmailPreferences } from '@/lib/hooks/useEmailPreferences';
import { useGlobalSpace } from '@/lib/hooks/useGlobalSpace';
import {
  Sparkles,
  Copy,
  Check,
  KeyRound,
  Send,
  Plus,
  Trash2,
  FileText,
  Users,
  Building2,
  Globe,
  ExternalLink,
  Zap,
  ArrowRight,
  ClipboardPaste,
  Filter,
  MessageCircle,
  Phone,
  Briefcase,
  Mail,
  Edit3,
  MapPin,
  CheckCircle2,
  Circle,
  Search,
  X,
  Settings2,
  ChevronDown,
  Save,
  User,
  Link,
  Share2,
  Download,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MultiSelectBar } from '@/components/MultiSelectBar';

interface ExtractedEntry {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin?: string;
}

export default function AiExtractorPage() {
  const router = useRouter();
  const supabase = createClient();
  const { emails: existingEmails, addEmail } = useEmails();
  const { batches: waBatches, addBatchContacts, template: waTemplate } = useWhatsApp();
  const { shareToGlobal, getUnsharedItems } = useGlobalSpace();

  // Hook for persistent Database-backed Job Applications
  const {
    applications: savedJobCards,
    loading: jobCardsLoading,
    stats: jobStats,
    addBatchApplications,
    toggleStatus: toggleJobStatus,
    updateApplication: updateJobCardInDb,
    deleteApplication: deleteJobCardFromDb,
    shareApplication,
    importApplication,
    shareJobApplications,
    importJobApplications,
  } = useJobApplications();

  // Hook for Image-based Job Applications (separate from LinkedIn posts)
  const {
    applications: savedImageCards,
    loading: imageCardsLoading,
    stats: imageStats,
    addBatchApplications: addBatchImageApplications,
    toggleStatus: toggleImageStatus,
    updateApplication: updateImageCardInDb,
    deleteApplication: deleteImageCardFromDb,
  } = useImageApplications();

  // Mode: 'job_applications' (Default), 'extractor', or 'image_extractor'
  const [activeTab, setActiveTab] = useState<'job_applications' | 'extractor' | 'image_extractor'>('job_applications');

  const [rawText, setRawText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Search & Filter for Job Applications
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [cardToDelete, setCardToDelete] = useState<{ id: string; title: string } | null>(null);

  // Image handling state
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);

  // Copy State Feedback per Card & Type
  const [copiedState, setCopiedState] = useState<{ id: string; type: 'email' | 'subject' | 'body' | 'all' } | null>(null);
  const [savedToEmailsMap, setSavedToEmailsMap] = useState<Record<string, boolean>>({});

  // Extractor Results
  const [extractedEntries, setExtractedEntries] = useState<ExtractedEntry[]>([]);
  const [extractedEmails, setExtractedEmails] = useState<string[]>([]);
  const [extractedPhones, setExtractedPhones] = useState<string[]>([]);
  const [commaSeparated, setCommaSeparated] = useState('');
  const [phonesCommaSeparated, setPhonesCommaSeparated] = useState('');
  const [extractionSource, setExtractionSource] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'comma' | 'table' | 'whatsapp' | 'lines'>('comma');

  // Email Preferences
  const { preferences, saving: prefsSaving, savePreferences, hasPreferences } = useEmailPreferences();
  const [showPrefsPanel, setShowPrefsPanel] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<EmailPreferences>(preferences);

  // Sync localPrefs when preferences load from DB
  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  // Sharing states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCardId, setShareCardId] = useState('');
  const [shareCardTitle, setShareCardTitle] = useState('');
  const [sharePasscode, setSharePasscode] = useState('');
  const [shareKeyResult, setShareKeyResult] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  // Bulk Sharing states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkShareModalOpen, setIsBulkShareModalOpen] = useState(false);
  const [bulkSharePasscode, setBulkSharePasscode] = useState('');
  const [bulkShareKeyResult, setBulkShareKeyResult] = useState('');
  const [bulkShareLoading, setBulkShareLoading] = useState(false);

  // Importing states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importShareKey, setImportShareKey] = useState('');
  const [importPasscode, setImportPasscode] = useState('');
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Custom Controls toggle state
  const [showCustomButtons, setShowCustomButtons] = useState(false);

  // Email Collection Card States for LinkedIn & Image Tabs
  const [showLinkedInEmailsCard, setShowLinkedInEmailsCard] = useState(false);
  const [linkedInEmailFormat, setLinkedInEmailFormat] = useState<'comma' | 'lines'>('comma');
  const [copiedLinkedInFormat, setCopiedLinkedInFormat] = useState<string | null>(null);

  const [showImageEmailsCard, setShowImageEmailsCard] = useState(false);
  const [imageEmailFormat, setImageEmailFormat] = useState<'comma' | 'lines'>('comma');
  const [copiedImageFormat, setCopiedImageFormat] = useState<string | null>(null);

  // Load saved Groq API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dailydeck_groq_key');
    if (saved) setApiKey(saved);
  }, []);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveApiKey = (keyToSave: string) => {
    setApiKey(keyToSave.trim());
    localStorage.setItem('dailydeck_groq_key', keyToSave.trim());
    setShowKeyModal(false);
    showNotification('Groq API Key saved');
  };

  // Run AI processing
  const handleProcess = async () => {
    setLoading(true);
    setCopiedState(null);

    try {
      if (activeTab === 'image_extractor') {
        // Image processing
        if (uploadedImages.length === 0) {
          showNotification('Please upload or paste images to process.');
          setLoading(false);
          return;
        }

        setImageLoading(true);
        const formData = new FormData();
        uploadedImages.forEach((image) => formData.append('images', image));
        if (apiKey) formData.append('apiKey', apiKey);
        formData.append('preferences', JSON.stringify(preferences));

        const res = await fetch('/api/ai/extract-image', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (data.error) {
          showNotification(`Error: ${data.error}`);
        } else {
          const apps = data.applications || [];
          if (apps.length > 0) {
            // Save generated cold email cards to separate image_applications table
            await addBatchImageApplications(apps);

            // Save detected phone numbers to WhatsApp Outreach tab
            const phoneItems: Array<{ phone: string; name?: string; company?: string }> = [];
            for (const app of apps) {
              if (app.phone) {
                phoneItems.push({
                  phone: app.phone,
                  name: app.recruiter_name || undefined,
                  company: app.company || undefined,
                });
              }
            }

            if (data.phones && Array.isArray(data.phones)) {
              for (const p of data.phones) {
                if (!phoneItems.some(it => it.phone === p)) {
                  phoneItems.push({ phone: p });
                }
              }
            }

            if (phoneItems.length > 0) {
              const now = new Date();
              const batchTitle = `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} Image WA Batch`;
              await addBatchContacts(phoneItems, batchTitle);
              showNotification(`Generated ${apps.length} Cold Emails from images & added ${phoneItems.length} WhatsApp card${phoneItems.length > 1 ? 's' : ''} to WhatsApp Outreach tab!`);
            } else {
              showNotification(`Generated & saved ${apps.length} cold email cards from images!`);
            }

            // Clear images after successful processing
            setUploadedImages([]);
            setImagePreviews([]);
          } else {
            showNotification('No job applications detected in images.');
          }
        }
        setImageLoading(false);
      } else {
        // Text processing (existing logic)
        if (!rawText.trim()) {
          showNotification('Please paste text to process.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/ai/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: rawText,
            apiKey: apiKey.trim() || undefined,
            mode: activeTab,
            preferences,
          })
        });

        const data = await res.json();

        if (data.error) {
          showNotification(`Error: ${data.error}`);
        } else {
          if (activeTab === 'job_applications') {
            const apps = data.applications || [];
            if (apps.length > 0) {
              // 1. Automatically save generated cold email cards to Supabase database
              await addBatchApplications(apps);

              // 2. Automatically save any detected phone numbers to WhatsApp Outreach tab
              const phoneItems: Array<{ phone: string; name?: string; company?: string }> = [];
              for (const app of apps) {
                if (app.phone) {
                  phoneItems.push({
                    phone: app.phone,
                    name: app.recruiter_name || undefined,
                    company: app.company || undefined,
                  });
                }
              }

              // Also check data.phones list
              if (data.phones && Array.isArray(data.phones)) {
                for (const p of data.phones) {
                  if (!phoneItems.some(it => it.phone === p)) {
                    phoneItems.push({ phone: p });
                  }
                }
              }

              if (phoneItems.length > 0) {
                const now = new Date();
                const batchTitle = `${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'short' })} WA Batch`;
                await addBatchContacts(phoneItems, batchTitle);
                showNotification(`Generated ${apps.length} Cold Emails & added ${phoneItems.length} WhatsApp card${phoneItems.length > 1 ? 's' : ''} to WhatsApp Outreach tab!`);
              } else {
                showNotification(`Generated & saved ${apps.length} cold email cards to database!`);
              }

              setRawText(''); // Clear input after successful creation
            } else {
              showNotification('No job applications detected in text.');
            }
          } else {
            setExtractedEntries(data.entries || []);
            setExtractedEmails(data.emails || []);
            setExtractedPhones(data.phones || []);
            setCommaSeparated(data.commaSeparated || '');
            setPhonesCommaSeparated(data.phonesCommaSeparated || '');
            setExtractionSource(data.source || 'parser');
            showNotification(`Extracted ${data.count || 0} emails & ${data.phoneCount || 0} phone numbers!`);
          }
        }
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to process with AI');
    } finally {
      setLoading(false);
    }
  };

  // Copy helper with animated feedback per button
  const copyToClipboard = async (text: string, id: string, type: 'email' | 'subject' | 'body' | 'all', label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState({ id, type });
      showNotification(`Copied ${label}!`);
      setTimeout(() => setCopiedState(null), 2000);
    } catch {
      showNotification('Failed to copy to clipboard');
    }
  };

  // Save individual Job Card to Emails tab
  const handleSaveJobCardToEmails = async (card: JobApplication) => {
    const title = card.company ? `${card.role || 'Job'} @ ${card.company}` : card.subject;
    const category = 'Cold Outreach';
    const content = `To: ${card.to_email}\nSubject: ${card.subject}\n\n${card.body}`;

    try {
      await addEmail(title, category, content);
      setSavedToEmailsMap(prev => ({ ...prev, [card.id]: true }));
      showNotification(`Saved "${title}" to Emails tab!`);
    } catch {
      showNotification('Failed to save to emails tab');
    }
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        showNotification('Pasted from clipboard!');
      }
    } catch {
      showNotification('Could not read clipboard. Please paste manually.');
    }
  };

  // Image handling functions
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      showNotification('Please upload valid image files.');
      return;
    }

    setUploadedImages(prev => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    showNotification(`Added ${validFiles.length} image${validFiles.length > 1 ? 's' : ''}`);
  };

  const handleImagePaste = async (e: React.ClipboardEvent) => {
    if (activeTab !== 'image_extractor') return;

    const items = Array.from(e.clipboardData.items);
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setUploadedImages(prev => [...prev, ...imageFiles]);

      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });

      showNotification(`Pasted ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setUploadedImages([]);
    setImagePreviews([]);
  };

  // Filter Job Cards (Pending on top, Completed at bottom)
  const filteredJobCards = savedJobCards.filter((card) => {
    const matchSearch =
      (card.to_email || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.company || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.role || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.recruiter_name || '').toLowerCase().includes(jobSearch.toLowerCase()) ||
      (card.subject || '').toLowerCase().includes(jobSearch.toLowerCase());

    const matchStatus = jobStatusFilter === 'all' ? true : card.status === jobStatusFilter;
    return matchSearch && matchStatus;
  });

  // Selection handlers
  const toggleSelect = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setIsSelectionMode(true);
    setSelectedIds(new Set(filteredJobCards.map(card => card.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkShare = async () => {
    setBulkShareLoading(true);
    const key = await shareJobApplications(Array.from(selectedIds), bulkSharePasscode);
    setBulkShareLoading(false);
    if (key) {
      setBulkShareKeyResult(key);
      showNotification('Job cards bundle shared successfully!');
    } else {
      showNotification('Failed to create shared bundle.');
    }
  };

  const handleBulkImport = async () => {
    setImportLoading(true);
    setImportError('');
    const result = await importJobApplications(importShareKey, importPasscode);
    setImportLoading(false);
    if (result.success) {
      showNotification(`✓ Imported ${result.count} job card${(result.count || 0) > 1 ? 's' : ''} shared by ${result.ownerName}!`);
      setIsImportModalOpen(false);
    } else {
      setImportError('Invalid Share Key, incorrect passcode, or the bundle was deleted.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#7FE7C4] text-black px-4 py-2 rounded-lg shadow-xl font-mono text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#242930] gap-3 font-mono text-xs text-zinc-400">
        {/* Mode Selector */}
        <div className="flex bg-[#15181D] p-0.5 rounded-lg border border-[#242930] w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('job_applications')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
              activeTab === 'job_applications'
                ? 'bg-[#89295E] text-white border border-[#89295E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>LinkedIn Posts &rarr; Cold Emails</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('image_extractor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
              activeTab === 'image_extractor'
                ? 'bg-[#89295E] text-white border border-[#89295E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Images &rarr; Cold Emails</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extractor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[11px] font-bold tracking-wide transition-colors ${
              activeTab === 'extractor'
                ? 'bg-[#89295E] text-white border border-[#89295E]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bulk Extractor (Email/Phone)</span>
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {activeTab === 'job_applications' && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#E8B54D] font-bold">{jobStats.pending} pending</span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-[#7FE7C4] font-bold">{jobStats.completed} completed</span>
            </div>
          )}
          {activeTab === 'image_extractor' && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#E8B54D] font-bold">{imageStats.pending} pending</span>
              <span className="text-zinc-600">&bull;</span>
              <span className="text-[#7FE7C4] font-bold">{imageStats.completed} completed</span>
            </div>
          )}
          {/* Custom Toggle Button */}
          <button
            type="button"
            onClick={() => setShowCustomButtons((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              showCustomButtons
                ? 'bg-[#89295E] text-white border-[#89295E]'
                : 'border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Settings2 className="w-3 h-3" />
            <span>Custom</span>
          </button>

          {/* Hidden Action Buttons revealed on clicking Custom */}
          {showCustomButtons && (
            <>
              {activeTab === 'job_applications' && (
                <>
                  {isSelectionMode ? (
                    <>
                      <button
                        onClick={() => {
                          const allSelected = selectedIds.size === filteredJobCards.length;
                          if (allSelected) {
                            clearSelection();
                          } else {
                            selectAll();
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800 transition-colors w-fit"
                      >
                        <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                          selectedIds.size === filteredJobCards.length ? 'bg-[#89295E] border-[#89295E]' : 'border-zinc-600'
                        }`}>
                          {selectedIds.size === filteredJobCards.length && <span className="text-white text-[8px] font-bold">✓</span>}
                        </div>
                        <span>{selectedIds.size === filteredJobCards.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsSelectionMode(false);
                          clearSelection();
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800 transition-colors w-fit"
                      >
                        <span>Cancel Selection</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsSelectionMode(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800 transition-colors w-fit"
                    >
                      <span>Select</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setImportShareKey('');
                      setImportPasscode('');
                      setImportError('');
                      setIsImportModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800 transition-colors w-fit"
                    title="Import shared cards/bundle"
                  >
                    <Download className="w-3 h-3 text-[#ff8ac8]" />
                    <span>Import Shared</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition-colors bg-[#7FE7C4]/10 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/20 w-fit"
              >
                <KeyRound className="w-3 h-3" />
                <span>GROQ LLaMA-3.3 ACTIVE</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODE 1: LINKEDIN POSTS -> PERSISTENT TAILORED COLD EMAILS CARDS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'job_applications' && (
        <div className="space-y-6">
          
          {/* ⚙️ Collapsible AI Email Preferences Panel */}
          <div className="border border-[#242930] rounded-xl overflow-hidden shadow-sm">
            {/* Toggle Header */}
            <button
              type="button"
              onClick={() => setShowPrefsPanel((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#15181D] hover:bg-[#1a1e24] transition-colors group"
            >
              <div className="flex items-center gap-2 font-mono text-xs">
                <Settings2 className="w-3.5 h-3.5 text-[#89295E]" />
                <span className="font-bold text-zinc-300">AI Email Preferences</span>
                {hasPreferences ? (
                  <span className="px-1.5 py-0.5 rounded bg-[#7FE7C4]/15 text-[#7FE7C4] text-[9px] font-bold border border-[#7FE7C4]/30">
                    ✓ Profile Saved
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-[#E8B54D]/15 text-[#E8B54D] text-[9px] font-bold border border-[#E8B54D]/30">
                    Setup Required
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${showPrefsPanel ? 'rotate-180' : ''}`} />
            </button>

            {/* Expandable Form */}
            {showPrefsPanel && (
              <div className="bg-[#0D0F12] border-t border-[#242930] p-4 space-y-4">
                <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                  Fill in your profile once. The AI will use this to generate emails tailored to <span className="text-zinc-300 font-bold">any job role</span> — not just frontend. Your example email becomes the style guide.
                </p>

                {/* Row 1: Personal Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Full Name</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <User className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.full_name}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, full_name: e.target.value }))}
                        placeholder="e.g. Prathamesh Mali"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Email</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.your_email}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, your_email: e.target.value }))}
                        placeholder="your@email.com"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Phone (with country code)</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.phone}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, phone: e.target.value }))}
                        placeholder="e.g. 7620537089"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">LinkedIn URL</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Link className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.linkedin_url}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, linkedin_url: e.target.value }))}
                        placeholder="https://linkedin.com/in/you"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Portfolio URL</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.portfolio_url}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, portfolio_url: e.target.value }))}
                        placeholder="https://your-portfolio.dev"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Role / Title</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Briefcase className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.your_role}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, your_role: e.target.value }))}
                        placeholder="e.g. Frontend Developer / Full Stack"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Years of Experience</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Sparkles className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.experience}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, experience: e.target.value }))}
                        placeholder="e.g. 2 years"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Key Skills (comma separated)</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Zap className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.key_skills}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, key_skills: e.target.value }))}
                        placeholder="React.js, Next.js, TypeScript, Node.js..."
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Example Subject */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    Example Subject Line <span className="text-zinc-600 normal-case">(AI adapts [Role] from the job post)</span>
                  </label>
                  <input
                    value={localPrefs.example_subject}
                    onChange={(e) => setLocalPrefs(p => ({ ...p, example_subject: e.target.value }))}
                    placeholder="e.g. Application for [Role] Position - Prathamesh Mali"
                    className="w-full bg-[#15181D] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono outline-none focus:border-[#89295E] placeholder:text-zinc-600"
                  />
                </div>

                {/* Example Body */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    Example Email Body <span className="text-zinc-600 normal-case">(Your best cold email — AI uses this as style reference and adapts per job)</span>
                  </label>
                  <textarea
                    value={localPrefs.example_body}
                    onChange={(e) => setLocalPrefs(p => ({ ...p, example_body: e.target.value }))}
                    rows={8}
                    placeholder={`Hi [Recruiter Name],\n\nI hope this message finds you well.\n\nI am writing to apply for the [Role] position at [Company]. I have 2 years of experience in frontend development specializing in React.js, Next.js, and TypeScript...\n\n...\n\nBest regards,\nYour Name`}
                    className="w-full bg-[#15181D] border border-[#242930] rounded-lg p-3 text-xs text-zinc-300 font-sans leading-relaxed outline-none focus:border-[#89295E] resize-none placeholder:text-zinc-600"
                  />
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[9px] font-mono text-zinc-600">Saved to your account — synced across sessions</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await savePreferences(localPrefs);
                      if (ok) {
                        showNotification('✓ Email preferences saved!');
                        setShowPrefsPanel(false);
                      } else {
                        showNotification('Failed to save preferences. Check DB.');
                      }
                    }}
                    disabled={prefsSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono transition-all"
                  >
                    <Save className="w-3 h-3" />
                    <span>{prefsSaving ? 'Saving...' : 'Save Preferences'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Paste Section */}
          <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <Briefcase className="w-3.5 h-3.5 text-[#ff8ac8]" />
                <span className="font-bold">Paste One or Multiple LinkedIn Job Posts</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2329] hover:bg-[#282D35] text-[11px] font-mono text-zinc-300 transition-colors"
                >
                  <ClipboardPaste className="w-3 h-3 text-[#ff8ac8]" />
                  <span>Paste</span>
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1F2329]"
                    title="Clear text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={rawText || ''}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste one or multiple LinkedIn posts here.\nSeparate each post with --- (three dashes) for accurate results.\n\nExample:\nPost 1 content... apply@company1.com\n---\nPost 2 content... hr@company2.in\n---\nPost 3 content...`}
              rows={6}
              className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-sans leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[10px] font-mono text-zinc-500">
                {hasPreferences
                  ? `AI will generate emails as ${preferences.full_name || 'you'} — adapts to any job role.`
                  : <span className="text-[#E8B54D]">⚠ Set your profile in ⚙️ Email Preferences above for best results.</span>
                }
              </span>

              <button
                type="button"
                onClick={handleProcess}
                disabled={loading || !rawText.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono tracking-wide transition-all shadow-md active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing &amp; Saving with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Tailored Cold Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Multi-Select Bar */}
          {selectedIds.size > 0 && (
            <MultiSelectBar
              selectedCount={selectedIds.size}
              totalCount={filteredJobCards.length}
              onMarkCompleted={async () => {
                await Promise.all([...selectedIds].map(id => toggleJobStatus(id)));
                showNotification(`${selectedIds.size} cards marked completed`);
                clearSelection();
                setIsSelectionMode(false);
              }}
              onMarkPending={async () => {
                await Promise.all([...selectedIds].map(id => toggleJobStatus(id)));
                showNotification(`${selectedIds.size} cards marked pending`);
                clearSelection();
                setIsSelectionMode(false);
              }}
              onDeleteSelected={async () => {
                await Promise.all([...selectedIds].map(id => deleteJobCardFromDb(id)));
                showNotification(`${selectedIds.size} cards deleted`);
                clearSelection();
                setIsSelectionMode(false);
              }}
              onShareSelected={() => {
                setBulkSharePasscode('');
                setBulkShareKeyResult('');
                setIsBulkShareModalOpen(true);
              }}
            />
          )}

          {/* Action Bar: All Collected Emails Card (LinkedIn Tab) */}
          {savedJobCards.length > 0 && (() => {
            const validLinkedInEmails = Array.from(
              new Set(savedJobCards.map(c => c.to_email?.trim()).filter((e): e is string => !!e && e.includes('@')))
            );
            const commaText = validLinkedInEmails.join(', ');
            const linesText = validLinkedInEmails.join('\n');
            const displayText = linkedInEmailFormat === 'comma' ? commaText : linesText;
            const mailtoBccUrl = validLinkedInEmails.length > 0 ? `mailto:?bcc=${encodeURIComponent(commaText)}` : '';

            return (
              <div className="bg-[#15181D] border border-[#89295E]/40 rounded-xl overflow-hidden shadow-lg transition-all">
                {/* Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1A1D24] border-b border-[#242930]">
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                    <Mail className="w-4 h-4 text-[#7FE7C4]" />
                    <span className="font-bold">Collected Emails:</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#7FE7C4]/20 text-[#7FE7C4] text-[10px] font-bold border border-[#7FE7C4]/30">
                      {validLinkedInEmails.length} {validLinkedInEmails.length === 1 ? 'Email' : 'Emails'}
                    </span>
                    <span className="text-zinc-500 text-[10px] hidden sm:inline">&bull; from {savedJobCards.length} cards</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!commaText) return;
                        navigator.clipboard.writeText(commaText);
                        setCopiedLinkedInFormat('comma');
                        showNotification(`Copied ${validLinkedInEmails.length} emails!`);
                        setTimeout(() => setCopiedLinkedInFormat(null), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#89295E] hover:bg-[#a03672] text-white transition-all shadow-sm"
                    >
                      {copiedLinkedInFormat === 'comma' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLinkedInFormat === 'comma' ? 'Copied!' : 'Copy All Emails'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLinkedInEmailsCard((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#ff8ac8]" />
                      <span>{showLinkedInEmailsCard ? 'Hide Collection' : 'View Collection'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showLinkedInEmailsCard ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Card Content */}
                {showLinkedInEmailsCard && (
                  <div className="p-4 space-y-3 bg-[#0D0F12] border-t border-[#242930] animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242930] pb-2 font-mono text-[11px]">
                      {/* Format selector */}
                      <div className="flex bg-[#15181D] p-0.5 rounded-lg border border-[#242930]">
                        <button
                          type="button"
                          onClick={() => setLinkedInEmailFormat('comma')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                            linkedInEmailFormat === 'comma' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Comma-Separated
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkedInEmailFormat('lines')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                            linkedInEmailFormat === 'lines' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Line-by-Line
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!displayText) return;
                            navigator.clipboard.writeText(displayText);
                            setCopiedLinkedInFormat(linkedInEmailFormat);
                            showNotification(`Copied ${validLinkedInEmails.length} emails (${linkedInEmailFormat})!`);
                            setTimeout(() => setCopiedLinkedInFormat(null), 2000);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                            copiedLinkedInFormat === linkedInEmailFormat
                              ? 'bg-[#7FE7C4] text-black'
                              : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930]'
                          }`}
                        >
                          {copiedLinkedInFormat === linkedInEmailFormat ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                          <span>{copiedLinkedInFormat === linkedInEmailFormat ? 'Copied!' : `Copy (${linkedInEmailFormat === 'comma' ? 'Comma' : 'Lines'})`}</span>
                        </button>

                        <a
                          href={mailtoBccUrl}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-sky-300 border border-[#242930] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                          <span>Open in Mail (BCC)</span>
                        </a>

                        <button
                          type="button"
                          onClick={async () => {
                            const batchTitle = `${new Date().getDate()} ${new Date().toLocaleDateString('en-US', { month: 'short' })} LinkedIn Emails`;
                            await addEmail(batchTitle, 'AI Extracted', commaText);
                            showNotification(`Saved "${batchTitle}" in Emails tab!`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#89295E] hover:bg-[#a03672] text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Save to Emails Tab</span>
                        </button>

                        {(() => {
                          const unshared = getUnsharedItems('email', validLinkedInEmails);
                          const isAllShared = validLinkedInEmails.length > 0 && unshared.length === 0;
                          return (
                            <button
                              type="button"
                              onClick={async () => {
                                if (unshared.length === 0) {
                                  showNotification('✓ All emails from this list are already shared to Global Space!');
                                  return;
                                }
                                const title = `LinkedIn Cold Outreach Emails (${unshared.length} New)`;
                                const res = await shareToGlobal('email', title, unshared);
                                if (res) {
                                  showNotification(`✓ Shared ${unshared.length} new email${unshared.length > 1 ? 's' : ''} to Global Space!`);
                                } else {
                                  showNotification('Failed to share to Global Space.');
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-[#ff8ac8] border border-[#242930] transition-colors"
                            >
                              <Globe className="w-3 h-3 text-[#ff8ac8]" />
                              <span>
                                {isAllShared
                                  ? '✓ All Shared to Global'
                                  : unshared.length < validLinkedInEmails.length
                                  ? `Share ${unshared.length} New to Global`
                                  : 'Share to Global Space'}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={displayText}
                      rows={Math.min(8, Math.max(3, validLinkedInEmails.length))}
                      className="w-full bg-[#15181D] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all focus:border-[#89295E]"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Search & Filter Bar for Generated Cards */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 bg-[#15181D] border border-[#242930] rounded-xl flex items-center px-3.5 py-2 focus-within:border-[#89295E]/60 transition-colors">
              <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
              <input
                value={jobSearch || ''}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search generated applications by company, role, email, or recruiter..."
                className="w-full bg-transparent text-xs text-zinc-200 outline-none border-none placeholder:text-zinc-600 font-sans"
              />
              {jobSearch && (
                <button onClick={() => setJobSearch('')} className="p-0.5 text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex gap-1.5 font-mono flex-wrap">
              {(['all', 'pending', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setJobStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    jobStatusFilter === s
                      ? s === 'completed'
                        ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border-[#7FE7C4]/50'
                        : s === 'pending'
                        ? 'bg-[#E8B54D]/20 text-[#E8B54D] border-[#E8B54D]/50'
                        : 'bg-[#89295E] text-white border-[#89295E]'
                      : 'bg-[#15181D] text-zinc-500 border-[#242930] hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {s === 'all' ? `All (${jobStats.total})` : s === 'pending' ? `Pending (${jobStats.pending})` : `Completed (${jobStats.completed})`}
                </button>
              ))}
            </div>
          </div>

          {/* Persistent Cards Grid (Pending on top, Completed at bottom) */}
          <div className="space-y-4">
            {jobCardsLoading && savedJobCards.length === 0 ? (
              <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
                <span className="animate-pulse">&gt; loading_job_applications...</span>
              </div>
            ) : filteredJobCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
                <Briefcase className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="text-xs text-zinc-400 font-bold font-mono">
                  {jobSearch || jobStatusFilter !== 'all' ? 'No matching applications' : 'No job applications saved yet'}
                </p>
                <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                  Paste LinkedIn hiring posts above and click "Generate Tailored Cold Emails" to create and save application cards!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredJobCards.map((card) => {
                  const isCompleted = card.status === 'completed';
                  const isEmailCopied = copiedState?.id === card.id && copiedState.type === 'email';
                  const isSubCopied = copiedState?.id === card.id && copiedState.type === 'subject';
                  const isBodyCopied = copiedState?.id === card.id && copiedState.type === 'body';
                  const isAllCopied = copiedState?.id === card.id && copiedState.type === 'all';
                  const isSaved = savedToEmailsMap[card.id];

                  // mailto link
                  const mailtoUrl = `mailto:${card.to_email}?subject=${encodeURIComponent(card.subject || '')}&body=${encodeURIComponent(card.body || '')}`;

                  const isSelected = selectedIds.has(card.id);

                  return (
                    <div
                      key={card.id}
                      className={`bg-[#15181D] border rounded-2xl p-4.5 space-y-3.5 shadow-md flex flex-col justify-between transition-all duration-150 ${
                        isSelected && isSelectionMode
                          ? 'border-[#89295E] ring-2 ring-[#89295E]/30'
                          : isCompleted
                          ? 'border-[#242930] opacity-80 hover:opacity-100'
                          : 'border-[#89295E]/40 hover:border-[#89295E]/80'
                      }`}
                    >
                      {/* Top Header: Company, Recruiter, Role, Status Button */}
                      <div className="space-y-1.5 pb-2.5 border-b border-[#242930]">
                        <div className="flex items-start justify-between gap-2">
                          {/* Checkbox for multi-select */}
                          {isSelectionMode && (
                            <button
                              onClick={() => toggleSelect(card.id)}
                              className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-[#89295E] border-[#89295E]'
                                  : 'border-zinc-600'
                              }`}
                            >
                              {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className={`text-sm font-bold truncate ${isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-100'}`}>
                              <span>{card.role || 'Frontend Developer'}</span>
                              {card.company && (
                                <span className="text-[#ff8ac8] font-normal ml-1.5">@ {card.company}</span>
                              )}
                            </h3>
                            {card.recruiter_name && (
                              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                Recruiter: <span className="text-zinc-200">{card.recruiter_name}</span>
                              </p>
                            )}
                          </div>

                          {/* Status Toggle Badge */}
                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => toggleJobStatus(card.id)}
                              className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all border ${
                                isCompleted
                                  ? 'bg-[#7FE7C4]/15 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/25'
                                  : 'bg-[#E8B54D]/15 text-[#E8B54D] border-[#E8B54D]/30 hover:bg-[#E8B54D]/25'
                              }`}
                              title="Click to toggle status"
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-[#7FE7C4]" />
                                  <span>Done</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3 h-3 text-[#E8B54D]" />
                                  <span>Pending</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShareCardId(card.id);
                                setShareCardTitle(`${card.role || 'Job'} @ ${card.company || card.to_email}`);
                                setSharePasscode('');
                                setShareKeyResult('');
                                setIsShareModalOpen(true);
                              }}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-[#ff8ac8] transition-colors"
                              title="Share card with password"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setCardToDelete({ id: card.id, title: `${card.role || 'Job'} @ ${card.company || card.to_email}` })}
                              className="p-1 hover:bg-red-950/40 rounded text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Location & Skills tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {card.location && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] text-[10px] font-mono text-zinc-400">
                              <MapPin className="w-3 h-3 text-[#E8B54D]" />
                              {card.location}
                            </span>
                          )}
                          {card.skills && card.skills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-[#0D0F12] border border-[#242930] text-[9px] font-mono text-zinc-400"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 1. Target Email Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Send To Email:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#7FE7C4] shrink-0" />
                          <input
                            value={card.to_email || ''}
                            onChange={(e) => updateJobCardInDb(card.id, { to_email: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-mono text-[#7FE7C4] font-bold outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.to_email, card.id, 'email', 'Email Address')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isEmailCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy email address"
                          >
                            {isEmailCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isEmailCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional: WhatsApp Outreach if phone was extracted */}
                      {card.phone && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Extracted WhatsApp Contact:
                          </label>
                          <div className="flex items-center justify-between bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                              <span className="font-mono text-xs text-[#25D366] font-bold">+{card.phone}</span>
                            </div>
                            <a
                              href={buildWhatsAppLink(card.phone, waTemplate || DEFAULT_WHATSAPP_TEMPLATE)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-[10px] font-mono font-bold transition-all"
                            >
                              <span>Chat on WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 2. Subject Line Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Subject Line:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <input
                            value={card.subject || ''}
                            onChange={(e) => updateJobCardInDb(card.id, { subject: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-sans text-zinc-200 outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.subject, card.id, 'subject', 'Subject Line')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isSubCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy subject line"
                          >
                            {isSubCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#ff8ac8]" />}
                            <span>{isSubCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Tailored Email Body with Copy Button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Personalized Pitch Body:
                          </label>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.body, card.id, 'body', 'Email Body')}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              isBodyCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'text-zinc-400 hover:text-zinc-200 bg-[#1F2329]'
                            }`}
                            title="Copy full body"
                          >
                            {isBodyCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isBodyCopied ? 'Body Copied!' : 'Copy Body'}</span>
                          </button>
                        </div>

                        <textarea
                          value={card.body || ''}
                          onChange={(e) => updateJobCardInDb(card.id, { body: e.target.value })}
                          rows={12}
                          className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-300 font-sans leading-relaxed outline-none focus:border-[#89295E] resize-none"
                        />
                      </div>

                      {/* Card Footer: Quick Actions */}
                      <div className="pt-2 border-t border-[#242930] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                        {/* Open in Mail app */}
                        <a
                          href={mailtoUrl}
                          onClick={() => { if (!isCompleted) toggleJobStatus(card.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930] hover:border-zinc-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                          <span>Open in Mail</span>
                        </a>

                        <div className="flex items-center gap-2">
                          {/* Save to Emails Tab */}
                          <button
                            type="button"
                            onClick={() => handleSaveJobCardToEmails(card)}
                            disabled={isSaved}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                              isSaved
                                ? 'bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/40'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <Check className="w-3 h-3 text-[#7FE7C4]" />
                                <span>Saved in Emails</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-[#89295E]" />
                                <span>Save to Emails</span>
                              </>
                            )}
                          </button>

                          {/* Copy All (Email + Sub + Body) */}
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = `To: ${card.to_email}\nSubject: ${card.subject}\n\n${card.body}`;
                              copyToClipboard(fullText, card.id, 'all', 'Full Email Package');
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                              isAllCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#89295E] hover:bg-[#a03672] text-white'
                            }`}
                          >
                            {isAllCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>All Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODE 3: IMAGE EXTRACTOR (JOB POSTINGS FROM IMAGES) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'image_extractor' && (
        <div className="space-y-6">
          
          {/* ⚙️ Collapsible AI Email Preferences Panel (reused from job_applications) */}
          <div className="border border-[#242930] rounded-xl overflow-hidden shadow-sm">
            {/* Toggle Header */}
            <button
              type="button"
              onClick={() => setShowPrefsPanel((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#15181D] hover:bg-[#1a1e24] transition-colors group"
            >
              <div className="flex items-center gap-2 font-mono text-xs">
                <Settings2 className="w-3.5 h-3.5 text-[#89295E]" />
                <span className="font-bold text-zinc-300">AI Email Preferences</span>
                {hasPreferences ? (
                  <span className="px-1.5 py-0.5 rounded bg-[#7FE7C4]/15 text-[#7FE7C4] text-[9px] font-bold border border-[#7FE7C4]/30">
                    ✓ Profile Saved
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-[#E8B54D]/15 text-[#E8B54D] text-[9px] font-bold border border-[#E8B54D]/30">
                    Setup Required
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${showPrefsPanel ? 'rotate-180' : ''}`} />
            </button>

            {/* Expandable Form */}
            {showPrefsPanel && (
              <div className="bg-[#0D0F12] border-t border-[#242930] p-4 space-y-4">
                <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
                  Fill in your profile once. The AI will use this to generate emails tailored to <span className="text-zinc-300 font-bold">any job role</span> extracted from images.
                </p>

                {/* Row 1: Personal Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Full Name</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <User className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.full_name}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, full_name: e.target.value }))}
                        placeholder="e.g. Prathamesh Mali"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Email</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.your_email}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, your_email: e.target.value }))}
                        placeholder="your@email.com"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Phone (with country code)</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.phone}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, phone: e.target.value }))}
                        placeholder="e.g. 7620537089"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">LinkedIn URL</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Link className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.linkedin_url}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, linkedin_url: e.target.value }))}
                        placeholder="https://linkedin.com/in/you"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Portfolio URL</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.portfolio_url}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, portfolio_url: e.target.value }))}
                        placeholder="https://your-portfolio.dev"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Role / Title</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Briefcase className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.your_role}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, your_role: e.target.value }))}
                        placeholder="e.g. Frontend Developer / Full Stack"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Years of Experience</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Sparkles className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.experience}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, experience: e.target.value }))}
                        placeholder="e.g. 2 years"
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Key Skills (comma separated)</label>
                    <div className="flex items-center gap-2 bg-[#15181D] border border-[#242930] rounded-lg px-2.5 py-2 focus-within:border-[#89295E]">
                      <Zap className="w-3 h-3 text-zinc-500 shrink-0" />
                      <input
                        value={localPrefs.key_skills}
                        onChange={(e) => setLocalPrefs(p => ({ ...p, key_skills: e.target.value }))}
                        placeholder="React.js, Next.js, TypeScript, Node.js..."
                        className="flex-1 bg-transparent text-xs text-zinc-200 outline-none font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Example Subject */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    Example Subject Line <span className="text-zinc-600 normal-case">(AI adapts [Role] from the job post)</span>
                  </label>
                  <input
                    value={localPrefs.example_subject}
                    onChange={(e) => setLocalPrefs(p => ({ ...p, example_subject: e.target.value }))}
                    placeholder="e.g. Application for [Role] Position - Prathamesh Mali"
                    className="w-full bg-[#15181D] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono outline-none focus:border-[#89295E] placeholder:text-zinc-600"
                  />
                </div>

                {/* Example Body */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    Example Email Body <span className="text-zinc-600 normal-case">(Your best cold email — AI uses this as style reference and adapts per job)</span>
                  </label>
                  <textarea
                    value={localPrefs.example_body}
                    onChange={(e) => setLocalPrefs(p => ({ ...p, example_body: e.target.value }))}
                    rows={8}
                    placeholder={`Hi [Recruiter Name],\n\nI hope this message finds you well.\n\nI am writing to apply for the [Role] position at [Company]. I have 2 years of experience in frontend development specializing in React.js, Next.js, and TypeScript...\n\n...\n\nBest regards,\nYour Name`}
                    className="w-full bg-[#15181D] border border-[#242930] rounded-lg p-3 text-xs text-zinc-300 font-sans leading-relaxed outline-none focus:border-[#89295E] resize-none placeholder:text-zinc-600"
                  />
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[9px] font-mono text-zinc-600">Saved to your account — synced across sessions</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await savePreferences(localPrefs);
                      if (ok) {
                        showNotification('✓ Email preferences saved!');
                        setShowPrefsPanel(false);
                      } else {
                        showNotification('Failed to save preferences. Check DB.');
                      }
                    }}
                    disabled={prefsSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono transition-all"
                  >
                    <Save className="w-3 h-3" />
                    <span>{prefsSaving ? 'Saving...' : 'Save Preferences'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Image Upload Section */}
          <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-3 shadow-md" onPaste={handleImagePaste}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                <ImageIcon className="w-3.5 h-3.5 text-[#ff8ac8]" />
                <span className="font-bold">Upload Job Post Images</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2329] hover:bg-[#282D35] text-[11px] font-mono text-zinc-300 transition-colors cursor-pointer">
                  <Upload className="w-3 h-3 text-[#ff8ac8]" />
                  <span>Upload Images</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {uploadedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllImages}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1F2329]"
                    title="Clear all images"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Image Previews Grid */}
            {imagePreviews.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={preview}
                      alt={`Uploaded ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-[#242930]"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#242930] rounded-lg p-8 text-center">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400 font-mono mb-1">
                  Upload screenshots or paste images (Ctrl+V)
                </p>
                <p className="text-[10px] text-zinc-600 font-sans">
                  Supports multiple images with job postings, recruiter info, or hiring announcements
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[10px] font-mono text-zinc-500">
                {uploadedImages.length > 0 
                  ? `${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''} ready for processing`
                  : 'No images uploaded yet'
                }
              </span>

              <button
                type="button"
                onClick={handleProcess}
                disabled={loading || imageLoading || uploadedImages.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono tracking-wide transition-all shadow-md active:scale-[0.98]"
              >
                {(loading || imageLoading) ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Images...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extract Emails from Images</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Bar: All Collected Emails Card (Images Tab) */}
          {savedImageCards.length > 0 && (() => {
            const validImageEmails = Array.from(
              new Set(savedImageCards.map(c => c.to_email?.trim()).filter((e): e is string => !!e && e.includes('@')))
            );
            const commaText = validImageEmails.join(', ');
            const linesText = validImageEmails.join('\n');
            const displayText = imageEmailFormat === 'comma' ? commaText : linesText;
            const mailtoBccUrl = validImageEmails.length > 0 ? `mailto:?bcc=${encodeURIComponent(commaText)}` : '';

            return (
              <div className="bg-[#15181D] border border-[#89295E]/40 rounded-xl overflow-hidden shadow-lg transition-all">
                {/* Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1A1D24] border-b border-[#242930]">
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
                    <Mail className="w-4 h-4 text-[#7FE7C4]" />
                    <span className="font-bold">Collected Image Emails:</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#7FE7C4]/20 text-[#7FE7C4] text-[10px] font-bold border border-[#7FE7C4]/30">
                      {validImageEmails.length} {validImageEmails.length === 1 ? 'Email' : 'Emails'}
                    </span>
                    <span className="text-zinc-500 text-[10px] hidden sm:inline">&bull; from {savedImageCards.length} cards</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!commaText) return;
                        navigator.clipboard.writeText(commaText);
                        setCopiedImageFormat('comma');
                        showNotification(`Copied ${validImageEmails.length} emails!`);
                        setTimeout(() => setCopiedImageFormat(null), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#89295E] hover:bg-[#a03672] text-white transition-all shadow-sm"
                    >
                      {copiedImageFormat === 'comma' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedImageFormat === 'comma' ? 'Copied!' : 'Copy All Emails'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowImageEmailsCard((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#ff8ac8]" />
                      <span>{showImageEmailsCard ? 'Hide Collection' : 'View Collection'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showImageEmailsCard ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Card Content */}
                {showImageEmailsCard && (
                  <div className="p-4 space-y-3 bg-[#0D0F12] border-t border-[#242930] animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242930] pb-2 font-mono text-[11px]">
                      {/* Format selector */}
                      <div className="flex bg-[#15181D] p-0.5 rounded-lg border border-[#242930]">
                        <button
                          type="button"
                          onClick={() => setImageEmailFormat('comma')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                            imageEmailFormat === 'comma' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Comma-Separated
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageEmailFormat('lines')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                            imageEmailFormat === 'lines' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Line-by-Line
                        </button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!displayText) return;
                            navigator.clipboard.writeText(displayText);
                            setCopiedImageFormat(imageEmailFormat);
                            showNotification(`Copied ${validImageEmails.length} emails (${imageEmailFormat})!`);
                            setTimeout(() => setCopiedImageFormat(null), 2000);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                            copiedImageFormat === imageEmailFormat
                              ? 'bg-[#7FE7C4] text-black'
                              : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930]'
                          }`}
                        >
                          {copiedImageFormat === imageEmailFormat ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                          <span>{copiedImageFormat === imageEmailFormat ? 'Copied!' : `Copy (${imageEmailFormat === 'comma' ? 'Comma' : 'Lines'})`}</span>
                        </button>

                        <a
                          href={mailtoBccUrl}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-sky-300 border border-[#242930] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                          <span>Open in Mail (BCC)</span>
                        </a>

                        <button
                          type="button"
                          onClick={async () => {
                            const batchTitle = `${new Date().getDate()} ${new Date().toLocaleDateString('en-US', { month: 'short' })} Image Emails`;
                            await addEmail(batchTitle, 'AI Extracted', commaText);
                            showNotification(`Saved "${batchTitle}" in Emails tab!`);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#89295E] hover:bg-[#a03672] text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Save to Emails Tab</span>
                        </button>

                        {(() => {
                          const unshared = getUnsharedItems('email', validImageEmails);
                          const isAllShared = validImageEmails.length > 0 && unshared.length === 0;
                          return (
                            <button
                              type="button"
                              onClick={async () => {
                                if (unshared.length === 0) {
                                  showNotification('✓ All emails from this list are already shared to Global Space!');
                                  return;
                                }
                                const title = `Image Extracted Emails (${unshared.length} New)`;
                                const res = await shareToGlobal('email', title, unshared);
                                if (res) {
                                  showNotification(`✓ Shared ${unshared.length} new email${unshared.length > 1 ? 's' : ''} to Global Space!`);
                                } else {
                                  showNotification('Failed to share to Global Space.');
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-[#1F2329] hover:bg-[#282D35] text-[#ff8ac8] border border-[#242930] transition-colors"
                            >
                              <Globe className="w-3 h-3 text-[#ff8ac8]" />
                              <span>
                                {isAllShared
                                  ? '✓ All Shared to Global'
                                  : unshared.length < validImageEmails.length
                                  ? `Share ${unshared.length} New to Global`
                                  : 'Share to Global Space'}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={displayText}
                      rows={Math.min(8, Math.max(3, validImageEmails.length))}
                      className="w-full bg-[#15181D] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all focus:border-[#89295E]"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Generated Image Cards (similar to job_applications but separate) */}
          <div className="space-y-4">
            {imageCardsLoading && savedImageCards.length === 0 ? (
              <div className="flex items-center justify-center py-20 font-mono text-xs text-zinc-500">
                <span className="animate-pulse">&gt; loading_image_applications...</span>
              </div>
            ) : savedImageCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-2xl bg-[#15181D]/30 max-w-2xl mx-auto space-y-2">
                <ImageIcon className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="text-xs text-zinc-400 font-bold font-mono">
                  No image-based applications yet
                </p>
                <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                  Upload job posting images above and click "Extract Emails from Images" to create application cards!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {savedImageCards.map((card) => {
                  const isCompleted = card.status === 'completed';
                  const isEmailCopied = copiedState?.id === card.id && copiedState.type === 'email';
                  const isSubCopied = copiedState?.id === card.id && copiedState.type === 'subject';
                  const isBodyCopied = copiedState?.id === card.id && copiedState.type === 'body';
                  const isAllCopied = copiedState?.id === card.id && copiedState.type === 'all';

                  const mailtoUrl = `mailto:${card.to_email}?subject=${encodeURIComponent(card.subject || '')}&body=${encodeURIComponent(card.body || '')}`;

                  return (
                    <div
                      key={card.id}
                      className={`bg-[#15181D] border rounded-2xl p-4.5 space-y-3.5 shadow-md flex flex-col justify-between transition-all duration-150 ${
                        isCompleted
                          ? 'border-[#242930] opacity-80 hover:opacity-100'
                          : 'border-[#89295E]/40 hover:border-[#89295E]/80'
                      }`}
                    >
                      {/* Top Header: Company, Recruiter, Role, Status Button */}
                      <div className="space-y-1.5 pb-2.5 border-b border-[#242930]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className={`text-sm font-bold truncate ${isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-100'}`}>
                              <span>{card.role || 'Unknown Role'}</span>
                              {card.company && (
                                <span className="text-[#ff8ac8] font-normal ml-1.5">@ {card.company}</span>
                              )}
                            </h3>
                            {card.recruiter_name && (
                              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                Recruiter: <span className="text-zinc-200">{card.recruiter_name}</span>
                              </p>
                            )}
                            {card.source_image && (
                              <p className="text-[9px] font-mono text-zinc-500 mt-0.5">
                                <ImageIcon className="w-2 h-2 inline mr-1" />
                                From image
                              </p>
                            )}
                          </div>

                          {/* Status Toggle Badge */}
                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => toggleImageStatus(card.id)}
                              className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all border ${
                                isCompleted
                                  ? 'bg-[#7FE7C4]/15 text-[#7FE7C4] border-[#7FE7C4]/30 hover:bg-[#7FE7C4]/25'
                                  : 'bg-[#E8B54D]/15 text-[#E8B54D] border-[#E8B54D]/30 hover:bg-[#E8B54D]/25'
                              }`}
                              title="Click to toggle status"
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-[#7FE7C4]" />
                                  <span>Done</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3 h-3 text-[#E8B54D]" />
                                  <span>Pending</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setCardToDelete({ id: card.id, title: `${card.role || 'Job'} @ ${card.company || card.to_email}` })}
                              className="p-1 hover:bg-red-950/40 rounded text-zinc-500 hover:text-red-400 transition-colors"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Location & Skills tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {card.location && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] text-[10px] font-mono text-zinc-400">
                              <MapPin className="w-3 h-3 text-[#E8B54D]" />
                              {card.location}
                            </span>
                          )}
                          {card.skills && card.skills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-[#0D0F12] border border-[#242930] text-[9px] font-mono text-zinc-400"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 1. Target Email Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Send To Email:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#7FE7C4] shrink-0" />
                          <input
                            value={card.to_email || ''}
                            onChange={(e) => updateImageCardInDb(card.id, { to_email: e.target.value })}
                            className="flex-1 bg-transparent text-xs font-mono text-[#7FE7C4] font-bold outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.to_email, card.id, 'email', 'Email Address')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isEmailCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy email address"
                          >
                            {isEmailCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isEmailCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional: WhatsApp Outreach if phone was extracted */}
                      {card.phone && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Extracted WhatsApp Contact:
                          </label>
                          <div className="flex items-center justify-between bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                              <span className="font-mono text-xs text-[#25D366] font-bold">+{card.phone}</span>
                            </div>
                            <a
                              href={buildWhatsAppLink(card.phone, waTemplate || DEFAULT_WHATSAPP_TEMPLATE)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-[10px] font-mono font-bold transition-all"
                            >
                              <span>Chat on WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 2. Subject Line Field with Copy Button */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                          Subject Line:
                        </label>
                        <div className="flex items-center gap-2 bg-[#0D0F12] border border-[#242930] rounded-lg px-2.5 py-1.5">
                          <input
                            value={card.subject || ''}
                            onChange={(e) => updateImageCardInDb(card.id, { subject: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-sans text-zinc-200 outline-none border-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.subject, card.id, 'subject', 'Subject Line')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-all shrink-0 ${
                              isSubCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#1F2329] hover:bg-[#282D35] text-zinc-300 border border-[#242930]'
                            }`}
                            title="Copy subject line"
                          >
                            {isSubCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#ff8ac8]" />}
                            <span>{isSubCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Tailored Email Body with Copy Button */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                            Personalized Pitch Body:
                          </label>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(card.body, card.id, 'body', 'Email Body')}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              isBodyCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'text-zinc-400 hover:text-zinc-200 bg-[#1F2329]'
                            }`}
                            title="Copy full body"
                          >
                            {isBodyCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-[#7FE7C4]" />}
                            <span>{isBodyCopied ? 'Body Copied!' : 'Copy Body'}</span>
                          </button>
                        </div>

                        <textarea
                          value={card.body || ''}
                          onChange={(e) => updateImageCardInDb(card.id, { body: e.target.value })}
                          rows={12}
                          className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-300 font-sans leading-relaxed outline-none focus:border-[#89295E] resize-none"
                        />
                      </div>

                      {/* Card Footer: Quick Actions */}
                      <div className="pt-2 border-t border-[#242930] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                        {/* Open in Mail app */}
                        <a
                          href={mailtoUrl}
                          onClick={() => { if (!isCompleted) toggleImageStatus(card.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930] hover:border-zinc-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                          <span>Open in Mail</span>
                        </a>

                        <div className="flex items-center gap-2">
                          {/* Copy All (Email + Sub + Body) */}
                          <button
                            type="button"
                            onClick={() => {
                              const fullText = `To: ${card.to_email}\nSubject: ${card.subject}\n\n${card.body}`;
                              copyToClipboard(fullText, card.id, 'all', 'Full Email Package');
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                              isAllCopied
                                ? 'bg-[#7FE7C4] text-black'
                                : 'bg-[#89295E] hover:bg-[#a03672] text-white'
                            }`}
                          >
                            {isAllCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>All Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODE 2: BULK EMAIL & PHONE EXTRACTOR (ORIGINAL PARSER) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'extractor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Raw Text Input Area */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                  <FileText className="w-3.5 h-3.5 text-[#89295E]" />
                  <span className="font-bold">Raw Unstructured Text (Emails &amp; Phones)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1F2329] hover:bg-[#282D35] text-[11px] font-mono text-zinc-300 transition-colors"
                  >
                    <ClipboardPaste className="w-3 h-3 text-[#89295E]" />
                    <span>Paste</span>
                  </button>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawText('');
                        setExtractedEmails([]);
                        setExtractedPhones([]);
                        setExtractedEntries([]);
                        setCommaSeparated('');
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1F2329]"
                      title="Clear text"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={rawText || ''}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste raw names, emails, phone numbers, LinkedIn dumps, or candidate lists here..."
                rows={14}
                className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] resize-none font-mono leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-[10px] font-mono text-zinc-500">
                  {rawText ? `${rawText.split('\n').length} lines pasted` : 'Ready for input'}
                </span>

                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={loading || !rawText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold font-mono tracking-wide transition-all shadow-md active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Zap className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Results & Export */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#15181D] border border-[#242930] rounded-xl p-4 space-y-4 shadow-md min-h-[460px] flex flex-col justify-between">
              
              {/* Header with Stats & Views */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#242930] pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-[#89295E] font-bold">&gt;</span>
                    <span className="text-zinc-200 font-bold">Results:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7FE7C4]/20 text-[#7FE7C4] border border-[#7FE7C4]/30">
                      {extractedEmails.length} emails
                    </span>
                    {extractedPhones.length > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30">
                        {extractedPhones.length} phones
                      </span>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  {(extractedEmails.length > 0 || extractedPhones.length > 0) && (
                    <div className="flex bg-[#1F2329] p-0.5 rounded border border-[#242930] font-mono text-[10px]">
                      <button
                        onClick={() => setViewMode('comma')}
                        className={`px-2.5 py-1 rounded font-bold ${
                          viewMode === 'comma' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Emails
                      </button>
                      {extractedPhones.length > 0 && (
                        <button
                          onClick={() => setViewMode('whatsapp')}
                          className={`px-2.5 py-1 rounded font-bold ${
                            viewMode === 'whatsapp' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => setViewMode('table')}
                        className={`px-2.5 py-1 rounded font-bold ${
                          viewMode === 'table' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Table
                      </button>
                      <button
                        onClick={() => setViewMode('lines')}
                        className={`px-2.5 py-1 rounded font-bold ${
                          viewMode === 'lines' ? 'bg-[#89295E] text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Lines
                      </button>
                    </div>
                  )}
                </div>

                {/* Extraction Content Display */}
                {extractedEmails.length === 0 && extractedPhones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#242930] rounded-xl font-mono bg-[#0D0F12]/50 space-y-2">
                    <Sparkles className="w-8 h-8 text-zinc-600 mb-1 animate-pulse" />
                    <p className="text-xs text-zinc-400 font-bold">No contacts extracted yet</p>
                    <p className="text-[11px] text-zinc-600 max-w-xs font-sans">
                      Paste raw text on the left and click "Extract with AI".
                    </p>
                  </div>
                ) : viewMode === 'comma' ? (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Comma-separated emails:
                    </div>
                    <textarea
                      readOnly
                      value={commaSeparated || ''}
                      rows={10}
                      className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-[#7FE7C4] font-mono leading-relaxed outline-none select-all"
                    />
                  </div>
                ) : viewMode === 'whatsapp' ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      Extracted WhatsApp Outreach Contacts:
                    </div>
                    {extractedPhones.map((phone, idx) => {
                      const waLink = buildWhatsAppLink(phone, waTemplate || DEFAULT_WHATSAPP_TEMPLATE);
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-[#0D0F12] border border-[#242930] rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                            <span className="font-mono text-xs text-zinc-200 font-bold">+{phone}</span>
                          </div>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-1 rounded bg-[#25D366] hover:bg-[#20ba5a] text-black text-[11px] font-bold font-mono transition-colors shrink-0"
                          >
                            <span>Chat</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="max-h-[300px] overflow-y-auto border border-[#242930] rounded-lg bg-[#0D0F12]">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="sticky top-0 bg-[#1F2329] border-b border-[#242930] text-[10px] font-mono uppercase text-zinc-400">
                        <tr>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Email / Phone</th>
                          <th className="py-2 px-3">Company</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#242930]/60 font-mono text-[11px]">
                        {extractedEntries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-[#15181D]/80 transition-colors">
                            <td className="py-2 px-3 text-zinc-200 font-sans">{entry.name || '—'}</td>
                            <td className="py-2 px-3 font-mono">
                              {entry.email && <div className="text-[#7FE7C4] select-all">{entry.email}</div>}
                              {entry.phone && <div className="text-[#25D366] select-all">+{entry.phone}</div>}
                            </td>
                            <td className="py-2 px-3 text-zinc-400 font-sans">{entry.company || '—'}</td>
                            <td className="py-2 px-3 text-right">
                              {entry.phone ? (
                                <a
                                  href={buildWhatsAppLink(entry.phone, waTemplate || DEFAULT_WHATSAPP_TEMPLATE)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-[#25D366] hover:underline"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>
                              ) : entry.linkedin ? (
                                <a
                                  href={entry.linkedin}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline"
                                >
                                  <Globe className="w-3 h-3" />
                                  <span>LinkedIn</span>
                                </a>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <textarea
                    readOnly
                    value={extractedEmails.join('\n') || ''}
                    rows={10}
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg p-3 text-xs text-zinc-200 font-mono leading-relaxed outline-none select-all"
                  />
                )}
              </div>

              {/* Action Buttons */}
              {(extractedEmails.length > 0 || extractedPhones.length > 0) && (
                <div className="space-y-3 pt-3 border-t border-[#242930]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                    {extractedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(commaSeparated, 'bulk', 'email', 'Comma Emails')}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#1F2329] hover:bg-[#282D35] text-zinc-200 border border-[#242930]"
                      >
                        <Copy className="w-4 h-4 text-[#89295E]" />
                        <span>Copy Comma Emails</span>
                      </button>
                    )}

                    {extractedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const batchTitle = `${new Date().getDate()} ${new Date().toLocaleDateString('en-US', { month: 'short' })} Batch`;
                          await addEmail(batchTitle, 'AI Extracted', commaSeparated);
                          showNotification(`Saved "${batchTitle}" in Emails tab!`);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#89295E] hover:bg-[#a03672] text-white"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Save to Emails Tab</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Job Card */}
      <ConfirmModal
        isOpen={!!cardToDelete}
        title="Delete Job Application Card"
        message={`Delete application card for "${cardToDelete?.title}"? This action cannot be undone.`}
        onConfirm={() => {
          if (cardToDelete) {
            deleteJobCardFromDb(cardToDelete.id);
            setCardToDelete(null);
            showNotification('Application card deleted');
          }
        }}
        onCancel={() => setCardToDelete(null)}
      />

      {/* Groq API Key Modal */}
      {showKeyModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowKeyModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-[#E8B54D]" />
                <span>Configure Groq API Key</span>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Groq API Key (gsk_...)
              </label>
              <input
                type="password"
                value={apiKey || ''}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveApiKey(apiKey)}
                className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] text-white text-xs font-bold tracking-wide"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Job Application Card Modal */}
      {isShareModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <Share2 className="w-4 h-4 text-[#ff8ac8]" />
                <span>Share Cold Outreach Card</span>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Sharing card for: <strong className="text-zinc-200 font-mono">{shareCardTitle}</strong>. 
              Anyone with the generated <strong className="text-[#ff8ac8]">Share Key</strong> and passcode can import a copy of this card.
            </div>

            {!shareKeyResult ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                    Set Passcode / Password
                  </label>
                  <input
                    type="text"
                    value={sharePasscode}
                    onChange={(e) => setSharePasscode(e.target.value)}
                    placeholder="e.g. 1234 or team_pass"
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] select-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(false)}
                    className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={shareLoading || !sharePasscode.trim()}
                    onClick={async () => {
                      setShareLoading(true);
                      const key = await shareApplication(shareCardId, sharePasscode);
                      setShareLoading(false);
                      if (key) {
                        setShareKeyResult(key);
                        showNotification('Share link generated!');
                      } else {
                        showNotification('Failed to generate share link.');
                      }
                    }}
                    className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide"
                  >
                    {shareLoading ? 'Generating...' : 'Generate Share Code'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0D0F12] border border-[#242930] p-3 rounded-lg space-y-2.5">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Share Key</label>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#7FE7C4] font-bold font-mono select-all">{shareKeyResult}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareKeyResult);
                            showNotification('Share Key copied!');
                          } catch {}
                        }}
                        className="px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] hover:text-zinc-200 text-[10px] text-zinc-400 transition-colors"
                      >
                        Copy Key
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Required Passcode</label>
                    <span className="text-xs text-zinc-300 font-bold font-mono">{sharePasscode}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(false)}
                    className="px-4 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Share Job Application Cards Modal */}
      {isBulkShareModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsBulkShareModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <Share2 className="w-4 h-4 text-[#ff8ac8]" />
                <span>Share Job Cards Bundle</span>
              </div>
              <button
                onClick={() => setIsBulkShareModalOpen(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Sharing a bundle of <strong className="text-zinc-200 font-mono">{selectedIds.size} job application cards</strong>. 
              Anyone with the generated <strong className="text-[#ff8ac8]">Share Key</strong> and passcode can import copies of these cards.
            </div>

            {!bulkShareKeyResult ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                    Set Passcode / Password
                  </label>
                  <input
                    type="text"
                    value={bulkSharePasscode}
                    onChange={(e) => setBulkSharePasscode(e.target.value)}
                    placeholder="e.g. 1234 or team_pass"
                    className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] select-all font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => setIsBulkShareModalOpen(false)}
                    className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bulkShareLoading || !bulkSharePasscode.trim()}
                    onClick={handleBulkShare}
                    className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide"
                  >
                    {bulkShareLoading ? 'Sharing...' : 'Share Bundle'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#0D0F12] border border-[#242930] p-3 rounded-lg space-y-2.5">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Share Key</label>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#7FE7C4] font-bold font-mono select-all">{bulkShareKeyResult}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(bulkShareKeyResult);
                            showNotification('Share Key copied!');
                          } catch {}
                        }}
                        className="px-2 py-0.5 rounded bg-[#1F2329] border border-[#242930] hover:text-zinc-200 text-[10px] text-zinc-400 transition-colors"
                      >
                        Copy Key
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Required Passcode</label>
                    <span className="text-xs text-zinc-300 font-bold font-mono">{bulkSharePasscode}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-[#242930]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkShareModalOpen(false);
                      clearSelection();
                      setIsSelectionMode(false);
                    }}
                    className="px-4 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Shared Job Application Card Modal */}
      {isImportModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#15181D] border border-[#242930] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-mono"
          >
            <div className="flex items-center justify-between border-b border-[#242930] pb-3">
              <div className="flex items-center gap-2 text-xs text-zinc-200 font-bold uppercase tracking-wider">
                <Download className="w-4 h-4 text-[#ff8ac8]" />
                <span>Import Shared outreach Card</span>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Enter the Share Key and passcode to import shared job cards (single card or bundle).
            </p>

            {importError && (
              <div className="p-2 bg-red-950/30 border border-red-900/50 rounded-lg text-[10px] text-red-400">
                Error: {importError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Share Key (e.g. app-xxxxxx)
                </label>
                <input
                  type="text"
                  value={importShareKey}
                  onChange={(e) => setImportShareKey(e.target.value)}
                  placeholder="app-xxxxxx"
                  className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Enter Passcode
                </label>
                <input
                  type="password"
                  value={importPasscode}
                  onChange={(e) => setImportPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0D0F12] border border-[#242930] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#89295E] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242930]">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1F2329]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importLoading || !importShareKey.trim() || !importPasscode.trim()}
                  onClick={async () => {
                    setImportLoading(true);
                    setImportError('');
                    
                    // Try bundle import first (for new bulk sharing)
                    let result = await importJobApplications(importShareKey, importPasscode);
                    
                    // If bundle import fails, try single card import (for old sharing)
                    if (!result.success) {
                      const singleResult = await importApplication(importShareKey, importPasscode);
                      if (singleResult) {
                        result = { success: true, ownerName: 'Unknown', count: 1 };
                      }
                    }
                    
                    setImportLoading(false);
                    if (result.success) {
                      showNotification(`✓ Imported ${result.count || 1} card${(result.count || 1) > 1 ? 's' : ''} shared by ${result.ownerName || 'Unknown'}!`);
                      setIsImportModalOpen(false);
                    } else {
                      setImportError('Invalid Share Key, incorrect passcode, or the cards were deleted.');
                    }
                  }}
                  className="px-4 py-1.5 rounded bg-[#89295E] hover:bg-[#a03672] disabled:opacity-40 text-white text-xs font-bold tracking-wide"
                >
                  {importLoading ? 'Importing...' : 'Import outreach Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
