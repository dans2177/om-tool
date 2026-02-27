'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, ZoomIn, X, ArrowLeft, MapPin, ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, Copy, Check } from 'lucide-react';
import { useOM } from '@/context/OMContext';
import type { OMData, OMAgent } from '@/types';
import { RECORD_TYPES } from '@/types';
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false });

/* ── Collapsible Section ── */
const SECTION_COLORS: Record<string, string> = {
  'Property Info': 'border-l-blue-500',
  'Address': 'border-l-emerald-500',
  'SEO': 'border-l-purple-500',
  'Financials': 'border-l-amber-500',
  'Size & Dates': 'border-l-cyan-500',
  'Occupancy': 'border-l-orange-500',
  'Lease Info': 'border-l-green-500',
  'HubSpot Email': 'border-l-orange-400',
  'Broker of Record': 'border-l-rose-500',
  'Descriptions': 'border-l-indigo-500',
  'LoopNet Highlights': 'border-l-lime-500',
  'LoopNet Tags': 'border-l-teal-500',
  'Classification': 'border-l-fuchsia-500',
  'Audit Trail': 'border-l-slate-400',
  'Leasing Details': 'border-l-violet-500',
};

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const baseTitle = title.replace(/\s*\(.*\)$/, '');
  const accent = SECTION_COLORS[baseTitle] || 'border-l-gray-300';
  return (
    <div className={`border border-gray-200 border-l-4 ${accent} rounded-xl overflow-hidden bg-white shadow-sm`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/60 hover:bg-gray-100/80 transition-colors"
      >
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-3 py-2.5 space-y-2.5">{children}</div>}
    </div>
  );
}

/* ── Field helpers ── */
function Field({ label, value, onChange, type = 'text', step, fullWidth, readonly, placeholder }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; step?: string; fullWidth?: boolean; readonly?: boolean; placeholder?: string;
}) {
  const [copied, setCopied] = useState(false);
  const displayVal = value ?? '';
  const hasValue = displayVal !== '' && displayVal !== null;
  const copyField = () => {
    navigator.clipboard.writeText(String(displayVal));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</label>
      <div className="relative group">
        <input
          type={type}
          step={step}
          value={displayVal}
          onChange={(e) => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          readOnly={readonly}
          placeholder={placeholder}
          className={`w-full border border-gray-200 rounded-md px-2.5 py-1 text-[13px] pr-7 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors ${readonly ? 'bg-gray-50 text-gray-500' : 'hover:border-gray-300'}`}
        />
        {hasValue && (
          <button
            type="button"
            onClick={copyField}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-gray-300 hover:text-gray-600"
            title="Copy"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, readonly, autoSize }: {
  label: string; value: any; onChange: (v: any) => void; rows?: number; readonly?: boolean; autoSize?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const displayVal = value ?? '';
  const hasValue = displayVal !== '';
  const taRef = useRef<HTMLTextAreaElement>(null);
  const copyField = () => {
    navigator.clipboard.writeText(String(displayVal));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  useEffect(() => {
    if (autoSize && taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [displayVal, autoSize]);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
        {hasValue && (
          <button type="button" onClick={copyField} className="text-gray-300 hover:text-gray-600 transition-colors" title="Copy">
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
      <textarea
        ref={taRef}
        value={displayVal}
        onChange={(e) => onChange(e.target.value)}
        rows={autoSize ? 1 : rows}
        readOnly={readonly}
        className={`w-full border border-gray-200 rounded-md px-2.5 py-1 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none transition-colors ${readonly ? 'bg-gray-50 text-gray-500' : 'hover:border-gray-300'} ${autoSize ? 'overflow-hidden' : ''}`}
      />
    </div>
  );
}

/* ── Copy button helper ── */
function CopyBtn({ text, className: cx }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={doCopy} className={`text-gray-300 hover:text-gray-600 transition-colors ${cx ?? ''}`} title="Copy">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const {
    omData, setOmData,
    pdfBlobUrl,
    geo,
    brokerOfRecord,
    lockedPdfUrl,
    finalImages,
    lightboxImg, setLightboxImg,
    resetAll,
    loading,
    saveSnapshot,
  } = useOM();

  const [descTab, setDescTab] = useState<'matthews' | 'third_parties'>('matthews');
  const [selectedDownloads, setSelectedDownloads] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<'files' | 'pdf'>('files');
  const [leftPct, setLeftPct] = useState(66);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSaved = useRef(false);

  // Auto-save snapshot on first load
  useEffect(() => {
    if (omData && !hasSaved.current) {
      hasSaved.current = true;
      saveSnapshot();
    }
  }, [omData, saveSnapshot]);

  /* ── Download filename builder ── */
  const buildBaseName = () => {
    const parts: string[] = [];
    if (omData?.title) parts.push(omData.title);
    const num = omData?.address?.street_number;
    const name = omData?.address?.street_name;
    if (num || name) parts.push([num, name].filter(Boolean).join(' '));
    const city = omData?.address?.city;
    const st = omData?.address?.state_abbr;
    if (city || st) {
      parts.push('- ' + [city, st].filter(Boolean).join(' '));
    }
    return parts.join(' ').replace(/[^\x20-\x7E]/g, '').replace(/[/\\:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'OM';
  };
  const omBaseName = buildBaseName();

  // Deep-update helper for nested OMData
  const update = useCallback((path: string, value: any) => {
    if (!omData) return;
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    const parts = path.split('.');
    let obj: any = copy;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (/^\d+$/.test(parts[i + 1])) {
        // array index next
      }
      if (/^\d+$/.test(key)) {
        obj = obj[Number(key)];
      } else {
        obj = obj[key];
      }
    }
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      obj[Number(last)] = value;
    } else {
      obj[last] = value;
    }
    setOmData(copy);
  }, [omData, setOmData]);

  /** Compute meta description from current data (pure derived value, no state mutation) */
  const computedMetaDesc = useMemo(() => {
    if (!omData) return '';
    const firstAgent = (omData.listing_agents || []).find(
      a => !brokerOfRecord || a.name?.toLowerCase().trim() !== brokerOfRecord.name.toLowerCase().trim()
    );
    const agentName = firstAgent?.name || '';
    const title = omData.title || '';
    const city = omData.address?.city || '';
    const state = omData.address?.state_abbr || '';
    const location = [city, state].filter(Boolean).join(', ');
    const type = omData.saleOrLease || 'for-sale';
    if (type === 'for-lease') {
      return `Now Leasing \u2013 ${title}${location ? ` For Lease in ${location}` : ''}. Listed by ${agentName}. Explore this property and Download the Leasing Brochure today.`;
    } else if (type === 'for-auction') {
      return `Now at Auction \u2013 ${title}${location ? ` in ${location}` : ''}. Listed by ${agentName}. Explore this property and Download the Offering Memorandum today.`;
    }
    return `Now Available \u2013 ${title}${location ? ` in ${location}` : ''}. Listed by ${agentName}. Explore this property and Download the Offering Memorandum today.`;
  }, [omData, brokerOfRecord]);

  // Sync the computed meta description into omData whenever it changes
  useEffect(() => {
    if (!omData || !computedMetaDesc) return;
    if (computedMetaDesc !== omData.seo?.meta_description) {
      // Use functional update via direct mutation on a copy to avoid stale closure
      setOmData(prev => {
        if (!prev) return prev;
        const copy = JSON.parse(JSON.stringify(prev)) as OMData;
        copy.seo.meta_description = computedMetaDesc;
        return copy;
      });
    }
  }, [computedMetaDesc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if no data (in useEffect to avoid setState-during-render)
  useEffect(() => {
    if (!omData && !loading) {
      router.push('/');
    }
  }, [omData, loading, router]);

  if (!omData) return null;

  // Column drag-resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(80, Math.max(30, pct)));
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startNewOM = () => {
    resetAll();
    router.push('/');
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      // Fetch as blob so we get a same-origin object URL — the browser
      // ignores the `download` attribute on cross-origin hrefs (Vercel Blob CDN).
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      // Append to DOM — some Windows browsers require this for the
      // `download` attribute / programmatic click to work properly.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Clean up after a short delay so the download can start
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch {
      // Fallback: still force a download via a DOM-attached anchor
      // instead of window.open (which opens a new tab on Windows).
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const addAgent = () => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    copy.listing_agents.push({ name: '', email: '', license_number: '', phone: '', role: '' });
    setOmData(copy);
  };

  const removeAgent = (idx: number) => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    copy.listing_agents.splice(idx, 1);
    setOmData(copy);
  };

  /** Get the visible (non-BOR) agent indices */
  const getVisibleAgentIndices = () =>
    (omData.listing_agents || []).map((a, i) => ({ a, i }))
      .filter(({ a }) => !brokerOfRecord || a.name?.toLowerCase().trim() !== brokerOfRecord.name.toLowerCase().trim())
      .map(({ i }) => i);

  const moveAgentUp = (origIdx: number) => {
    const visible = getVisibleAgentIndices();
    const pos = visible.indexOf(origIdx);
    if (pos <= 0) return;
    const swapWith = visible[pos - 1];
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    [copy.listing_agents[swapWith], copy.listing_agents[origIdx]] = [copy.listing_agents[origIdx], copy.listing_agents[swapWith]];
    setOmData(copy);
  };

  const moveAgentDown = (origIdx: number) => {
    const visible = getVisibleAgentIndices();
    const pos = visible.indexOf(origIdx);
    if (pos < 0 || pos >= visible.length - 1) return;
    const swapWith = visible[pos + 1];
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    [copy.listing_agents[origIdx], copy.listing_agents[swapWith]] = [copy.listing_agents[swapWith], copy.listing_agents[origIdx]];
    setOmData(copy);
  };

  const updateAgent = (idx: number, field: keyof OMAgent, value: string) => {
    update(`listing_agents.${idx}.${field}`, value);
  };

  const updateMultiSiteVariant = (site: string, value: string) => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    const variant = copy.descriptions.public_multi_site_variants.find(v => v.site === site);
    if (variant) variant.value = value;
    setOmData(copy);
  };

  const removeLoopNetTag = (idx: number) => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    copy.loopnet.highlights_tags.splice(idx, 1);
    copy.loopnet.formatted_tags_string = copy.loopnet.highlights_tags.join(', ');
    setOmData(copy);
  };

  const addLoopNetTag = () => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    if (copy.loopnet.highlights_tags.length < 6) {
      copy.loopnet.highlights_tags.push('');
      copy.loopnet.formatted_tags_string = copy.loopnet.highlights_tags.join(', ');
      setOmData(copy);
    }
  };

  const updateLoopNetTag = (idx: number, value: string) => {
    const copy = JSON.parse(JSON.stringify(omData)) as OMData;
    copy.loopnet.highlights_tags[idx] = value.slice(0, 50);
    copy.loopnet.formatted_tags_string = copy.loopnet.highlights_tags.join(', ');
    setOmData(copy);
  };

  return (
    <>
      <div className="px-3 max-w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 -mx-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
          <button
            onClick={startNewOM}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">New OM</span>
          </button>
          <div className="text-center min-w-0">
            {omData.title && <h2 className="text-sm font-bold text-gray-800 truncate">{omData.title}</h2>}
            {omData.address?.full_address && (
              <p className="text-[11px] text-gray-400 truncate">{omData.address.full_address}</p>
            )}
          </div>
          <div className="w-16" />
        </div>

        <div ref={containerRef} className="flex flex-col lg:flex-row gap-3">
          {/* ═══════════ Left: Property Details ═══════════ */}
          <div className="space-y-2 min-w-0" style={{ flex: `0 0 ${leftPct}%` }}>

            {/* ── Property Info ── */}
            <Section title="Property Info" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Title" value={omData.title} onChange={(v) => update('title', v)} fullWidth />
                <Field label="SEO Title (auto)" value={`${omData.title || `${omData.address?.street_number ?? ''} ${omData.address?.street_name ?? ''}`.trim() || ''} - ${[omData.address?.city, omData.address?.state_abbr].filter(Boolean).join(', ')} | MATTHEWS`} onChange={() => {}} fullWidth readonly />
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Record Type</label>
                  <select
                    value={omData.record_type}
                    onChange={(e) => update('record_type', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-300 transition-colors"
                  >
                    {RECORD_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Sale or Lease</label>
                  <select
                    value={omData.saleOrLease}
                    onChange={(e) => update('saleOrLease', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-300 transition-colors"
                  >
                    <option value="for-sale">For Sale</option>
                    <option value="for-lease">For Lease</option>
                    <option value="for-auction">For Auction</option>
                  </select>
                </div>
                <Field label="Auction Site Link (optional)" value={omData.auction_link} onChange={(v) => update('auction_link', v)} fullWidth placeholder="https://auction-site.com/listing" />
              </div>
              <Field label="Tenants" value={(omData.tenants || []).join(', ')} onChange={(v: string) => update('tenants', v.split(',').map((s: string) => s.trim()).filter(Boolean))} fullWidth />
            </Section>

            {/* ── Address ── */}
            <Section title="Address" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Street Address</label>
                  <input
                    value={`${omData.address?.street_number ?? ''} ${omData.address?.street_name ?? ''}`.trim()}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/^(\S+)\s+(.*)$/);
                      if (match) {
                        const copy = JSON.parse(JSON.stringify(omData)) as OMData;
                        copy.address.street_number = match[1];
                        copy.address.street_name = match[2];
                        setOmData(copy);
                      } else {
                        update('address.street_number', val);
                        update('address.street_name', '');
                      }
                    }}
                    placeholder="e.g. 123 Main Street"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
                <Field label="Street #" value={omData.address?.street_number} onChange={(v) => update('address.street_number', v)} />
                <Field label="Street Name" value={omData.address?.street_name} onChange={(v) => update('address.street_name', v)} />
                <Field label="City" value={omData.address?.city} onChange={(v) => update('address.city', v)} />
                <Field label="State" value={omData.address?.state_abbr} onChange={(v) => update('address.state_abbr', v)} />
                <Field label="Zip" value={omData.address?.zip} onChange={(v) => update('address.zip', v)} />
                <Field label="Full Address" value={omData.address?.full_address} onChange={(v) => update('address.full_address', v)} fullWidth />
                {geo && (
                  <div className="col-span-2 flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-500 font-medium">Lat:</span>
                      <span className="text-sm font-mono text-gray-700">{geo.lat.toFixed(6)}</span>
                      <CopyBtn text={String(geo.lat)} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-500 font-medium">Lng:</span>
                      <span className="text-sm font-mono text-gray-700">{geo.lng.toFixed(6)}</span>
                      <CopyBtn text={String(geo.lng)} />
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] text-gray-400">Copy both</span>
                      <CopyBtn text={`${geo.lat}, ${geo.lng}`} />
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── SEO ── */}
            <Section title="SEO" defaultOpen>
              <div className="space-y-2.5">
                <Field label="SEO Title" value={omData.seo?.seo_title} onChange={(v) => update('seo.seo_title', v)} fullWidth />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex-1">Slug</label>
                    {omData.seo?.slug && <CopyBtn text={omData.seo.slug} />}
                  </div>
                  <input
                    value={omData.seo?.slug ?? ''}
                    onChange={(e) => update('seo.slug', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-[13px] font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 hover:border-gray-300 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block">Meta Description <span className="text-gray-300 font-normal">(auto-generated from agents)</span></label>
                  <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-2 leading-relaxed min-h-[3rem]">
                    {computedMetaDesc || <span className="text-gray-400 italic">Will populate from title, agents &amp; type...</span>}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Financials ── */}
            <Section title="Financials" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price" value={omData.financials?.price} onChange={(v) => update('financials.price', v)} type="number" />
                <Field label="Price Display" value={omData.financials?.price_display} onChange={(v) => update('financials.price_display', v)} />
                <Field label="Cap Rate %" value={omData.financials?.cap_rate_percent} onChange={(v) => update('financials.cap_rate_percent', v)} type="number" step="0.01" />
                <Field label="NOI (Annual)" value={omData.financials?.noi_annual} onChange={(v) => update('financials.noi_annual', v)} type="number" />
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Price/SF</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={omData.financials?.price_per_sf ?? ''}
                      onChange={(e) => update('financials.price_per_sf', e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    {omData.financials?.price && omData.size?.building_sf_gross && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md whitespace-nowrap">
                        auto: ${(omData.financials.price / omData.size.building_sf_gross).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Size & Dates ── */}
            <Section title="Size & Dates" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Building SF (Gross)" value={omData.size?.building_sf_gross} onChange={(v) => update('size.building_sf_gross', v)} type="number" />
                <Field label="Lot Size (Acres)" value={omData.size?.lot_size_acres} onChange={(v) => update('size.lot_size_acres', v)} type="number" step="0.01" />
                <Field label="Units / Keys" value={omData.size?.units} onChange={(v) => update('size.units', v)} type="number" placeholder="e.g. 200" />
                <Field label="Year Built" value={omData.year_built} onChange={(v) => update('year_built', v)} type="number" />
                <Field label="Year Renovated" value={omData.year_renovated} onChange={(v) => update('year_renovated', v)} type="number" />
                <Field label="Zoning" value={omData.zoning} onChange={(v) => update('zoning', v)} />
              </div>
            </Section>

            {/* ── Occupancy ── */}
            <Section title="Occupancy" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Occupancy %" value={omData.occupancy_rate_percent} onChange={(v) => update('occupancy_rate_percent', v)} type="number" step="0.1" />
              </div>
            </Section>

            {/* ── Lease Info ── */}
            <Section title="Lease Info" defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lease Type" value={omData.lease?.lease_type} onChange={(v) => update('lease.lease_type', v)} placeholder="e.g. NNN, Gross, Ground Lease" />
                <Field label="Lease Price" value={omData.lease?.lease_price} onChange={(v) => update('lease.lease_price', v)} placeholder="e.g. $2,500/mo or $15.00/SF/Yr NNN" />
                <Field label="Commencement Date" value={omData.lease?.lease_commencement} onChange={(v) => update('lease.lease_commencement', v)} placeholder="e.g. 01/2020" />
                <Field label="Expiration Date" value={omData.lease?.lease_expiration} onChange={(v) => update('lease.lease_expiration', v)} placeholder="e.g. 12/2035" />
                <Field label="Term Remaining" value={omData.term_remaining} onChange={(v) => update('term_remaining', v)} placeholder="e.g. ± 12 Years" fullWidth />
              </div>
            </Section>

            {/* ── HubSpot Email ── */}
            <Section title="HubSpot Email" defaultOpen>
              <div className="space-y-3">
                <Field label="Email Subject" value={omData.hubspot_email?.subject} onChange={(v) => update('hubspot_email.subject', v)} placeholder="e.g. Now Available: Dollar General in Phoenix, AZ" fullWidth />
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Preview Header <span className="text-gray-300 font-normal">(max 80 chars)</span></label>
                  <div className="relative">
                    <input
                      value={omData.hubspot_email?.preview_header ?? ''}
                      onChange={(e) => update('hubspot_email.preview_header', e.target.value.slice(0, 80))}
                      maxLength={80}
                      placeholder="e.g. Absolute NNN lease with 10+ years remaining and 2% annual increases"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors pr-12"
                    />
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono ${(omData.hubspot_email?.preview_header?.length ?? 0) > 70 ? 'text-amber-500' : 'text-gray-300'}`}>
                      {omData.hubspot_email?.preview_header?.length ?? 0}/80
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Listing Agents ── */}
            <Section title={`Listing Agents (${(omData.listing_agents || []).filter(a => !brokerOfRecord || a.name?.toLowerCase().trim() !== brokerOfRecord.name.toLowerCase().trim()).length})`} defaultOpen>
              <p className="text-[10px] text-gray-400 mb-1.5">#1 agent is used in SEO meta. Drag order with arrows.</p>
              <div className="space-y-2">
                {(omData.listing_agents || []).map((agent, origIdx) => ({ agent, origIdx })).filter(({ agent }) => !brokerOfRecord || agent.name?.toLowerCase().trim() !== brokerOfRecord.name.toLowerCase().trim()).map(({ agent, origIdx }, filteredIdx, filteredArr) => (
                  <div key={filteredIdx} className="flex gap-2 items-start">
                    {/* Position badge + arrows column */}
                    <div className="flex flex-col items-center gap-0.5 pt-1 min-w-[28px]">
                      <button
                        type="button"
                        onClick={() => moveAgentUp(origIdx)}
                        disabled={filteredIdx === 0}
                        className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className={`text-xs font-bold leading-none ${filteredIdx === 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {filteredIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveAgentDown(origIdx)}
                        disabled={filteredIdx === filteredArr.length - 1}
                        className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Agent card */}
                    <div className="flex-1 relative border border-blue-100 rounded-lg p-2.5 bg-blue-50/30 group/agent">
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        {filteredIdx === 0 && <span className="text-[8px] font-bold text-blue-500 bg-blue-100 rounded px-1 py-0.5 uppercase">Primary</span>}
                        <button
                          type="button"
                          onClick={() => removeAgent(origIdx)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove agent"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {([
                          ['Name', 'name', agent.name],
                          ['Role', 'role', agent.role],
                          ['Email', 'email', agent.email],
                          ['Phone', 'phone', agent.phone],
                        ] as const).map(([lbl, field, val]) => (
                          <div key={field} className="relative group/af">
                            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{lbl}</label>
                            <input
                              value={val ?? ''}
                              onChange={(e) => updateAgent(origIdx, field as keyof OMAgent, e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-0.5 text-[13px] pr-6 hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                            />
                            {val && (
                              <CopyBtn text={val} className="absolute right-1 top-[18px] opacity-0 group-hover/af:opacity-100" />
                            )}
                          </div>
                        ))}
                        <div className="col-span-2 relative group/af">
                          <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wide">License #</label>
                          <input
                            value={agent.license_number ?? ''}
                            onChange={(e) => updateAgent(origIdx, 'license_number', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-0.5 text-[13px] pr-6 hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                          />
                          {agent.license_number && (
                            <CopyBtn text={agent.license_number} className="absolute right-1 top-[18px] opacity-0 group-hover/af:opacity-100" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAgent}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Agent
                </button>
              </div>
            </Section>

            {/* ── Broker of Record ── */}
            <Section title="Broker of Record" defaultOpen>
              {brokerOfRecord ? (
                <div className="bg-rose-50/50 border border-rose-200 rounded-lg overflow-hidden">
                  {/* Copy All bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-rose-100/60 border-b border-rose-200">
                    <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">State: {omData.address?.state_abbr}</span>
                    <CopyBtn text={`${brokerOfRecord.name}\n${brokerOfRecord.company}\nLicense # ${[brokerOfRecord.firm_number, brokerOfRecord.license_number].filter(Boolean).join(', ')}${omData.address?.state_abbr ? ` (${omData.address.state_abbr})` : ''}\n${brokerOfRecord.address}\n(866) 889-0550`} className="text-rose-400 hover:text-rose-700" />
                  </div>
                  <div className="px-3 py-2.5 space-y-1.5">
                    {[
                      { label: 'Name', value: brokerOfRecord.name, copy: brokerOfRecord.name },
                      { label: 'Company', value: brokerOfRecord.company, copy: brokerOfRecord.company },
                      { label: 'Firm & License', value: `License # ${[brokerOfRecord.firm_number, brokerOfRecord.license_number].filter(Boolean).join(', ')}${omData.address?.state_abbr ? ` (${omData.address.state_abbr})` : ''}`, copy: `License # ${[brokerOfRecord.firm_number, brokerOfRecord.license_number].filter(Boolean).join(', ')}${omData.address?.state_abbr ? ` (${omData.address.state_abbr})` : ''}` },
                      { label: 'Address', value: brokerOfRecord.address, copy: brokerOfRecord.address },
                      { label: 'Phone', value: '(866) 889-0550', copy: '(866) 889-0550' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2 group/bor">
                        <span className="text-[10px] font-semibold text-rose-400 uppercase w-20 shrink-0">{row.label}</span>
                        <span className="text-[12px] text-rose-900 flex-1 truncate">{row.value}</span>
                        <CopyBtn text={row.copy} className="opacity-0 group-hover/bor:opacity-100 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No broker of record found for state: {omData.address?.state_abbr ?? 'unknown'}</p>
              )}
            </Section>

            {/* ── Descriptions ── */}
            <Section title="Descriptions" defaultOpen>
              <div className="space-y-3">
                <Field label="Crezi Header" value={omData.descriptions?.crazy_header} onChange={(v) => update('descriptions.crazy_header', v)} fullWidth />
                
                {/* Rich editor for internal HTML */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Internal Highlights</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-100">
                      <button type="button" onClick={() => document.execCommand('insertUnorderedList', false)} className="px-2 py-0.5 text-xs rounded hover:bg-gray-200 transition-colors" title="Bullet List">&bull; List</button>
                      <button type="button" onClick={() => document.execCommand('bold', false)} className="px-2 py-0.5 text-xs font-bold rounded hover:bg-gray-200 transition-colors" title="Bold">B</button>
                      <button type="button" onClick={() => document.execCommand('italic', false)} className="px-2 py-0.5 text-xs italic rounded hover:bg-gray-200 transition-colors" title="Italic">I</button>
                    </div>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="min-h-[120px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_li]:text-sm"
                      dangerouslySetInnerHTML={{
                        __html: omData.descriptions?.internal_editor_html || (() => {
                          const h = omData.highlights;
                          if (!h || h.length === 0) return '';
                          return '<ul>' + h.map((l) => {
                            const colonIdx = l.indexOf(':');
                            if (colonIdx > 0 && colonIdx < 60) {
                              return `<li><strong>${l.slice(0, colonIdx + 1)}</strong>${l.slice(colonIdx + 1)}</li>`;
                            }
                            return `<li>${l}</li>`;
                          }).join('') + '</ul>';
                        })(),
                      }}
                      onBlur={(e) => update('descriptions.internal_editor_html', e.currentTarget.innerHTML)}
                    />
                  </div>
                </div>

                {/* Multi-site description tabs */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Platform Descriptions</label>
                  <div className="flex gap-1 mb-2">
                    {(['matthews', 'third_parties'] as const).map((site) => (
                      <button
                        key={site}
                        type="button"
                        onClick={() => setDescTab(site)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          descTab === site ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {site === 'matthews' ? 'Matthews' : 'Third Parties'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={omData.descriptions?.public_multi_site_variants?.find(v => v.site === descTab)?.value ?? ''}
                    onChange={(e) => updateMultiSiteVariant(descTab, e.target.value)}
                    rows={8}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none hover:border-gray-300 transition-colors"
                    placeholder={`Description for ${descTab}...`}
                  />
                </div>
              </div>
            </Section>

            {/* ── LoopNet Highlights ── */}
            <Section title="LoopNet Highlights" defaultOpen>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  {(omData.loopnet_highlights || []).map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={h}
                        onChange={(e) => {
                          const copy = JSON.parse(JSON.stringify(omData)) as OMData;
                          copy.loopnet_highlights[idx] = e.target.value.slice(0, 150);
                          setOmData(copy);
                        }}
                        maxLength={150}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        placeholder="80-150 chars — be descriptive and specific"
                      />
                      <span className="text-[10px] text-gray-400 w-8 text-right">{h.length}/150</span>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = JSON.parse(JSON.stringify(omData)) as OMData;
                          copy.loopnet_highlights.splice(idx, 1);
                          setOmData(copy);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {(omData.loopnet_highlights?.length || 0) < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      const copy = JSON.parse(JSON.stringify(omData)) as OMData;
                      if (!copy.loopnet_highlights) copy.loopnet_highlights = [];
                      copy.loopnet_highlights.push('');
                      setOmData(copy);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Highlight
                  </button>
                )}
                <p className="text-[10px] text-gray-400">Up to 6 highlights, 80-150 chars each</p>
              </div>
            </Section>

            {/* ── LoopNet Tags ── */}
            <Section title="LoopNet Tags" defaultOpen>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(omData.loopnet?.highlights_tags || []).map((tag, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                      <input
                        value={tag}
                        onChange={(e) => updateLoopNetTag(idx, e.target.value)}
                        className="bg-transparent text-xs text-blue-800 min-w-[60px] max-w-[200px] outline-none"
                        style={{ width: `${Math.max(60, tag.length * 7)}px` }}
                        maxLength={50}
                      />
                      <button type="button" onClick={() => removeLoopNetTag(idx)} className="text-blue-400 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(omData.loopnet?.highlights_tags?.length || 0) < 6 && (
                    <button type="button" onClick={addLoopNetTag} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-dashed border-blue-300 rounded-lg transition-colors">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                {omData.loopnet?.formatted_tags_string && (
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-gray-500 font-mono flex-1 truncate">{omData.loopnet.formatted_tags_string}</p>
                    <CopyBtn text={omData.loopnet.formatted_tags_string} />
                  </div>
                )}
                <p className="text-[10px] text-gray-400">Max 6 tags, 50 chars each</p>
              </div>
            </Section>

            {/* ── Leasing Only ── */}
            {omData.record_type === 'leasing' && (
              <Section title="Leasing Details" defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Space Title" value={omData.leasing_only?.space_title} onChange={(v) => update('leasing_only.space_title', v)} />
                  <Field label="Rate" value={omData.leasing_only?.rate} onChange={(v) => update('leasing_only.rate', v)} placeholder="e.g. $0.50/SF/Mo NNN" />
                  <Field label="Property Type" value={omData.leasing_only?.property_type} onChange={(v) => update('leasing_only.property_type', v)} />
                </div>
              </Section>
            )}

            {/* ── Classification ── */}
            <Section title="Classification" defaultOpen={false}>
              <Field label="Retail Types" value={(omData.classification?.retail_types || []).join(', ')} onChange={(v: string) => update('classification.retail_types', v.split(',').map((s: string) => s.trim()).filter(Boolean))} fullWidth />
              <Field label="Retail Subtypes" value={(omData.classification?.retail_subtypes || []).join(', ')} onChange={(v: string) => update('classification.retail_subtypes', v.split(',').map((s: string) => s.trim()).filter(Boolean))} fullWidth />
              <p className="text-[10px] text-gray-400">Comma-separated values</p>
            </Section>

            {/* ── Audit ── */}
            <Section title="Audit Trail" defaultOpen>
              <div className="space-y-3">
                {omData.audit?.missing_fields && omData.audit.missing_fields.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-amber-700 mb-1">Missing Fields</p>
                    <div className="flex flex-wrap gap-1">
                      {omData.audit.missing_fields.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-md border border-amber-200">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {omData.audit?.assumptions && omData.audit.assumptions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-gray-600 mb-1">Assumptions</p>
                    <ul className="text-[11px] text-gray-500 space-y-0.5">
                      {omData.audit.assumptions.map((a, i) => (
                        <li key={i} className="flex gap-1"><span className="text-gray-300">-</span> {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {omData.audit?.extracted_from?.sections_used && omData.audit.extracted_from.sections_used.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-gray-600 mb-1">Sections Used</p>
                    <div className="flex flex-wrap gap-1">
                      {omData.audit.extracted_from.sections_used.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-md">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Map ── */}
            {geo && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-500 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-emerald-50/50 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Location</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-emerald-700 font-mono">{geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}</span>
                    <CopyBtn text={`${geo.lat}, ${geo.lng}`} className="text-emerald-400 hover:text-emerald-700" />
                  </div>
                </div>
                <div className="relative">
                  <iframe
                    title="Property Location"
                    width="100%"
                    height="280"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.lng - 0.01},${geo.lat - 0.006},${geo.lng + 0.01},${geo.lat + 0.006}&layer=mapnik&marker=${geo.lat},${geo.lng}`}
                  />
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50/50 border-t border-gray-100">
                  <a
                    href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Google Maps &rarr;
                  </a>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=16/${geo.lat}/${geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    OpenStreetMap &rarr;
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Drag Handle ═══ */}
          <div
            onMouseDown={startDrag}
            className="hidden lg:flex items-center justify-center w-2 cursor-col-resize group hover:bg-blue-100/60 rounded-full transition-colors shrink-0 select-none"
          >
            <div className="w-0.5 h-10 bg-gray-300 group-hover:bg-blue-400 rounded-full transition-colors" />
          </div>

          {/* ═══════════ Right: PDF + Files & Images ═══════════ */}
          <div className="flex-1 min-w-0 lg:sticky lg:top-14 lg:self-start lg:max-h-[calc(100vh-3.5rem)] flex flex-col">
            {/* Tab bar */}
            <div className="flex bg-white rounded-t-2xl border border-b-0 border-gray-200 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setRightTab('files')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${rightTab === 'files' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <Download className="w-3.5 h-3.5" /> Files &amp; Images
              </button>
              <button
                type="button"
                onClick={() => setRightTab('pdf')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${rightTab === 'pdf' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <Eye className="w-3.5 h-3.5" /> PDF Preview
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm">
              {/* PDF Viewer */}
              {rightTab === 'pdf' && (
                <div className="p-4 flex flex-col h-full">
                  <div className="flex-1 min-h-0" style={{ height: 'calc(92vh - 60px)' }}>
                    <PDFViewer url={pdfBlobUrl} />
                  </div>
                </div>
              )}

              {/* Files & Images */}
              {rightTab === 'files' && (
                <div className="p-4">

              {/* Downloads */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Downloads</p>
                {selectedDownloads.size > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      for (const key of selectedDownloads) {
                        const [url, name] = key.split('|||');
                        await handleDownload(url, name);
                        // Delay between downloads so Windows browsers don't block them
                        await new Promise((r) => setTimeout(r, 800));
                      }
                      setSelectedDownloads(new Set());
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Download Selected ({selectedDownloads.size})
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {pdfBlobUrl && (() => {
                  const dlKey = `${pdfBlobUrl}|||${omBaseName}, OM.pdf`;
                  const checked = selectedDownloads.has(dlKey);
                  return (
                  <div className={`p-3 rounded-xl border transition-colors ${checked ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input type="checkbox" checked={checked} onChange={() => { const s = new Set(selectedDownloads); checked ? s.delete(dlKey) : s.add(dlKey); setSelectedDownloads(s); }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <Download className="w-4 h-4 text-gray-500 shrink-0" />
                      <p className="text-sm font-medium text-gray-700">Original PDF</p>
                    </div>
                    <div className="flex gap-1.5">
                      <a href={pdfBlobUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors">
                        <Eye className="w-3 h-3" /> View
                      </a>
                      <button onClick={() => handleDownload(pdfBlobUrl, `${omBaseName}, OM.pdf`)} className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-white bg-gray-500 rounded-lg py-1.5 hover:bg-gray-600 transition-colors">
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </div>
                  </div>
                  );
                })()}
                {lockedPdfUrl && (() => {
                  const dlKey = `${lockedPdfUrl}|||${omBaseName}, OM PP.pdf`;
                  const checked = selectedDownloads.has(dlKey);
                  return (
                  <div className={`p-3 rounded-xl border transition-colors ${checked ? 'bg-red-100 border-red-300 ring-1 ring-red-200' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input type="checkbox" checked={checked} onChange={() => { const s = new Set(selectedDownloads); checked ? s.delete(dlKey) : s.add(dlKey); setSelectedDownloads(s); }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <Download className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-red-700">Locked PDF (PP)</p>
                        <p className="text-[10px] text-red-400">
                          Password: <span className="font-mono font-bold select-all">Matthews841</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <a href={lockedPdfUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition-colors">
                        <Eye className="w-3 h-3" /> View
                      </a>
                      <button onClick={() => handleDownload(lockedPdfUrl, `${omBaseName}, OM PP.pdf`)} className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-white bg-red-500 rounded-lg py-1.5 hover:bg-red-600 transition-colors">
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </div>
                  </div>
                  );
                })()}

                {finalImages.map((img, i) => {
                  const picBase = `${omBaseName}, pic-${i + 1}`;
                  const ext = img.filename.split('.').pop() || 'jpg';
                  const cleanName = `${picBase}.${ext}`;
                  const wmName = img.hasWatermark ? `${picBase} WM.${ext}` : undefined;
                  const rrName = img.hasRepRendering ? `${picBase} RR.${ext}` : undefined;
                  const origKey = `${img.originalUrl}|||${cleanName}`;
                  const origChecked = selectedDownloads.has(origKey);
                  const wmKey = img.watermarkedUrl && wmName ? `${img.watermarkedUrl}|||${wmName}` : null;
                  const wmChecked = wmKey ? selectedDownloads.has(wmKey) : false;
                  const rrKey = img.rrUrl && rrName ? `${img.rrUrl}|||${rrName}` : null;
                  const rrChecked = rrKey ? selectedDownloads.has(rrKey) : false;
                  return (
                  <div key={i} className="space-y-1">
                    {/* Thumbnail preview */}
                    <div
                      className="relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
                      onClick={() => setLightboxImg(img.rrUrl || img.watermarkedUrl || img.originalUrl)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.rrUrl || img.watermarkedUrl || img.originalUrl}
                        alt={cleanName}
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const retries = Number(target.dataset.retries || '0');
                          if (retries < 3) {
                            target.dataset.retries = String(retries + 1);
                            const base = img.rrUrl || img.watermarkedUrl || img.originalUrl;
                            setTimeout(() => { target.src = base + `?t=${Date.now()}`; }, 800 * (retries + 1));
                          } else if ((img.rrUrl || img.watermarkedUrl) && !target.src.includes(img.originalUrl)) {
                            target.src = img.originalUrl + `?t=${Date.now()}`;
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {/* Clean image */}
                    <div className={`p-2.5 rounded-xl border transition-colors ${origChecked ? 'bg-blue-100 border-blue-300 ring-1 ring-blue-200' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <input type="checkbox" checked={origChecked} onChange={() => { const s = new Set(selectedDownloads); origChecked ? s.delete(origKey) : s.add(origKey); setSelectedDownloads(s); }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <p className="text-xs font-medium text-blue-700 truncate">{cleanName}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <a href={img.originalUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded-lg py-1 hover:bg-blue-50 transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </a>
                        <button onClick={() => handleDownload(img.originalUrl, cleanName)} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-blue-500 rounded-lg py-1 hover:bg-blue-600 transition-colors">
                          <Download className="w-3 h-3" /> Save
                        </button>
                      </div>
                    </div>
                    {/* RR version (Representative Rendering text — for internal use) */}
                    {img.rrUrl && rrName && rrKey && (
                      <div className={`p-2.5 rounded-xl border ml-3 transition-colors ${rrChecked ? 'bg-amber-100 border-amber-300 ring-1 ring-amber-200' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <input type="checkbox" checked={rrChecked} onChange={() => { const s = new Set(selectedDownloads); rrChecked ? s.delete(rrKey) : s.add(rrKey); setSelectedDownloads(s); }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <p className="text-xs font-medium text-amber-700 truncate">{rrName}</p>
                          <span className="text-[9px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-100 rounded-full">Internal</span>
                        </div>
                        <div className="flex gap-1.5">
                          <a href={img.rrUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-amber-600 bg-white border border-amber-200 rounded-lg py-1 hover:bg-amber-50 transition-colors">
                            <Eye className="w-3 h-3" /> View
                          </a>
                          <button onClick={() => handleDownload(img.rrUrl!, rrName)} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-amber-500 rounded-lg py-1 hover:bg-amber-600 transition-colors">
                            <Download className="w-3 h-3" /> Save
                          </button>
                        </div>
                      </div>
                    )}
                    {/* WM version (Matthews logo watermark — for third parties) */}
                    {img.watermarkedUrl && wmName && wmKey && (
                      <div className={`p-2.5 rounded-xl border ml-3 transition-colors ${wmChecked ? 'bg-emerald-100 border-emerald-300 ring-1 ring-emerald-200' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <input type="checkbox" checked={wmChecked} onChange={() => { const s = new Set(selectedDownloads); wmChecked ? s.delete(wmKey) : s.add(wmKey); setSelectedDownloads(s); }} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <p className="text-xs font-medium text-emerald-700 truncate">{wmName}</p>
                          {img.hasRepRendering && <span className="text-[9px] text-emerald-500 font-medium px-1.5 py-0.5 bg-emerald-100 rounded-full">3rd Party</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <a href={img.watermarkedUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-600 bg-white border border-emerald-200 rounded-lg py-1 hover:bg-emerald-50 transition-colors">
                            <Eye className="w-3 h-3" /> View
                          </a>
                          <button onClick={() => handleDownload(img.watermarkedUrl!, wmName)} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-white bg-emerald-500 rounded-lg py-1 hover:bg-emerald-600 transition-colors">
                            <Download className="w-3 h-3" /> Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button onClick={() => setLightboxImg(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImg}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
