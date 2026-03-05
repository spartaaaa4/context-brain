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

        if (!verticals.length) {
            grid.innerHTML = '<div class="loading-state">No verticals found</div>';
            return;
        }

        grid.innerHTML = verticals.map(v => {
            const contributorAvatars = (v.contributors || []).slice(0, 5).map(c =>
                c.pic ? `<img src="${c.pic}" class="contributor-avatar" title="${c.name}">` : ''
            ).join('');

            const lastActivity = v.last_activity
                ? `Last active: ${new Date(v.last_activity).toLocaleDateString()}`
                : 'No activity yet';

            return `
                <a href="/vertical/${v.id}" class="vertical-card" style="border-top-color: ${v.color}">
                    <div class="card-header">
                        <div class="card-icon">${v.icon}</div>
                        <div>
                            <div class="card-title">${v.name}</div>
                            <div class="card-meta">${v.geography} &middot; ${v.type}</div>
                        </div>
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
                        <div class="contributors-row">${contributorAvatars}</div>
                    </div>
                    <div class="last-activity">${lastActivity}</div>
                </a>
            `;
        }).join('');
    } catch (e) {
        document.getElementById('verticals-grid').innerHTML = '<div class="loading-state">Error loading verticals</div>';
    }
});
