let currentAdminVertical = null;

document.addEventListener('DOMContentLoaded', () => {
    initCrossVerticalSection();
    loadAdminOverview();
});

function initCrossVerticalSection() {
    const container = document.getElementById('admin-cross-vertical');
    if (!container) return;
    container.innerHTML = `
        <div class="intel-card">
            <div class="intel-card-header">
                <h3>🔗 Cross-Vertical Analysis</h3>
            </div>
            <p class="dashboard-subtitle" style="margin-bottom:16px">Identify common pain points, reusable agent patterns, and build-once-serve-many automation opportunities across verticals.</p>
            <div class="intel-actions" style="justify-content:flex-start;padding:0">
                <button class="primary-btn" style="background:var(--accent)" onclick="loadCrossVerticalAnalysis()">Generate Cross-Vertical Analysis</button>
            </div>
            <div id="cross-vertical-results" style="margin-top:16px"></div>
        </div>
    `;
}

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
                <a href="/admin/api/export/${v.id}?format=automation_brief" class="export-btn">Export Automation Brief</a>
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

let allVerticals = [];
let allUsers = [];
let pendingRoleChanges = {};

async function loadUsers() {
    try {
        const [usersRes, verticalsRes] = await Promise.all([
            fetch('/admin/api/users'),
            fetch('/api/verticals')
        ]);
        allUsers = await usersRes.json();
        allVerticals = await verticalsRes.json();
        pendingRoleChanges = {};
        renderUserManagement();
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

function renderUserManagement() {
    const section = document.getElementById('admin-users-section');

    const verticalHeaders = allVerticals.map(v =>
        `<th class="role-matrix-th"><span class="role-matrix-vname">${esc(v.icon)} ${esc(v.name)}</span></th>`
    ).join('');

    const userRows = allUsers.map(u => {
        const roleMap = {};
        (u.vertical_roles || []).forEach(r => { roleMap[r.vertical_id] = r.role; });

        const verticalCells = allVerticals.map(v => {
            const currentRole = roleMap[v.id] || '';
            const selectId = `role-${u.id}-${v.id}`;
            return `<td class="role-matrix-td">
                <select class="role-matrix-select" id="${selectId}" data-user="${u.id}" data-vertical="${v.id}" data-original="${currentRole}" onchange="markRoleChange(this)">
                    <option value="" ${!currentRole ? 'selected' : ''}>—</option>
                    <option value="contributor" ${currentRole === 'contributor' ? 'selected' : ''}>Contributor</option>
                    <option value="leader" ${currentRole === 'leader' ? 'selected' : ''}>Leader</option>
                </select>
            </td>`;
        }).join('');

        return `<tr class="role-matrix-row">
            <td class="role-matrix-user">
                <div class="role-matrix-user-info">
                    <span class="role-matrix-name">${esc(u.display_name || u.email)}</span>
                    <span class="role-matrix-email">${esc(u.email)}</span>
                </div>
            </td>
            <td class="role-matrix-td role-matrix-pin">${esc(u.pin || '—')}</td>
            <td class="role-matrix-td">${u.is_admin ? '<span class="role-matrix-admin-yes">Admin</span>' : ''}</td>
            ${verticalCells}
            <td class="role-matrix-td role-matrix-actions">
                <button onclick="regenPin('${esc(u.email)}')" class="role-matrix-btn" title="Regenerate PIN">🔄</button>
                <button onclick="removeUser('${esc(u.email)}')" class="role-matrix-btn role-matrix-btn-danger" title="Remove user">✕</button>
            </td>
        </tr>`;
    }).join('');

    section.innerHTML = `
        <div class="role-matrix-header">
            <h2>User & Role Management</h2>
            <div class="role-matrix-header-actions">
                <button onclick="addUser()" class="role-matrix-add-btn">+ Add User</button>
                <button onclick="saveAllRoles()" class="role-matrix-save-btn" id="save-roles-btn" disabled>Save Changes</button>
            </div>
        </div>
        <p class="role-matrix-hint">Change role dropdowns for any user across verticals, then click "Save Changes" to apply all at once.</p>
        <div class="role-matrix-wrap">
            <table class="role-matrix-table">
                <thead>
                    <tr>
                        <th class="role-matrix-th role-matrix-th-user">User</th>
                        <th class="role-matrix-th">PIN</th>
                        <th class="role-matrix-th">Status</th>
                        ${verticalHeaders}
                        <th class="role-matrix-th"></th>
                    </tr>
                </thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>
    `;
}

window.markRoleChange = function(select) {
    const userId = select.dataset.user;
    const verticalId = select.dataset.vertical;
    const original = select.dataset.original;
    const newVal = select.value;
    const key = `${userId}__${verticalId}`;

    if (newVal === original) {
        delete pendingRoleChanges[key];
        select.classList.remove('role-changed');
    } else {
        pendingRoleChanges[key] = { user_id: userId, vertical_id: verticalId, role: newVal };
        select.classList.add('role-changed');
    }

    const btn = document.getElementById('save-roles-btn');
    const count = Object.keys(pendingRoleChanges).length;
    btn.disabled = count === 0;
    btn.textContent = count > 0 ? `Save Changes (${count})` : 'Save Changes';
};

window.saveAllRoles = async function() {
    const changes = Object.values(pendingRoleChanges);
    if (!changes.length) return;

    const btn = document.getElementById('save-roles-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    let errors = 0;
    for (const change of changes) {
        try {
            if (change.role === '') {
                const rolesRes = await fetch('/admin/api/user-roles');
                const allRoles = await rolesRes.json();
                const existing = allRoles.find(r => r.user_id === change.user_id && r.vertical_id === change.vertical_id);
                if (existing) {
                    const res = await fetch(`/admin/api/user-roles/${existing.id}`, { method: 'DELETE' });
                    if (!res.ok) errors++;
                }
            } else {
                const res = await fetch('/admin/api/user-roles', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(change)
                });
                if (!res.ok) errors++;
            }
        } catch (e) {
            errors++;
        }
    }

    if (errors > 0) {
        alert(`${errors} of ${changes.length} changes failed. Please retry.`);
    }
    loadUsers();
};

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

window.loadCrossVerticalAnalysis = async function() {
    const container = document.getElementById('cross-vertical-results');
    if (!container) return;
    container.innerHTML = '<div class="loading-state">Generating cross-vertical analysis...</div>';

    try {
        const res = await fetch('/api/admin/cross-vertical-analysis');
        const data = await res.json();
        if (!res.ok) {
            container.innerHTML = `<div class="login-error">${esc(data.error || 'Failed to generate analysis')}</div>`;
            return;
        }
        renderCrossVerticalAnalysis(data);
    } catch (e) {
        container.innerHTML = '<div class="login-error">Failed to generate cross-vertical analysis.</div>';
    }
};

function renderCrossVerticalAnalysis(data) {
    const container = document.getElementById('cross-vertical-results');
    if (!container) return;

    const overall = data.overallRecommendation
        ? `<div class="admin-pattern-summary"><strong>Overall Recommendation</strong><p>${esc(data.overallRecommendation)}</p></div>`
        : '';

    const painPoints = (data.commonPainPoints || []).map(item => `
        <tr>
            <td>${esc(item.painPoint || '')}</td>
            <td>${(item.affectedVerticals || []).map(v => `<span class="note-category">${esc(v)}</span>`).join(' ')}</td>
            <td>${esc(item.combinedMonthlyCost || 'Unknown')}</td>
            <td>${esc(item.sharedAutomationOpportunity || '')}</td>
        </tr>
    `).join('');

    const patterns = (data.sharedProcessPatterns || []).map(item => `
        <div class="admin-pattern-card">
            <div class="admin-pattern-card-header">
                <strong>${esc(item.pattern || 'Pattern')}</strong>
                <span class="priority-badge medium">Build Once, Serve Many</span>
            </div>
            <p>${esc(item.description || '')}</p>
            <div class="admin-pattern-meta"><strong>Verticals:</strong> ${esc((item.verticals || []).join(', '))}</div>
            <div class="admin-pattern-meta"><strong>Common steps:</strong> ${esc((item.commonSteps || []).join(', '))}</div>
            <div class="admin-pattern-meta"><strong>Differences:</strong> ${esc((item.differences || []).join(' | '))}</div>
            <div class="admin-pattern-meta"><strong>Reusable agent design:</strong> ${esc(item.reusableAgentDesign || '')}</div>
        </div>
    `).join('');

    const priorityMatrix = (data.automationPriorityMatrix || []).map(item => `
        <div class="intel-readiness-candidate">
            <div class="intel-readiness-candidate-header">
                <strong>#${esc(String(item.priority || '–'))} ${esc(item.automationTarget || 'Target')}</strong>
                ${item.buildOnceServeMany ? '<span class="priority-badge high">Shared Build</span>' : ''}
            </div>
            <div class="intel-readiness-candidate-line">Verticals: ${esc((item.verticals || []).join(', '))}</div>
            <div class="intel-readiness-candidate-line">Total monthly cost: ${esc(item.totalMonthlyCost || 'Unknown')}</div>
            <div class="intel-readiness-candidate-line">Estimated savings: ${esc(item.totalEstimatedSavings || 'Unknown')}</div>
            <div class="intel-readiness-candidate-line">Recommended beachhead: ${esc(item.recommendedBeachhead || 'Not specified')}</div>
        </div>
    `).join('');

    const uniqueInsights = (data.uniqueInsightsPerVertical || []).map(item => `
        <div class="intel-pain-card">
            <div class="intel-pain-header">
                <span class="intel-pain-title">${esc(item.vertical || 'Vertical')}</span>
            </div>
            <div class="intel-pain-detail"><span class="intel-detail-label">Unique aspect:</span> ${esc(item.uniqueAspect || '')}</div>
            <div class="intel-pain-detail"><span class="intel-detail-label">Implication:</span> ${esc(item.implication || '')}</div>
        </div>
    `).join('');

    container.innerHTML = `
        ${overall}
        <div class="intel-card" style="padding:0">
            <div class="intel-card-header" style="padding:24px 24px 0 24px"><h3>Common Pain Points</h3></div>
            <div class="intel-table-wrap" style="padding:0 24px 24px 24px">
                <table class="intel-table">
                    <thead><tr><th>Pain Point</th><th>Affected Verticals</th><th>Combined Cost</th><th>Shared Opportunity</th></tr></thead>
                    <tbody>${painPoints || '<tr><td colspan="4">No shared pain points found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="intel-card">
            <div class="intel-card-header"><h3>Shared Process Patterns</h3></div>
            <div class="admin-pattern-grid">${patterns || '<p class="intel-muted">No shared patterns found.</p>'}</div>
        </div>
        <div class="intel-card">
            <div class="intel-card-header"><h3>Automation Priority Matrix</h3></div>
            ${priorityMatrix || '<p class="intel-muted">No cross-vertical priorities found.</p>'}
        </div>
        <div class="intel-card">
            <div class="intel-card-header"><h3>Unique Insights Per Vertical</h3></div>
            ${uniqueInsights || '<p class="intel-muted">No unique insights captured.</p>'}
        </div>
    `;
}
