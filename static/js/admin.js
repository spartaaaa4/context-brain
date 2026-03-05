let currentAdminVertical = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAdminOverview();
});

async function loadAdminOverview() {
    try {
        const res = await fetch('/admin/api/overview');
        const data = await res.json();

        document.getElementById('admin-stats').innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${data.totals.contributors}</span>
                <span class="stat-label">Contributors</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${data.totals.messages}</span>
                <span class="stat-label">Messages</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${data.totals.documents}</span>
                <span class="stat-label">Documents</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${data.totals.notes}</span>
                <span class="stat-label">Notes</span>
            </div>
        `;

        loadUsers();

        document.getElementById('admin-verticals').innerHTML = data.verticals.map(v => `
            <div class="admin-vertical-card" style="border-top-color: ${v.color}" onclick="loadVerticalDetail('${v.id}')">
                <div class="card-header">
                    <div class="card-icon">${v.icon}</div>
                    <div>
                        <div class="card-title">${v.name}</div>
                        <div class="card-meta">${v.geography} &middot; ${v.type}</div>
                    </div>
                </div>
                <div class="card-stats">
                    <div class="stat-item">
                        <span class="stat-value" style="color:${v.color}">${v.contributors}</span>
                        <span class="stat-label">Contributors</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color:${v.color}">${v.messages}</span>
                        <span class="stat-label">Messages</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color:${v.color}">${v.documents}</span>
                        <span class="stat-label">Documents</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color:${v.color}">${v.notes}</span>
                        <span class="stat-label">Notes</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="map-status">${v.process_map ? `v${v.process_map.version}` : 'Not generated'}</span>
                    <span class="last-activity">${v.last_activity ? new Date(v.last_activity).toLocaleDateString() : 'No activity'}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load admin overview:', e);
    }
}

window.loadVerticalDetail = async function(verticalId) {
    currentAdminVertical = verticalId;
    const detail = document.getElementById('admin-detail');
    detail.style.display = 'block';
    detail.innerHTML = '<div class="loading-state">Loading...</div>';
    detail.scrollIntoView({ behavior: 'smooth' });

    try {
        const res = await fetch(`/admin/api/vertical/${verticalId}`);
        const data = await res.json();

        const v = data.vertical;
        detail.innerHTML = `
            <h2>${v.icon} ${v.name} <span style="color:var(--text-muted);font-size:14px;font-weight:400">${v.geography}</span></h2>

            <div class="export-buttons">
                <a href="/admin/api/export/${v.id}?format=json" class="export-btn">Export JSON</a>
                <a href="/admin/api/export/${v.id}?format=markdown" class="export-btn">Export Markdown</a>
                <a href="/admin/api/export-all" class="export-btn">Export All Verticals (ZIP)</a>
            </div>

            <div class="admin-tabs">
                <button class="admin-tab active" onclick="showAdminTab('contributors')">Contributors</button>
                <button class="admin-tab" onclick="showAdminTab('conversation')">Conversation</button>
                <button class="admin-tab" onclick="showAdminTab('documents')">Documents</button>
                <button class="admin-tab" onclick="showAdminTab('notes')">Notes</button>
                <button class="admin-tab" onclick="showAdminTab('process_map', '${v.id}')">Process Map</button>
            </div>

            <div id="atab-contributors" class="admin-tab-content active">
                ${data.contributors.length ? data.contributors.map(c => `
                    <div class="note-card" style="margin-bottom:8px">
                        <div class="note-header">
                            <div class="note-author">
                                ${c.pic ? `<img src="${c.pic}" class="note-author-pic">` : ''}
                                <strong>${esc(c.name)}</strong> (${esc(c.email)})
                            </div>
                        </div>
                        <div class="card-stats" style="margin-top:8px">
                            <div class="stat-item"><span class="stat-value">${c.messages}</span><span class="stat-label">Messages</span></div>
                            <div class="stat-item"><span class="stat-value">${c.documents}</span><span class="stat-label">Documents</span></div>
                            <div class="stat-item"><span class="stat-value">${c.notes}</span><span class="stat-label">Notes</span></div>
                        </div>
                    </div>
                `).join('') : '<p style="color:var(--text-muted)">No contributors yet</p>'}
            </div>

            <div id="atab-conversation" class="admin-tab-content">
                ${data.messages.length ? data.messages.map(m => `
                    <div style="padding:8px 0;border-bottom:1px solid var(--border-color)">
                        <span style="font-size:12px;color:var(--text-muted)">${new Date(m.created_at).toLocaleString()}</span>
                        <strong style="margin-left:8px;font-size:13px">${esc(m.user_name)}</strong>
                        <p style="font-size:14px;margin-top:4px;white-space:pre-wrap">${esc(m.content)}</p>
                    </div>
                `).join('') : '<p style="color:var(--text-muted)">No messages yet</p>'}
            </div>

            <div id="atab-documents" class="admin-tab-content">
                ${data.documents.length ? data.documents.map(d => `
                    <div class="doc-card" style="margin-bottom:8px">
                        <div class="doc-header">
                            <div class="doc-name">${esc(d.filename)} <span class="doc-badge">${d.doc_type}</span></div>
                            <span class="doc-status ${d.processing_status}">${d.processing_status}</span>
                        </div>
                        <div class="doc-meta">
                            <span>${esc(d.uploader)}</span>
                            <span>${new Date(d.created_at).toLocaleDateString()}</span>
                        </div>
                        ${d.user_description ? `<div class="doc-description">${esc(d.user_description)}</div>` : ''}
                        ${d.extracted_content && d.extracted_content.summary ? `<div class="doc-extracted"><p>${esc(d.extracted_content.summary)}</p></div>` : ''}
                    </div>
                `).join('') : '<p style="color:var(--text-muted)">No documents yet</p>'}
            </div>

            <div id="atab-notes" class="admin-tab-content">
                ${data.notes.length ? data.notes.map(n => `
                    <div class="note-card" style="margin-bottom:8px">
                        <div class="note-header">
                            <span style="font-size:13px;color:var(--text-secondary)">${esc(n.user_name)}</span>
                            <span class="note-category">${n.category.replace('_', ' ')}</span>
                        </div>
                        <div class="note-body">${esc(n.content)}</div>
                        <div class="note-time">${new Date(n.created_at).toLocaleString()}</div>
                    </div>
                `).join('') : '<p style="color:var(--text-muted)">No notes yet</p>'}
            </div>
            <div id="atab-process_map" class="admin-tab-content">
                <div id="admin-process-map-content"><p style="color:var(--text-muted)">Loading process map...</p></div>
            </div>
        `;
        loadAdminProcessMap(v.id);
    } catch (e) {
        detail.innerHTML = '<div class="loading-state">Error loading detail</div>';
    }
};

window.showAdminTab = function(tab, verticalId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tc => tc.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const tabEl = document.getElementById(`atab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    if (tab === 'process_map' && (verticalId || currentAdminVertical)) loadAdminProcessMap(verticalId || currentAdminVertical);
};

async function loadAdminProcessMap(verticalId) {
    const container = document.getElementById('admin-process-map-content');
    if (!container) return;
    try {
        const res = await fetch(`/api/process-map/${verticalId}`);
        if (!res.ok) { container.innerHTML = '<p style="color:var(--text-muted)">Failed to load process map</p>'; return; }
        const data = await res.json();
        if (!data || !data.map_data) {
            container.innerHTML = '<p style="color:var(--text-muted)">No process map generated yet for this vertical.</p>';
            return;
        }
        const md = data.map_data;
        const pm = md.processMap || md;
        const steps = pm.steps || [];
        const name = pm.processName || 'Process Map';
        const summary = data.source_summary || '';
        container.innerHTML = `
            <div style="margin-bottom:12px">
                <strong style="font-size:14px">${esc(name)}</strong>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px">v${data.version}</span>
            </div>
            ${summary ? `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">${esc(summary)}</p>` : ''}
            ${steps.length ? steps.map((s, i) => `
                <div style="padding:12px;margin-bottom:8px;background:var(--bg-card);border-radius:8px;border-left:3px solid var(--accent)">
                    <div style="font-weight:600;font-size:13px">Step ${s.stepNumber != null ? s.stepNumber : i + 1}: ${esc(s.name || '')}</div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${esc(s.description || '')}</div>
                    ${s.owner ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Owner: ${esc(s.owner)}</div>` : ''}
                </div>
            `).join('') : '<p style="color:var(--text-muted)">No steps in this map.</p>'}
        `;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted)">Error loading process map.</p>';
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/admin/api/users');
        const users = await res.json();
        const section = document.getElementById('admin-users-section');
        section.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;margin-top:24px">
                <h2 style="font-size:20px;font-weight:600">User Management</h2>
                <button onclick="addUser()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500">+ Add User</button>
            </div>
            <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;background:var(--bg-secondary);border-radius:12px;overflow:hidden">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-color)">
                            <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Email</th>
                            <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Name</th>
                            <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">PIN</th>
                            <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Last Active</th>
                            <th style="padding:12px 16px;text-align:left;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Admin</th>
                            <th style="padding:12px 16px;text-align:right;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr style="border-bottom:1px solid var(--border-color)">
                                <td style="padding:12px 16px;font-size:14px;color:var(--text-primary)">${esc(u.email)}</td>
                                <td style="padding:12px 16px;font-size:14px;color:var(--text-secondary)">${esc(u.display_name || '')}</td>
                                <td style="padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--text-primary)">${esc(u.pin || '—')}</td>
                                <td style="padding:12px 16px;font-size:13px;color:var(--text-muted)">${u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}</td>
                                <td style="padding:12px 16px;font-size:13px">${u.is_admin ? '<span style="color:#10B981">Yes</span>' : '<span style="color:var(--text-muted)">No</span>'}</td>
                                <td style="padding:12px 16px;text-align:right">
                                    <button onclick="regenPin('${esc(u.email)}')" style="padding:4px 10px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;margin-right:6px">Regenerate PIN</button>
                                    <button onclick="removeUser('${esc(u.email)}')" style="padding:4px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#EF4444;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif">Remove</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

window.addUser = async function() {
    const email = prompt('Enter email address for the new user:');
    if (!email) return;
    try {
        const res = await fetch('/admin/api/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to add user');
            return;
        }
        alert(`User created! PIN: ${data.pin}`);
        loadUsers();
    } catch (e) {
        alert('Failed to add user');
    }
};

window.regenPin = async function(email) {
    if (!confirm(`Regenerate PIN for ${email}?`)) return;
    try {
        const res = await fetch(`/admin/api/users/${encodeURIComponent(email)}/pin`, {method: 'PUT'});
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to regenerate PIN');
            return;
        }
        alert(`New PIN for ${email}: ${data.pin}`);
        loadUsers();
    } catch (e) {
        alert('Failed to regenerate PIN');
    }
};

window.removeUser = async function(email) {
    if (!confirm(`Remove user ${email}? This cannot be undone.`)) return;
    try {
        const res = await fetch(`/admin/api/users/${encodeURIComponent(email)}`, {method: 'DELETE'});
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to remove user');
            return;
        }
        loadUsers();
    } catch (e) {
        alert('Failed to remove user');
    }
};

function esc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
