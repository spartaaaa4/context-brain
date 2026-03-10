document.addEventListener('DOMContentLoaded', async () => {
    try {
        const meRes = await fetch('/api/me');
        const me = await meRes.json();
        if (me.is_admin) {
            const container = document.getElementById('admin-link-container');
            if (container) {
                container.innerHTML = '<a href="/admin" class="nav-link" style="border:1px solid rgba(255,255,255,0.15);color:#F1F5F9">Admin Dashboard</a>';
            }
        }
    } catch (e) {}

    try {
        const res = await fetch('/api/verticals');
        const verticals = await res.json();
        const grid = document.getElementById('verticals-grid');
        const summaryStrip = document.getElementById('dashboard-summary-strip');

        if (!verticals.length) {
            grid.innerHTML = '<div class="loading-state">No verticals found</div>';
            return;
        }

        const totals = verticals.reduce((acc, v) => {
            acc.messages += Number((v.stats || {}).messages || 0);
            acc.documents += Number((v.stats || {}).documents || 0);
            acc.notes += Number((v.stats || {}).notes || 0);
            return acc;
        }, { messages: 0, documents: 0, notes: 0 });

        if (summaryStrip) {
            summaryStrip.innerHTML = `
                <div class="dashboard-summary-card">
                    <span class="dashboard-summary-value">${verticals.length}</span>
                    <span class="dashboard-summary-label">Verticals</span>
                </div>
                <div class="dashboard-summary-card">
                    <span class="dashboard-summary-value">${totals.messages}</span>
                    <span class="dashboard-summary-label">Messages</span>
                </div>
                <div class="dashboard-summary-card">
                    <span class="dashboard-summary-value">${totals.documents}</span>
                    <span class="dashboard-summary-label">Documents</span>
                </div>
                <div class="dashboard-summary-card">
                    <span class="dashboard-summary-value">${totals.notes}</span>
                    <span class="dashboard-summary-label">Notes</span>
                </div>
            `;
        }

        grid.innerHTML = verticals.map(v => {
            const contributorAvatars = (v.contributors || []).slice(0, 5).map(c =>
                c.pic
                    ? `<img src="${c.pic}" class="contributor-avatar" title="${escapeHtml(c.name || '')}">`
                    : `<div class="contributor-avatar contributor-avatar-fallback" title="${escapeHtml(c.name || '')}">${escapeHtml((c.name || '?').charAt(0))}</div>`
            ).join('');

            const lastActivity = v.last_activity
                ? `Last active: ${new Date(v.last_activity).toLocaleDateString()}`
                : 'No activity yet';

            const contributorCount = (v.contributors || []).length;

            return `
                <a href="/vertical/${v.id}" class="vertical-card" style="border-top-color: ${v.color}">
                    <div class="card-header">
                        <div class="card-icon" style="background:${v.color}18;color:${v.color}">${v.icon}</div>
                        <div>
                            <div class="card-title">${v.name}</div>
                            <div class="card-meta">${v.geography} &middot; ${v.type}</div>
                        </div>
                        <div class="vertical-card-arrow">→</div>
                    </div>
                    <div class="card-stats">
                        <div class="stat-item">
                            <span class="stat-value" style="color: ${v.color}">${v.stats.messages}</span>
                            <span class="stat-label">Messages</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" style="color: ${v.color}">${v.stats.documents}</span>
                            <span class="stat-label">Documents</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" style="color: ${v.color}">${v.stats.notes}</span>
                            <span class="stat-label">Notes</span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <span class="map-status">${v.map_status}</span>
                        <div class="contributors-row-wrap">
                            <div class="contributors-row">${contributorAvatars}</div>
                            <span class="contributors-count">${contributorCount} contributor${contributorCount === 1 ? '' : 's'}</span>
                        </div>
                    </div>
                    <div class="last-activity">${lastActivity}</div>
                </a>
            `;
        }).join('');
    } catch (e) {
        document.getElementById('verticals-grid').innerHTML = '<div class="loading-state">Error loading verticals</div>';
    }
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
