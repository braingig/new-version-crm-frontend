export type UploadedAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function getRestBaseUrl(): string {
  const gql = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
  return gql.replace(/\/graphql\/?$/, '');
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  // Backend uses a global prefix "api" in dev/prod containers.
  // If the caller used a non-/api URL (common when NEXT_PUBLIC_API_URL is /graphql),
  // retry once with /api inserted.
  if (
    res.status === 404 &&
    typeof input === 'string' &&
    !input.includes('/api/') &&
    input.includes('/attachments/')
  ) {
    const u = new URL(input, window.location.origin);
    u.pathname = `/api${u.pathname}`;
    return fetch(u.toString(), { ...init, headers });
  }
  return res;
}

export async function downloadWithAuth(params: { url: string; filename?: string }) {
  const res = await authedFetch(params.url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    // If filename not provided, let browser infer from headers.
    if (params.filename) a.download = params.filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delay revoke slightly so the download/new tab can start.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  }
}

export async function openInNewTabWithAuth(params: { url: string }) {
  const res = await authedFetch(params.url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Open failed (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  // For PDFs/images, this will preview in a new tab. For others, browser may download.
  const w = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  // Even if popup blocked, keep URL alive briefly.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
  if (!w) {
    // Popup blocked -> fallback to download behavior in same click context
    const a = document.createElement('a');
    a.href = objectUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function taskAttachmentDownloadUrl(id: string) {
  return `${getRestBaseUrl()}/api/attachments/tasks/${id}/download`;
}

export function projectAttachmentDownloadUrl(id: string) {
  return `${getRestBaseUrl()}/api/attachments/projects/${id}/download`;
}

export async function uploadTaskAttachment(params: {
  file: File;
  taskId?: string;
  draftKey?: string;
}): Promise<{ attachment: UploadedAttachment; url: string }> {
  const form = new FormData();
  form.append('file', params.file);
  if (params.taskId) form.append('taskId', params.taskId);
  if (params.draftKey) form.append('draftKey', params.draftKey);

  const res = await authedFetch(`${getRestBaseUrl()}/attachments/tasks`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || 'Upload failed');
  }
  return {
    attachment: json.attachment,
    url: `${getRestBaseUrl()}${json.url}`,
  };
}

export async function uploadProjectAttachment(params: {
  file: File;
  projectId?: string;
  draftKey?: string;
}): Promise<{ attachment: UploadedAttachment; url: string }> {
  const form = new FormData();
  form.append('file', params.file);
  if (params.projectId) form.append('projectId', params.projectId);
  if (params.draftKey) form.append('draftKey', params.draftKey);

  const res = await authedFetch(`${getRestBaseUrl()}/attachments/projects`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || 'Upload failed');
  }
  return {
    attachment: json.attachment,
    url: `${getRestBaseUrl()}${json.url}`,
  };
}

export async function finalizeTaskDraft(draftKey: string, taskId: string) {
  const res = await authedFetch(`${getRestBaseUrl()}/attachments/tasks/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftKey, taskId }),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.message || 'Finalize failed');
  return json as { ok: true; moved: number };
}

export async function finalizeProjectDraft(draftKey: string, projectId: string) {
  const res = await authedFetch(`${getRestBaseUrl()}/attachments/projects/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftKey, projectId }),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.message || 'Finalize failed');
  return json as { ok: true; moved: number };
}

export async function deleteTaskAttachment(id: string) {
  const res = await authedFetch(`${getRestBaseUrl()}/attachments/tasks/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.message || 'Delete failed');
  return true;
}

export async function deleteProjectAttachment(id: string) {
  const res = await authedFetch(`${getRestBaseUrl()}/attachments/projects/${id}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.message || 'Delete failed');
  return true;
}

