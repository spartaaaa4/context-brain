const VERTICAL_ID = window.VERTICAL_ID;
const VERTICAL_COLOR = window.VERTICAL_COLOR;
let currentMapId = null;
let pendingFile = null;
let intelligenceData = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initChat();
    initVoice();
    initDocuments();
    initNotes();
    loadChatHistory();
    loadDocuments();
    loadNotes();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
            if (tab.dataset.tab === 'process') {
                loadIntelligence(); // Cached intelligence when tab loads
            }
        });
    });
}

function initChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', sendMessage);
}

function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.style.display = 'flex';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const langMap = {
        'okaygo': 'hi-IN', 'aasaanjobs': 'hi-IN', 'bv': 'hi-IN', 'gobetter': 'hi-IN',
        'troopers': 'ms-MY', 'myrobin': 'id-ID'
    };
    recognition.lang = langMap[VERTICAL_ID] || 'en-US';

    let isRecording = false;
    let finalTranscript = '';

    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
            voiceBtn.classList.remove('recording');
            isRecording = false;
        } else {
            finalTranscript = '';
            recognition.start();
            voiceBtn.classList.add('recording');
            isRecording = true;
        }
    });

    recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        document.getElementById('chat-input').value = finalTranscript + interim;
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('recording');
        isRecording = false;
    };

    recognition.onerror = () => {
        voiceBtn.classList.remove('recording');
        isRecording = false;
    };
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;

    const chatMessages = document.getElementById('chat-messages');
    const empty = chatMessages.querySelector('.chat-empty');
    if (empty) empty.remove();

    appendMessage({
        role: 'user',
        content: message,
        user_name: 'You',
        user_pic: null,
        created_at: new Date().toISOString()
    });

    document.getElementById('typing-indicator').style.display = 'flex';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verticalId: VERTICAL_ID, message })
        });

        document.getElementById('typing-indicator').style.display = 'none';

        if (!res.ok) {
            const err = await res.json();
            appendSystemMessage(err.error || 'Failed to send message');
            return;
        }

        const data = await res.json();
        appendMessage({
            role: 'assistant',
            content: data.response,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        document.getElementById('typing-indicator').style.display = 'none';
        appendSystemMessage('Network error. Please try again.');
    } finally {
        document.getElementById('send-btn').disabled = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function appendMessage(msg) {
    const chatMessages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const name = msg.role === 'user' ? (msg.user_name || 'You') : 'AI Analyst';

    let avatar = '';
    if (msg.role === 'user') {
        avatar = msg.user_pic
            ? `<img src="${msg.user_pic}" class="msg-avatar">`
            : `<div class="msg-avatar-ai" style="background: ${VERTICAL_COLOR}22; color: ${VERTICAL_COLOR}">${name[0]}</div>`;
    } else {
        avatar = '<div class="msg-avatar-ai">🧠</div>';
    }

    div.innerHTML = `
        ${avatar}
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-name">${name}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-bubble" style="${msg.role === 'user' ? `background: ${VERTICAL_COLOR}` : ''}">${escapeHtml(msg.content)}</div>
        </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(text) {
    const chatMessages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center;padding:12px;color:#EF4444;font-size:13px;';
    div.textContent = text;
    chatMessages.appendChild(div);
}

async function loadChatHistory() {
    try {
        const res = await fetch(`/api/chat/${VERTICAL_ID}`);
        const messages = await res.json();

        const chatMessages = document.getElementById('chat-messages');
        if (messages.length === 0) return;

        chatMessages.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
}

function initDocuments() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) openUploadModal(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) openUploadModal(fileInput.files[0]);
        fileInput.value = '';
    });

    document.getElementById('modal-upload-btn').addEventListener('click', uploadFile);
}

function openUploadModal(file) {
    pendingFile = file;
    document.getElementById('modal-filename').textContent = `${file.name} (${formatFileSize(file.size)})`;
    document.getElementById('modal-description').value = '';
    document.getElementById('upload-modal').style.display = 'flex';
}

window.closeUploadModal = function() {
    document.getElementById('upload-modal').style.display = 'none';
    pendingFile = null;
};

async function uploadFile() {
    if (!pendingFile) return;

    const description = document.getElementById('modal-description').value.trim();
    if (!description) {
        alert('Please provide a description of the document.');
        return;
    }

    const docType = document.getElementById('modal-doctype').value;
    const btn = document.getElementById('modal-upload-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('verticalId', VERTICAL_ID);
    formData.append('docType', docType);
    formData.append('description', description);

    try {
        const res = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Upload failed');
            return;
        }

        closeUploadModal();
        loadDocuments();
    } catch (e) {
        alert('Upload failed. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
}

async function loadDocuments() {
    try {
        const res = await fetch(`/api/documents/${VERTICAL_ID}`);
        const docs = await res.json();
        const list = document.getElementById('documents-list');

        if (!docs.length) {
            list.innerHTML = '<div class="loading-state">No documents uploaded yet</div>';
            return;
        }

        list.innerHTML = docs.map(doc => {
            let extractedHtml = '';
            if (doc.processing_status === 'done' && doc.extracted_content) {
                const ec = doc.extracted_content;
                extractedHtml = `
                    <button class="doc-extracted-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        View AI Summary
                    </button>
                    <div class="doc-extracted" style="display:none">
                        <div class="doc-extracted-content">
                            ${ec.summary ? `<p><strong>Summary:</strong> ${escapeHtml(ec.summary)}</p>` : ''}
                            ${ec.rolesFound && ec.rolesFound.length ? `<p><strong>Roles:</strong> ${ec.rolesFound.join(', ')}</p>` : ''}
                            ${ec.toolsFound && ec.toolsFound.length ? `<p><strong>Tools:</strong> ${ec.toolsFound.join(', ')}</p>` : ''}
                            ${ec.painPointsFound && ec.painPointsFound.length ? `<p><strong>Pain Points:</strong> ${ec.painPointsFound.join(', ')}</p>` : ''}
                            ${ec.keyFacts && ec.keyFacts.length ? `<p><strong>Key Facts:</strong> ${ec.keyFacts.join(', ')}</p>` : ''}
                            ${ec.relevanceScore ? `<p><strong>Relevance:</strong> ${ec.relevanceScore}</p>` : ''}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="doc-card" data-doc-id="${doc.id}">
                    <div class="doc-header">
                        <div class="doc-name">
                            ${escapeHtml(doc.filename)}
                            <span class="doc-badge">${doc.doc_type}</span>
                        </div>
                        <span class="doc-status ${doc.processing_status}">${doc.processing_status}</span>
                    </div>
                    <div class="doc-meta">
                        <span>${doc.uploader ? doc.uploader.name : 'Unknown'}</span>
                        <span>${formatFileSize(doc.file_size)}</span>
                        <span>${new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    ${doc.user_description ? `<div class="doc-description">${escapeHtml(doc.user_description)}</div>` : ''}
                    ${extractedHtml}
                </div>
            `;
        }).join('');

        docs.filter(d => d.processing_status === 'pending' || d.processing_status === 'processing')
            .forEach(d => pollDocStatus(d.id));
    } catch (e) {
        document.getElementById('documents-list').innerHTML = '<div class="loading-state">Error loading documents</div>';
    }
}

async function pollDocStatus(docId) {
    const check = async () => {
        try {
            const res = await fetch(`/api/documents/${docId}/status`);
            const data = await res.json();
            if (data.processing_status === 'done' || data.processing_status === 'failed') {
                loadDocuments();
                return;
            }
            setTimeout(check, 3000);
        } catch (e) {
            setTimeout(check, 5000);
        }
    };
    setTimeout(check, 3000);
}

function initNotes() {
    document.getElementById('add-note-btn').addEventListener('click', addNote);
}

async function addNote() {
    const content = document.getElementById('note-content').value.trim();
    if (!content) return;

    const category = document.getElementById('note-category').value;
    const btn = document.getElementById('add-note-btn');
    btn.disabled = true;

    try {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verticalId: VERTICAL_ID, content, category })
        });

        if (res.ok) {
            document.getElementById('note-content').value = '';
            loadNotes();
        }
    } catch (e) {
        console.error('Failed to add note:', e);
    } finally {
        btn.disabled = false;
    }
}

async function loadNotes() {
    try {
        const res = await fetch(`/api/notes/${VERTICAL_ID}`);
        const notes = await res.json();
        const list = document.getElementById('notes-list');

        if (!notes.length) {
            list.innerHTML = '<div class="loading-state">No notes yet</div>';
            return;
        }

        list.innerHTML = notes.map(note => `
            <div class="note-card">
                <div class="note-header">
                    <div class="note-author">
                        ${note.user_pic ? `<img src="${note.user_pic}" class="note-author-pic">` : ''}
                        ${escapeHtml(note.user_name)}
                    </div>
                    <span class="note-category">${note.category.replace('_', ' ')}</span>
                </div>
                <div class="note-body">${escapeHtml(note.content)}</div>
                <div class="note-time">${new Date(note.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('notes-list').innerHTML = '<div class="loading-state">Error loading notes</div>';
    }
}

async function loadIntelligence() {
    const loading = document.getElementById('intel-loading');
    const content = document.getElementById('intel-content');
    const empty = document.getElementById('intel-empty');
    const stale = document.getElementById('intel-stale-banner');

    try {
        const res = await fetch(`/api/intelligence/${VERTICAL_ID}`);
        if (!res.ok) {
            if (res.status === 404) {
                empty.style.display = 'block';
                content.style.display = 'none';
                stale.style.display = 'none';
                return;
            }
            throw new Error('Failed to load intelligence');
        }
        const data = await res.json();

        if (!data.intelligence) {
            empty.style.display = 'block';
            content.style.display = 'none';
            stale.style.display = 'none';
            return;
        }

        intelligenceData = data.intelligence;
        empty.style.display = 'none';
        content.style.display = 'block';

        if (data.stale) {
            stale.style.display = 'flex';
        } else {
            stale.style.display = 'none';
        }

        renderIntelligence(data.intelligence);
    } catch (e) {
        console.error('Failed to load intelligence:', e);
        empty.style.display = 'block';
        content.style.display = 'none';
    }
}

window.regenerateProcessMap = async function() {
    const btn = document.querySelector('.intel-regen-map-btn');
    if (btn) btn.disabled = true;
    try {
        await refreshIntelligence();
    } catch (e) {
        alert('Failed to regenerate process map. Please try again.');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.refreshIntelligence = async function() {
    const loading = document.getElementById('intel-loading');
    const content = document.getElementById('intel-content');
    const empty = document.getElementById('intel-empty');
    const stale = document.getElementById('intel-stale-banner');

    loading.style.display = 'block';
    content.style.display = 'none';
    empty.style.display = 'none';
    stale.style.display = 'none';

    try {
        const res = await fetch(`/api/intelligence/${VERTICAL_ID}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Failed to generate intelligence');
            loading.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        const data = await res.json();
        intelligenceData = data.intelligence;
        loading.style.display = 'none';
        content.style.display = 'block';
        renderIntelligence(data.intelligence);
    } catch (e) {
        alert('Failed to generate intelligence. Please try again.');
        loading.style.display = 'none';
        empty.style.display = 'block';
    }
};

function renderIntelligence(data) {
    renderBusinessProfile(data.businessProfile || {});
    renderBusinessModelCanvas(data.businessModelCanvas || {});
    renderKnowledgeGaps(data.knowledgeGaps || []);
    renderServiceBlueprint(data.serviceBlueprint || {});
    renderPainPoints(data.painPoints || []);
    renderTeamStructure(data.teamStructure || []);
    renderToolsInventory(data.toolsInventory || []);
    renderContextCoverage(data.contextCoverage || {});
    renderAutomationReadiness(data.automationReadiness || {});
}

function profileFieldLabel(key) {
    const labels = {
        whatTheyDo: 'What They Do',
        businessModel: 'Business Model',
        geography: 'Geography',
        scale: 'Scale',
        keyClients: 'Key Clients',
        teamSize: 'Team Size',
        primaryLanguages: 'Primary Languages',
        communicationChannels: 'Communication Channels'
    };
    return labels[key] || key;
}

function formatDisplayValue(value) {
    if (value == null || value === '') return '<span class="intel-muted">Not yet captured</span>';
    if (Array.isArray(value)) {
        return value.length ? escapeHtml(value.join(', ')) : '<span class="intel-muted">Not yet captured</span>';
    }
    if (typeof value === 'object') {
        const parts = Object.entries(value)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `${labelize(k)}: ${Array.isArray(v) ? v.join(', ') : v}`);
        return parts.length ? escapeHtml(parts.join(' | ')) : '<span class="intel-muted">Not yet captured</span>';
    }
    return escapeHtml(String(value));
}

function labelize(value) {
    return String(value)
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, ch => ch.toUpperCase());
}

function renderBusinessProfile(profile) {
    const container = document.getElementById('intel-business-profile');
    const fields = ['whatTheyDo', 'businessModel', 'geography', 'scale', 'keyClients', 'teamSize', 'primaryLanguages', 'communicationChannels'];

    const fieldsHtml = fields.map(field => {
        const value = profile[field];
        const editableValue = typeof value === 'string' ? value : '';
        const displayValue = formatDisplayValue(value);
        return `
            <div class="intel-profile-field" data-field="${field}">
                <div class="intel-profile-label">${profileFieldLabel(field)}</div>
                <div class="intel-profile-value" id="profile-val-${field}">${displayValue}</div>
                <button class="intel-edit-btn" onclick="editBusinessField('${field}', ${editableValue ? "'" + escapeHtml(String(editableValue)).replace(/'/g, "\\'") + "'" : 'null'})" title="Edit">✏️</button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="intel-card-header">
            <h3>📋 Business Profile</h3>
        </div>
        <div class="intel-profile-grid">${fieldsHtml}</div>
    `;
}

function renderBusinessModelCanvas(canvas) {
    const container = document.getElementById('intel-business-model-canvas');
    const valueProp = canvas.valueProposition || {};
    const revenue = canvas.revenueModel || {};
    const resources = canvas.keyResources || {};
    const costStructure = canvas.costStructure || {};
    const competitive = canvas.competitivePosition || {};
    const activities = canvas.keyActivities || [];

    const activitiesHtml = activities.length ? activities.map(activity => {
        const cost = (activity.costIntensity || 'low').toLowerCase();
        const readiness = (activity.automationReady || 'low').toLowerCase();
        return `
            <div class="intel-canvas-activity cost-${cost}">
                <div class="intel-canvas-activity-top">
                    <strong>${escapeHtml(activity.activity || 'Unknown activity')}</strong>
                    <span class="intel-canvas-cost cost-${cost}">${cost.toUpperCase()} COST</span>
                </div>
                <div class="intel-canvas-activity-meta">${escapeHtml(activity.category || 'operations')}</div>
                ${activity.peopleInvolved ? `<div class="intel-canvas-activity-detail">👥 ${escapeHtml(activity.peopleInvolved)}</div>` : ''}
                ${activity.timePerWeek ? `<div class="intel-canvas-activity-detail">⏱ ${escapeHtml(activity.timePerWeek)}</div>` : ''}
                ${activity.whyItMatters ? `<p class="intel-canvas-activity-why">${escapeHtml(activity.whyItMatters)}</p>` : ''}
                <span class="intel-canvas-readiness readiness-${readiness}">Automation: ${readiness}</span>
            </div>
        `;
    }).join('') : '<p class="intel-muted">No key activities captured yet.</p>';

    const renderKeyValueList = (items) => Object.entries(items)
        .filter(([, value]) => value)
        .map(([key, value]) => `<div class="intel-canvas-line"><span>${labelize(key)}</span><strong>${escapeHtml(Array.isArray(value) ? value.join(', ') : String(value))}</strong></div>`)
        .join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>💼 Business Model Canvas</h3></div>
        <div class="intel-canvas-grid">
            <div class="intel-canvas-card">
                <h4>Value Proposition</h4>
                <div class="intel-canvas-two-col">
                    <div class="intel-canvas-value-box">
                        <span class="intel-canvas-label">To Clients</span>
                        <p>${valueProp.toClients ? escapeHtml(valueProp.toClients) : '<span class="intel-muted">Not yet captured</span>'}</p>
                    </div>
                    <div class="intel-canvas-value-box">
                        <span class="intel-canvas-label">To Workers / Users</span>
                        <p>${valueProp.toWorkers ? escapeHtml(valueProp.toWorkers) : '<span class="intel-muted">Not yet captured</span>'}</p>
                    </div>
                </div>
            </div>
            <div class="intel-canvas-card">
                <h4>Revenue Model</h4>
                ${renderKeyValueList({
                    pricingMechanism: revenue.pricingMechanism || 'Not yet captured',
                    averageTicketSize: revenue.averageTicketSize || 'Not yet captured',
                    paymentTerms: revenue.paymentTerms || 'Not yet captured',
                    marginStructure: revenue.marginStructure || 'Not yet captured'
                })}
            </div>
            <div class="intel-canvas-card intel-canvas-span-2">
                <h4>Key Activities</h4>
                <div class="intel-canvas-activities">${activitiesHtml}</div>
            </div>
            <div class="intel-canvas-card">
                <h4>Key Resources</h4>
                ${renderKeyValueList({
                    people: resources.people || 'Not yet captured',
                    technology: resources.technology || 'Not yet captured',
                    data: resources.data || 'Not yet captured',
                    relationships: resources.relationships || 'Not yet captured'
                })}
            </div>
            <div class="intel-canvas-card">
                <h4>Cost Structure</h4>
                <div class="intel-canvas-list">
                    ${(costStructure.biggestCostDrivers || []).map(item => `<div class="intel-canvas-list-item">${escapeHtml(item)}</div>`).join('') || '<div class="intel-muted">No cost drivers captured yet.</div>'}
                </div>
                ${costStructure.fixedVsVariable ? `<div class="intel-canvas-line"><span>Fixed vs Variable</span><strong>${escapeHtml(costStructure.fixedVsVariable)}</strong></div>` : ''}
                ${costStructure.unitEconomics ? `<div class="intel-canvas-line"><span>Unit Economics</span><strong>${escapeHtml(costStructure.unitEconomics)}</strong></div>` : ''}
            </div>
            <div class="intel-canvas-card intel-canvas-span-2">
                <h4>Competitive Position</h4>
                <div class="intel-canvas-three-col">
                    <div><span class="intel-canvas-label">Competitors</span><p>${competitive.competitors && competitive.competitors.length ? escapeHtml(competitive.competitors.join(', ')) : '<span class="intel-muted">Not yet captured</span>'}</p></div>
                    <div><span class="intel-canvas-label">Defensibility</span><p>${competitive.defensibility ? escapeHtml(competitive.defensibility) : '<span class="intel-muted">Not yet captured</span>'}</p></div>
                    <div><span class="intel-canvas-label">Vulnerability</span><p>${competitive.vulnerability ? escapeHtml(competitive.vulnerability) : '<span class="intel-muted">Not yet captured</span>'}</p></div>
                </div>
            </div>
        </div>
    `;
}

function renderKnowledgeGaps(gaps) {
    const container = document.getElementById('intel-knowledge-gaps');
    if (!gaps || !gaps.length) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>❓ Knowledge Gaps</h3></div>
            <p class="intel-muted">No knowledge gaps identified yet.</p>
        `;
        return;
    }

    const gapsHtml = gaps.map((gap, idx) => {
        const question = typeof gap === 'string' ? gap : (gap.question || gap);
        const answered = gap.answered || false;
        return `
            <div class="intel-gap-item ${answered ? 'answered' : ''}" id="gap-item-${idx}">
                <div class="intel-gap-row">
                    <span class="intel-gap-check">${answered ? '☑' : '☐'}</span>
                    <span class="intel-gap-question">${escapeHtml(String(question))}</span>
                </div>
                <div class="intel-gap-actions">
                    <button class="intel-gap-answer-btn" onclick="toggleGapAnswer(${idx})">Answer Inline</button>
                    <a href="#" class="intel-gap-chat-link" onclick="discussInChat('${escapeHtml(String(question)).replace(/'/g, "\\'")}'); return false;">Discuss in Chat</a>
                </div>
                <div class="intel-gap-answer-form" id="gap-answer-${idx}" style="display:none">
                    <textarea id="gap-textarea-${idx}" placeholder="Type your answer..." rows="2"></textarea>
                    <button class="primary-btn" style="background:${VERTICAL_COLOR};padding:6px 14px;font-size:12px" onclick="answerKnowledgeGap(${idx}, '${escapeHtml(String(question)).replace(/'/g, "\\'")}')">Save Answer</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>❓ Knowledge Gaps</h3></div>
        ${gapsHtml}
    `;
}

function parseCostEstimateToNumber(costString) {
    if (!costString) return null;
    const normalized = String(costString).toLowerCase().replace(/,/g, '');
    const match = normalized.match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    if (Number.isNaN(value)) return null;
    if (normalized.includes('lakh')) return value * 100000;
    if (normalized.includes('million') || normalized.includes(' mn')) return value * 1000000;
    if (normalized.includes('k')) return value * 1000;
    return value;
}

function formatCurrencyAmount(amount, symbol = '₹') {
    if (amount == null) return 'Not estimated';
    if (symbol === 'RM') return `~RM${(amount / 1000).toFixed(1)}k/month`;
    if (symbol === 'Rp') return `~Rp${(amount / 1000000).toFixed(1)}M/month`;
    return `~₹${(amount / 100000).toFixed(1)} lakh/month`;
}

function getCostSymbol(stages) {
    for (const stage of stages) {
        const cost = (((stage || {}).opsTeamWork || {}).costEstimate || {}).estimatedMonthlyCost || '';
        if (cost.includes('RM')) return 'RM';
        if (cost.includes('Rp')) return 'Rp';
    }
    return '₹';
}

function buildServiceBlueprintCostSummary(serviceBlueprint) {
    const stages = serviceBlueprint.stages || [];
    const stageCosts = stages.map(stage => {
        const costInfo = ((stage.opsTeamWork || {}).costEstimate) || {};
        return {
            stageName: stage.stageName || 'Stage',
            raw: costInfo.estimatedMonthlyCost,
            numeric: parseCostEstimateToNumber(costInfo.estimatedMonthlyCost),
        };
    }).filter(item => item.numeric != null);

    if (!stageCosts.length) return null;

    const symbol = getCostSymbol(stages);
    const total = stageCosts.reduce((sum, item) => sum + item.numeric, 0);
    const topStages = [...stageCosts].sort((a, b) => b.numeric - a.numeric).slice(0, 3);
    const lowSavings = total * 0.6;
    const highSavings = total * 0.7;

    return {
        symbol,
        total,
        totalLabel: formatCurrencyAmount(total, symbol),
        topStages,
        savingsLabel: `${formatCurrencyAmount(lowSavings, symbol)} to ${formatCurrencyAmount(highSavings, symbol)}`,
    };
}

function buildCostVerificationPrompt(stageName, costBasis, estimate) {
    return `Please verify this ops cost estimate for ${stageName}: ${estimate || 'unknown estimate'}. Math used: ${costBasis || 'no math captured yet'}.`;
}

function renderServiceBlueprint(serviceBlueprint) {
    const container = document.getElementById('intel-service-blueprint');
    const stages = serviceBlueprint.stages || [];

    if (!stages.length) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>🗺️ Service Blueprint</h3></div>
            <p class="intel-muted">No service blueprint captured yet. Add more context to generate the operational lanes.</p>
        `;
        return;
    }

    const summary = buildServiceBlueprintCostSummary(serviceBlueprint);
    const summaryHtml = summary ? `
        <div class="intel-cost-summary">
            <div class="intel-cost-summary-main">📊 Estimated Total Monthly Ops Cost: <strong>${summary.totalLabel}</strong></div>
            <div class="intel-cost-summary-sub">Highest cost stages: ${summary.topStages.map(item => `${escapeHtml(item.stageName)} (${formatCurrencyAmount(item.numeric, summary.symbol)})`).join(' | ')}</div>
            <div class="intel-cost-summary-sub">Potential savings from automation: ${summary.savingsLabel}</div>
        </div>
    ` : '';

    const stagesHtml = stages.map((stage, idx) => {
        const customer = stage.customerJourney || {};
        const worker = stage.workerJourney || {};
        const ops = stage.opsTeamWork || {};
        const cost = ops.costEstimate || {};
        const readiness = ((stage.automationOpportunity || {}).readiness || 'low').toLowerCase();
        const confidence = (cost.confidence || 'low').toLowerCase();
        const stepNum = idx + 1;
        const verifyPrompt = buildCostVerificationPrompt(stage.stageName || `Stage ${stepNum}`, cost.costBasis, cost.estimatedMonthlyCost);

        return `
            <div class="intel-blueprint-stage">
                <div class="intel-blueprint-stage-header">
                    <div class="intel-step-number" style="background:${VERTICAL_COLOR}22;color:${VERTICAL_COLOR}">${stepNum}</div>
                    <div>
                        <div class="intel-step-name">${escapeHtml(stage.stageName || `Stage ${stepNum}`)}</div>
                        <div class="intel-blueprint-stage-subtitle">${escapeHtml(serviceBlueprint.processName || 'Core process')}</div>
                    </div>
                    <span class="intel-auto-badge intel-auto-${readiness}">⚡ ${readiness} readiness</span>
                </div>
                <div class="intel-blueprint-grid">
                    <div class="intel-blueprint-lane">
                        <span class="intel-canvas-label">Client / Customer</span>
                        <p>${customer.action ? escapeHtml(customer.action) : '<span class="intel-muted">Not yet captured</span>'}</p>
                        ${customer.goal ? `<div class="intel-blueprint-detail">Goal: ${escapeHtml(customer.goal)}</div>` : ''}
                    </div>
                    <div class="intel-blueprint-lane">
                        <span class="intel-canvas-label">Worker / Candidate</span>
                        <p>${worker.action ? escapeHtml(worker.action) : '<span class="intel-muted">Not yet captured</span>'}</p>
                        ${worker.friction ? `<div class="intel-blueprint-detail">Friction: ${escapeHtml(worker.friction)}</div>` : ''}
                    </div>
                    <div class="intel-blueprint-lane intel-blueprint-ops">
                        <span class="intel-canvas-label">Ops Team Work</span>
                        <p>${ops.action ? escapeHtml(ops.action) : '<span class="intel-muted">Not yet captured</span>'}</p>
                        <div class="intel-step-badges">
                            ${ops.owner ? `<span class="intel-badge">👤 ${escapeHtml(ops.owner)}</span>` : ''}
                            ${ops.teamSize ? `<span class="intel-badge">👥 ${escapeHtml(ops.teamSize)}</span>` : ''}
                            ${ops.hoursPerDay ? `<span class="intel-badge">⏱ ${escapeHtml(ops.hoursPerDay)} hrs/day</span>` : ''}
                            ${ops.toolsUsed && ops.toolsUsed.length ? `<span class="intel-badge">🔧 ${ops.toolsUsed.map(tool => escapeHtml(tool)).join(', ')}</span>` : ''}
                        </div>
                        ${ops.painPoint ? `<div class="intel-blueprint-detail">Pain point: ${escapeHtml(ops.painPoint)}</div>` : ''}
                        ${cost.estimatedMonthlyCost ? `
                            <div class="intel-cost-badge confidence-${confidence}">
                                <span>💰 ${escapeHtml(cost.estimatedMonthlyCost)}</span>
                                <span class="intel-cost-basis">${escapeHtml(cost.costBasis || '')}</span>
                                <a href="#" onclick="discussInChat('${escapeHtml(verifyPrompt).replace(/'/g, "\\'")}'); return false;">Verify this</a>
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${(stage.automationOpportunity || {}).idea ? `<div class="intel-step-idea">Automation idea: ${escapeHtml(stage.automationOpportunity.idea)}</div>` : ''}
                ${stage.validationQuestions && stage.validationQuestions.length ? `<div class="intel-blueprint-questions">${stage.validationQuestions.map(question => `<span class="intel-badge">❓ ${escapeHtml(question)}</span>`).join('')}</div>` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>🗺️ Service Blueprint</h3><span class="intel-card-subtitle">${escapeHtml(serviceBlueprint.processName || '')}</span></div>
        ${summaryHtml}
        ${stagesHtml}
    `;
}

function scoreClass(score) {
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-low';
}

function renderAutomationReadiness(readiness) {
    const container = document.getElementById('intel-automation-readiness');
    if (!readiness || Object.keys(readiness).length === 0) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>🤖 Automation Readiness</h3></div>
            <p class="intel-muted">No readiness score has been generated yet.</p>
        `;
        return;
    }

    const dimensions = [
        ['Context Completeness', readiness.contextCompleteness || {}],
        ['Process Clarity', readiness.processClarity || {}],
        ['Data Availability', readiness.dataAvailability || {}],
        ['Team Readiness', readiness.teamReadiness || {}],
    ];

    const dimensionHtml = dimensions.map(([label, item]) => {
        const score = Number(item.score || 0);
        return `
            <div class="intel-readiness-row">
                <div class="intel-readiness-label">${label}</div>
                <div class="intel-readiness-bar">
                    <div class="intel-readiness-fill ${scoreClass(score)}" style="width:${Math.max(0, Math.min(100, score))}%"></div>
                </div>
                <div class="intel-readiness-score">${score}%</div>
                <div class="intel-readiness-detail">${escapeHtml(item.detail || 'No detail captured')}</div>
            </div>
        `;
    }).join('');

    const candidates = readiness.topAutomationCandidates || [];
    const blockers = readiness.blockers || [];
    const nextSteps = readiness.recommendedNextSteps || [];

    container.innerHTML = `
        <div class="intel-card-header">
            <h3>🤖 Automation Readiness</h3>
            <span class="intel-readiness-overall ${scoreClass(Number(readiness.overallScore || 0))}">Overall: ${Number(readiness.overallScore || 0)}/100</span>
        </div>
        <div class="intel-readiness-grid">${dimensionHtml}</div>
        <div class="intel-readiness-candidates">
            <h4>Top Automation Candidates</h4>
            ${candidates.length ? candidates.map(candidate => `
                <div class="intel-readiness-candidate">
                    <div class="intel-readiness-candidate-header">
                        <strong>#${escapeHtml(String(candidate.priority || '–'))} ${escapeHtml(candidate.process || 'Unknown process')}</strong>
                        <span class="priority-badge high">Priority</span>
                    </div>
                    <div class="intel-readiness-candidate-line">Current cost: ${escapeHtml(candidate.currentMonthlyCost || 'Unknown')}</div>
                    <div class="intel-readiness-candidate-line">Agent type: ${escapeHtml(candidate.automationType || 'Unknown')}</div>
                    <div class="intel-readiness-candidate-line">Expected savings: ${escapeHtml(candidate.estimatedSavings || 'Unknown')}</div>
                    <div class="intel-readiness-candidate-line">Time to build: ${escapeHtml(candidate.timeToImplement || 'Unknown')}</div>
                    <div class="intel-readiness-candidate-line">Prerequisite: ${escapeHtml(candidate.prerequisite || 'None captured')}</div>
                </div>
            `).join('') : '<p class="intel-muted">No automation candidates captured yet.</p>'}
        </div>
        <div class="intel-readiness-footer">
            <div class="intel-readiness-footer-card">
                <span class="intel-canvas-label">🚫 Blockers</span>
                <p>${blockers.length ? escapeHtml(blockers.join(' | ')) : '<span class="intel-muted">No blockers captured</span>'}</p>
            </div>
            <div class="intel-readiness-footer-card">
                <span class="intel-canvas-label">📋 Next Steps</span>
                <p>${nextSteps.length ? escapeHtml(nextSteps.join(' | ')) : '<span class="intel-muted">No next steps captured</span>'}</p>
            </div>
        </div>
    `;
}

function renderPainPoints(painPoints) {
    const container = document.getElementById('intel-pain-points');
    if (!painPoints || !painPoints.length) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>🔥 Pain Points</h3></div>
            <p class="intel-muted">No pain points identified yet.</p>
        `;
        return;
    }

    const sorted = [...painPoints].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[(a.severity || 'low').toLowerCase()] || 2) - (order[(b.severity || 'low').toLowerCase()] || 2);
    });

    const painHtml = sorted.map((pp, idx) => {
        const severity = (pp.severity || 'medium').toLowerCase();
        const severityColors = { high: '#DC2626', medium: '#D97706', low: '#059669' };
        const borderColor = severityColors[severity] || severityColors.medium;

        return `
            <div class="intel-pain-card" style="border-left: 3px solid ${borderColor}">
                <div class="intel-pain-header">
                    <span class="intel-pain-title">${escapeHtml(pp.title || pp.name || 'Pain Point ' + (idx + 1))}</span>
                    <span class="intel-severity-badge severity-${severity}">${severity}</span>
                </div>
                ${pp.description ? `<p class="intel-pain-desc">${escapeHtml(pp.description)}</p>` : ''}
                <div class="intel-pain-details">
                    ${pp.currentEffort ? `<div class="intel-pain-detail"><span class="intel-detail-label">Current Effort:</span> ${escapeHtml(pp.currentEffort)}</div>` : ''}
                    ${pp.affectedProcess ? `<div class="intel-pain-detail"><span class="intel-detail-label">Affected Process:</span> ${escapeHtml(pp.affectedProcess)}</div>` : ''}
                    ${pp.automationIdea ? `<div class="intel-pain-detail"><span class="intel-detail-label">Automation Idea:</span> ${escapeHtml(pp.automationIdea)}</div>` : ''}
                    ${pp.expectedImpact ? `<div class="intel-pain-detail"><span class="intel-detail-label">Expected Impact:</span> ${escapeHtml(pp.expectedImpact)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>🔥 Pain Points</h3></div>
        ${painHtml}
    `;
}

function renderTeamStructure(team) {
    const container = document.getElementById('intel-team-structure');
    if (!team || !team.length) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>👥 Team & Org Structure</h3></div>
            <p class="intel-muted">No team information captured yet.</p>
        `;
        return;
    }

    const rows = team.map(member => `
        <tr>
            <td>${escapeHtml(member.role || '')}</td>
            <td>${member.headcount != null ? escapeHtml(String(member.headcount)) : '-'}</td>
            <td>${escapeHtml(member.responsibilities || '')}</td>
            <td>${Array.isArray(member.processSteps) ? member.processSteps.map(s => escapeHtml(s)).join(', ') : escapeHtml(member.processSteps || '')}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>👥 Team & Org Structure</h3></div>
        <div class="intel-table-wrap">
            <table class="intel-table">
                <thead><tr><th>Role</th><th>Headcount</th><th>Responsibilities</th><th>Process Steps</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderToolsInventory(tools) {
    const container = document.getElementById('intel-tools-inventory');
    if (!tools || !tools.length) {
        container.innerHTML = `
            <div class="intel-card-header"><h3>🛠️ Tools & Systems</h3></div>
            <p class="intel-muted">No tools or systems captured yet.</p>
        `;
        return;
    }

    const rows = tools.map(tool => `
        <tr>
            <td>${escapeHtml(tool.name || '')}</td>
            <td>${escapeHtml(tool.type || '')}</td>
            <td>${Array.isArray(tool.usedIn) ? tool.usedIn.map(s => escapeHtml(s)).join(', ') : escapeHtml(tool.usedIn || '')}</td>
            <td>${Array.isArray(tool.usedBy) ? tool.usedBy.map(s => escapeHtml(s)).join(', ') : escapeHtml(tool.usedBy || '')}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="intel-card-header"><h3>🛠️ Tools & Systems</h3></div>
        <div class="intel-table-wrap">
            <table class="intel-table">
                <thead><tr><th>Name</th><th>Type</th><th>Used In</th><th>Used By</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderContextCoverage(coverage) {
    const container = document.getElementById('intel-context-coverage');
    if (!coverage || !Object.keys(coverage).length) {
        container.innerHTML = '';
        return;
    }

    const topics = coverage.topics || [];
    const overallPct = coverage.overall || 0;

    let topicsHtml = '';
    if (topics.length) {
        topicsHtml = topics.map(t => {
            const pct = t.percentage || 0;
            const captured = t.captured || false;
            return `
                <div class="intel-coverage-topic">
                    <div class="intel-coverage-topic-row">
                        <span>${captured ? '✅' : '⬜'} ${escapeHtml(t.name || t.topic || '')}</span>
                        <span class="intel-coverage-pct">${pct}%</span>
                    </div>
                    <div class="intel-coverage-bar-bg"><div class="intel-coverage-bar-fill" style="width:${pct}%;background:${VERTICAL_COLOR}"></div></div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="intel-card-header"><h3>📊 Context Coverage</h3></div>
        <div class="intel-coverage-overall">
            <div class="intel-coverage-overall-row">
                <span>Overall Coverage</span>
                <span class="intel-coverage-pct">${overallPct}%</span>
            </div>
            <div class="intel-coverage-bar-bg large"><div class="intel-coverage-bar-fill" style="width:${overallPct}%;background:${VERTICAL_COLOR}"></div></div>
        </div>
        ${topicsHtml}
    `;
}

let currentIntelFeedbackType = '';

window.showIntelFeedbackForm = function(stepNumber, type) {
    currentIntelFeedbackType = type;
    const form = document.getElementById(`intel-fb-form-${stepNumber}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const input = document.getElementById(`intel-fb-input-${stepNumber}`);
    if (input) input.focus();
};

window.submitIntelStepFeedback = async function(stepNumber, type) {
    try {
        await fetch(`/api/intelligence/${VERTICAL_ID}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: 'processMap', field_path: `step.${stepNumber}`, feedback_type: type })
        });
        const banner = document.getElementById('intel-feedback-banner');
        banner.style.display = 'block';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    } catch (e) {
        console.error('Feedback error:', e);
    }
};

window.submitIntelStepFeedbackWithText = async function(stepNumber) {
    const input = document.getElementById(`intel-fb-input-${stepNumber}`);
    const content = input ? input.value.trim() : '';
    if (!content) return;

    try {
        await fetch(`/api/intelligence/${VERTICAL_ID}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: 'processMap', field_path: `step.${stepNumber}`, feedback_type: currentIntelFeedbackType, corrected_value: content })
        });
        if (input) input.value = '';
        document.getElementById(`intel-fb-form-${stepNumber}`).style.display = 'none';
        const banner = document.getElementById('intel-feedback-banner');
        banner.style.display = 'block';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    } catch (e) {
        console.error('Feedback error:', e);
    }
};

window.submitIntelFeedback = async function(section, fieldPath, type, originalValue) {
    try {
        await fetch(`/api/intelligence/${VERTICAL_ID}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, field_path: fieldPath, feedback_type: type, original_value: originalValue })
        });
        const banner = document.getElementById('intel-feedback-banner');
        banner.style.display = 'block';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    } catch (e) {
        console.error('Feedback error:', e);
    }
};

window.editBusinessField = async function(field, currentValue) {
    const valEl = document.getElementById(`profile-val-${field}`);
    if (!valEl) return;

    if (valEl.querySelector('textarea')) return;

    const oldContent = valEl.innerHTML;
    valEl.innerHTML = `
        <textarea class="intel-inline-edit" id="edit-field-${field}" rows="2">${currentValue ? escapeHtml(String(currentValue)) : ''}</textarea>
        <div class="intel-inline-edit-actions">
            <button class="primary-btn" style="background:${VERTICAL_COLOR};padding:4px 12px;font-size:12px" onclick="saveBusinessField('${field}')">Save</button>
            <button class="secondary-btn" style="padding:4px 12px;font-size:12px" onclick="cancelEditField('${field}', \`${oldContent.replace(/`/g, '\\`')}\`)">Cancel</button>
        </div>
    `;
    document.getElementById(`edit-field-${field}`).focus();
};

window.saveBusinessField = async function(field) {
    const textarea = document.getElementById(`edit-field-${field}`);
    if (!textarea) return;
    const newValue = textarea.value.trim();

    try {
        await fetch(`/api/intelligence/${VERTICAL_ID}/business-profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field: field, value: newValue })
        });
        const valEl = document.getElementById(`profile-val-${field}`);
        valEl.innerHTML = newValue ? escapeHtml(newValue) : '<span class="intel-muted">Not yet captured</span>';
    } catch (e) {
        console.error('Save error:', e);
        alert('Failed to save. Please try again.');
    }
};

window.cancelEditField = function(field, oldContent) {
    const valEl = document.getElementById(`profile-val-${field}`);
    if (valEl) valEl.innerHTML = oldContent;
};

window.toggleGapAnswer = function(idx) {
    const form = document.getElementById(`gap-answer-${idx}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        document.getElementById(`gap-textarea-${idx}`).focus();
    }
};

window.answerKnowledgeGap = async function(idx, question) {
    const textarea = document.getElementById(`gap-textarea-${idx}`);
    if (!textarea) return;
    const answer = textarea.value.trim();
    if (!answer) return;

    try {
        await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verticalId: VERTICAL_ID, content: `[Knowledge Gap Answer] Q: ${question}\nA: ${answer}`, category: 'other' })
        });
        textarea.value = '';
        document.getElementById(`gap-answer-${idx}`).style.display = 'none';
        const item = document.getElementById(`gap-item-${idx}`);
        if (item) item.classList.add('answered');
        const check = item.querySelector('.intel-gap-check');
        if (check) check.textContent = '☑';
    } catch (e) {
        console.error('Answer error:', e);
    }
};

window.discussInChat = function(question) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
    document.querySelector('[data-tab="chat"]').classList.add('active');
    document.getElementById('tab-chat').classList.remove('hidden');
    const chatInput = document.getElementById('chat-input');
    chatInput.value = `Regarding: "${question}" — `;
    chatInput.focus();
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
