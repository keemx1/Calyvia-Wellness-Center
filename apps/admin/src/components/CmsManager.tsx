'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { CmsPostStatus, CmsPostType } from '@calyvia/shared';
import { useAuth } from './AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const SITE_URL = 'https://calyviawellness.co.ke';

const TYPE_LABELS: Record<string, string> = {
  CAREER: 'Career opportunity',
  VLOG: 'Vlog / video',
  ANNOUNCEMENT: 'Announcement',
};

const TYPE_ROUTES: Record<string, string> = {
  CAREER: 'careers',
  VLOG: 'vlogs',
  ANNOUNCEMENT: 'news',
};

interface CmsPost {
  id: string;
  slug: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  content: Array<{ type: string; text?: string; items?: string[] }>;
  coverImageUrl: string | null;
  embedUrl: string | null;
  location: string | null;
  employmentType: string | null;
  applicationEmail: string | null;
  applicationUrl: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  authorName: string | null;
  createdAt: string;
  rebuild?: { triggered: boolean; reason?: string };
}

interface FormState {
  title: string;
  slug: string;
  type: CmsPostType;
  status: CmsPostStatus;
  summary: string;
  body: string;
  coverImageUrl: string;
  embedUrl: string;
  location: string;
  employmentType: string;
  applicationEmail: string;
  applicationUrl: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  type: CmsPostType.CAREER,
  status: CmsPostStatus.DRAFT,
  summary: '',
  body: '',
  coverImageUrl: '',
  embedUrl: '',
  location: '',
  employmentType: '',
  applicationEmail: '',
  applicationUrl: '',
  expiresAt: '',
};

/** Plain-text editor format: one paragraph per line, "- item" for bullet lists. */
function bodyToBlocks(body: string) {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks: Array<{ type: string; text?: string; items?: string[] }> = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ type: 'list', items: bullets });
      bullets = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      blocks.push({ type: 'paragraph', text: line });
    }
  }
  flushBullets();
  return blocks;
}

function blocksToBody(blocks: CmsPost['content']): string {
  return blocks
    .map((block) => {
      if (block.type === 'list') return (block.items || []).map((item) => `- ${item}`).join('\n');
      return block.text || '';
    })
    .filter(Boolean)
    .join('\n');
}

function rebuildMessage(rebuild?: CmsPost['rebuild']): string {
  if (!rebuild) return '';
  if (rebuild.triggered) {
    return 'Saved. Website rebuild started — the post will appear on the live site in about 1–2 minutes.';
  }
  if (rebuild.reason === 'not_configured') {
    return 'Saved, but the website rebuild hook is not configured. Ask the administrator to set NETLIFY_CMS_BUILD_HOOK_URL in Coolify.';
  }
  return 'Saved, but the automatic website rebuild failed. The post is stored and can be republished after checking the build hook.';
}

export function CmsManager() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'ALL' | CmsPostType>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/cms/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Could not load posts (HTTP ${res.status})`);
      setPosts(await res.json());
    } catch (err: any) {
      setError(err?.message || 'Could not load website content.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, type: filter === 'ALL' ? CmsPostType.CAREER : filter });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (post: CmsPost) => {
    setEditingId(post.id);
    setShowForm(true);
    setError('');
    setNotice('');
    setForm({
      title: post.title,
      slug: post.slug,
      type: post.type as CmsPostType,
      status: post.status as CmsPostStatus,
      summary: post.summary || '',
      body: blocksToBody(post.content || []),
      coverImageUrl: post.coverImageUrl || '',
      embedUrl: post.embedUrl || '',
      location: post.location || '',
      employmentType: post.employmentType || '',
      applicationEmail: post.applicationEmail || '',
      applicationUrl: post.applicationUrl || '',
      expiresAt: post.expiresAt ? post.expiresAt.slice(0, 10) : '',
    });
  };

  const savePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      type: form.type,
      status: form.status,
      summary: form.summary,
      content: bodyToBlocks(form.body),
      coverImageUrl: form.coverImageUrl || undefined,
      embedUrl: form.type === CmsPostType.VLOG ? form.embedUrl || undefined : undefined,
      location: form.type === CmsPostType.CAREER ? form.location || undefined : undefined,
      employmentType: form.type === CmsPostType.CAREER ? form.employmentType || undefined : undefined,
      applicationEmail: form.type === CmsPostType.CAREER ? form.applicationEmail || undefined : undefined,
      applicationUrl: form.type === CmsPostType.CAREER ? form.applicationUrl || undefined : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };
    try {
      const res = await fetch(
        editingId ? `${API_URL}/cms/posts/${editingId}` : `${API_URL}/cms/posts`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Save failed (HTTP ${res.status})`);
      setNotice(rebuildMessage(data.rebuild));
      await loadPosts();
      if (!data.rebuild?.triggered && form.status === CmsPostStatus.PUBLISHED) {
        // Keep the form open so staff can retry publishing after configuration.
        return;
      }
      resetForm();
    } catch (err: any) {
      setError(Array.isArray(err?.message) ? err.message.join(', ') : err?.message || 'Could not save post.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (post: CmsPost, publish: boolean) => {
    if (!token) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(
        `${API_URL}/cms/posts/${post.id}/${publish ? 'publish' : 'unpublish'}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Update failed (HTTP ${res.status})`);
      setNotice(rebuildMessage(data.rebuild));
      setPosts((prev) => prev.map((item) => (item.id === post.id ? data : item)));
    } catch (err: any) {
      setError(err?.message || 'Could not update post status.');
    }
  };

  const visiblePosts = filter === 'ALL' ? posts : posts.filter((post) => post.type === filter);

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-foreground">Website Content</h2>
              <p className="text-xs text-muted-foreground">
                Publish careers, vlogs and announcements to calyviawellness.co.ke
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadPosts}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-surface-subtle"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <a
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-surface-subtle"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View website</span>
            </a>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New post</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Drafts are private. Publishing starts a Netlify rebuild and the post appears on the live site automatically. Videos must be YouTube or Vimeo links.
        </p>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-4 rounded-xl border border-danger/30 bg-danger/5 text-danger text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start space-x-2 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={savePost}
          className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-bold text-foreground">
              {editingId ? 'Edit post' : 'Create post'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1.5 rounded-lg hover:bg-surface-subtle text-muted-foreground"
              aria-label="Close editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Type</span>
              <select
                value={form.type}
                onChange={(e) => updateForm({ type: e.target.value as CmsPostType })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              >
                {Object.values(CmsPostType).map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type] || type}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Status</span>
              <select
                value={form.status}
                onChange={(e) => updateForm({ status: e.target.value as CmsPostStatus })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              >
                {Object.values(CmsPostStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-foreground">Title *</span>
              <input
                required
                minLength={3}
                maxLength={160}
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                placeholder="e.g. Registered Counsellor – Ruiru"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">URL slug (optional)</span>
              <input
                value={form.slug}
                onChange={(e) => updateForm({ slug: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                placeholder="generated-from-title"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Short summary</span>
              <input
                maxLength={300}
                value={form.summary}
                onChange={(e) => updateForm({ summary: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                placeholder="One sentence shown on listing pages"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Body</span>
            <textarea
              rows={8}
              value={form.body}
              onChange={(e) => updateForm({ body: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              placeholder={'One paragraph per line.\nUse "- " at the start of a line for bullet points.'}
            />
            <span className="block text-[10px] text-muted-foreground">
              Plain text only. HTML and scripts are stripped. Use &quot;- &quot; for bullets.
            </span>
          </label>

          {form.type === CmsPostType.VLOG && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Video link (YouTube or Vimeo) *</span>
              <input
                required
                value={form.embedUrl}
                onChange={(e) => updateForm({ embedUrl: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>
          )}

          {form.type === CmsPostType.CAREER && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Location</span>
                <input
                  value={form.location}
                  onChange={(e) => updateForm({ location: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  placeholder="Ruiru, Kiambu County"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Employment type</span>
                <input
                  value={form.employmentType}
                  onChange={(e) => updateForm({ employmentType: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  placeholder="Full-time"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Application email</span>
                <input
                  type="email"
                  value={form.applicationEmail}
                  onChange={(e) => updateForm({ applicationEmail: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  placeholder="careers@calyviawellness.co.ke"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Application link (https)</span>
                <input
                  value={form.applicationUrl}
                  onChange={(e) => updateForm({ applicationUrl: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  placeholder="https://..."
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Cover image URL (https)</span>
              <input
                value={form.coverImageUrl}
                onChange={(e) => updateForm({ coverImageUrl: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                placeholder="https://..."
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground">Expires on (optional)</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => updateForm({ expiresAt: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-surface-subtle"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create post'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
          {(['ALL', ...Object.values(CmsPostType)] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                filter === option
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {option === 'ALL' ? 'All posts' : TYPE_LABELS[option] || option}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading website content...</div>
        ) : visiblePosts.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Globe className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No posts yet. Create the first one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visiblePosts.map((post) => (
              <div key={post.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground truncate">{post.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-subtle text-muted-foreground border border-border">
                      {TYPE_LABELS[post.type] || post.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        post.status === CmsPostStatus.PUBLISHED
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{post.summary || 'No summary'}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {SITE_URL}/{TYPE_ROUTES[post.type] || 'news'}/{post.slug}
                    {post.publishedAt ? ` · published ${new Date(post.publishedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(post)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-surface-subtle"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {post.status === CmsPostStatus.PUBLISHED ? (
                    <button
                      type="button"
                      onClick={() => changeStatus(post, false)}
                      className="px-3 py-2 rounded-xl border border-amber-500/30 text-xs font-semibold text-amber-600 hover:bg-amber-500/5"
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => changeStatus(post, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CmsManager;
