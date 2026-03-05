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
        `;
    } catch (e) {
        detail.innerHTML = '<div class="loading-state">Error loading detail</div>';
    }
};

window.showAdminTab = function(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(tc => tc.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`atab-${tab}`).classList.add('active');
};

function esc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
