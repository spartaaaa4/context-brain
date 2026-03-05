const VERTICAL_ID = window.VERTICAL_ID;
const VERTICAL_COLOR = window.VERTICAL_COLOR;
let currentMapId = null;
let pendingFile = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initChat();
    initVoice();
    initDocuments();
    initNotes();
    loadChatHistory();
    loadDocuments();
    loadNotes();
    loadProcessMap();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
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

async function loadProcessMap() {
    try {
        const res = await fetch(`/api/process-map/${VERTICAL_ID}`);
        const data = await res.json();

        if (!data) return;

        currentMapId = data.id;
        renderProcessMap(data);
    } catch (e) {
        console.error('Failed to load process map:', e);
    }
}

document.getElementById('generate-map-btn').addEventListener('click', async () => {
    const btn = document.getElementById('generate-map-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    document.getElementById('process-loading').style.display = 'block';
    document.getElementById('process-content').style.display = 'none';

    try {
        const res = await fetch('/api/process-map/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verticalId: VERTICAL_ID })
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Failed to generate process map');
            return;
        }

        const data = await res.json();
        currentMapId = data.id;
        renderProcessMap(data);
    } catch (e) {
        alert('Failed to generate process map. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh Process Map';
        document.getElementById('process-loading').style.display = 'none';
    }
});

function renderProcessMap(data) {
    const content = document.getElementById('process-content');
    content.style.display = 'block';

    const mapData = data.map_data;
    if (!mapData || typeof mapData !== 'object') return;

    const bo = mapData.businessOverview;
    if (bo) {
        document.getElementById('business-overview').innerHTML = `
            <h2>Business Overview</h2>
            ${bo.summary ? `<div class="overview-section"><h3>About</h3><p>${escapeHtml(bo.summary)}</p></div>` : ''}
            ${bo.businessModel ? `<div class="overview-section"><h3>Business Model</h3><p>${escapeHtml(bo.businessModel)}</p></div>` : ''}
            ${bo.scale ? `<div class="overview-section"><h3>Scale & Metrics</h3>
                <p>${bo.scale.workers ? `Workers: ${escapeHtml(bo.scale.workers)}` : ''} ${bo.scale.clients ? `| Clients: ${escapeHtml(bo.scale.clients)}` : ''} ${bo.scale.volume ? `| Volume: ${escapeHtml(bo.scale.volume)}` : ''}</p>
            </div>` : ''}
            ${bo.teamStructure ? `<div class="overview-section"><h3>Team Structure</h3><p>${escapeHtml(bo.teamStructure)}</p></div>` : ''}
            ${bo.toolsAndSystems && bo.toolsAndSystems.length ? `<div class="overview-section"><h3>Tools & Systems</h3><p>${bo.toolsAndSystems.map(t => escapeHtml(t)).join(', ')}</p></div>` : ''}
        `;
    }

    const pm = mapData.processMap;
    if (pm && pm.steps) {
        const stepsHtml = pm.steps.map((step, idx) => {
            const painClass = `pain-${step.painLevel || 'low'}`;
            const autoClass = `automation-${step.automationPotential || 'low'}`;

            const existingFeedback = (data.feedback || []).filter(f => f.step_number === step.stepNumber);
            const feedbackHtml = existingFeedback.map(f => `
                <div class="existing-feedback">
                    <span class="fb-type ${f.feedback_type}">${f.feedback_type.replace('_', ' ')}</span>
                    ${f.content ? escapeHtml(f.content) : ''}
                    <span style="color:var(--text-muted);font-size:11px;margin-left:8px;">${f.user_name}</span>
                </div>
            `).join('');

            return `
                ${idx > 0 ? '<div class="connector"><div class="connector-line"></div></div>' : ''}
                <div class="process-step ${painClass}">
                    <div class="step-header">
                        <div class="step-number">${step.stepNumber}</div>
                        <div class="step-name">${escapeHtml(step.name || '')}</div>
                    </div>
                    <div class="step-description">${escapeHtml(step.description || '')}</div>
                    ${step.confidence === 'low' ? '<div class="low-confidence">&#9888; Low confidence — inferred from available data</div>' : ''}
                    <div class="step-meta">
                        ${step.owner ? `<span class="step-tag">Owner: ${escapeHtml(step.owner)}</span>` : ''}
                        ${step.toolsUsed && step.toolsUsed.length ? `<span class="step-tag">Tools: ${step.toolsUsed.map(t => escapeHtml(t)).join(', ')}</span>` : ''}
                        ${step.estimatedTime ? `<span class="step-tag">Time: ${escapeHtml(step.estimatedTime)}</span>` : ''}
                        <span class="step-tag ${autoClass}">Automation: ${step.automationPotential || 'unknown'}</span>
                    </div>
                    ${step.automationIdea ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">💡 ${escapeHtml(step.automationIdea)}</p>` : ''}
                    <div class="step-feedback-buttons">
                        <button class="fb-btn correct" onclick="submitStepFeedback(${step.stepNumber}, 'correct')">&#10003; Correct</button>
                        <button class="fb-btn partial" onclick="showFeedbackForm(${step.stepNumber}, 'partially_correct')">&#9888; Partially Correct</button>
                        <button class="fb-btn wrong" onclick="showFeedbackForm(${step.stepNumber}, 'wrong')">&#10007; Wrong</button>
                        <button class="fb-btn" onclick="showFeedbackForm(${step.stepNumber}, 'comment')">Comment</button>
                    </div>
                    <div id="fb-form-${step.stepNumber}" style="display:none">
                        <div class="feedback-form">
                            <input type="text" id="fb-input-${step.stepNumber}" placeholder="Your feedback...">
                            <button onclick="submitStepFeedbackWithText(${step.stepNumber})">Submit</button>
                        </div>
                    </div>
                    ${feedbackHtml}
                </div>
            `;
        }).join('');

        document.getElementById('process-map-display').innerHTML = `
            <h2 style="margin:24px 0 16px">${escapeHtml(pm.processName || 'Process Map')}</h2>
            ${stepsHtml}
            <div class="missing-step-area">
                <button class="missing-step-btn" onclick="showMissingStepForm()">+ Add Missing Step</button>
                <div id="missing-step-form" style="display:none;margin-top:12px">
                    <div class="feedback-form">
                        <input type="text" id="missing-step-input" placeholder="Describe the missing step...">
                        <button onclick="submitMissingStep()">Submit</button>
                    </div>
                </div>
            </div>
            <div class="general-feedback-area">
                <h3>General Feedback</h3>
                <div class="general-feedback-row">
                    <textarea id="general-feedback-text" placeholder="Any overall comments about this process map..."></textarea>
                    <button class="primary-btn" style="background:${VERTICAL_COLOR}" onclick="submitGeneralFeedback()">Submit</button>
                </div>
            </div>
        `;
    }

    const gaps = mapData.knowledgeGaps;
    if (gaps && gaps.length) {
        document.getElementById('knowledge-gaps').innerHTML = `
            <div class="knowledge-gaps-card">
                <h2>Knowledge Gaps</h2>
                ${gaps.map(g => `
                    <div class="gap-item">
                        <span class="gap-checkbox">&#9744;</span>
                        <span>${escapeHtml(g)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    const targets = mapData.topAutomationTargets;
    if (targets && targets.length) {
        document.getElementById('automation-targets').innerHTML = `
            <div class="automation-card">
                <h2>Top Automation Targets</h2>
                ${targets.map(t => `
                    <div class="automation-target">
                        <h4>${escapeHtml(t.target || '')} <span class="priority-badge ${t.priority || 'medium'}">${t.priority || 'medium'}</span></h4>
                        ${t.currentCost ? `<p><strong>Current Cost:</strong> ${escapeHtml(t.currentCost)}</p>` : ''}
                        ${t.automationApproach ? `<p><strong>Approach:</strong> ${escapeHtml(t.automationApproach)}</p>` : ''}
                        ${t.expectedImpact ? `<p><strong>Expected Impact:</strong> ${escapeHtml(t.expectedImpact)}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
}

let currentFeedbackType = '';

window.showFeedbackForm = function(stepNumber, type) {
    currentFeedbackType = type;
    const form = document.getElementById(`fb-form-${stepNumber}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    const input = document.getElementById(`fb-input-${stepNumber}`);
    if (input) input.focus();
};

window.submitStepFeedback = async function(stepNumber, type) {
    if (!currentMapId) return;
    try {
        await fetch(`/api/process-map/${currentMapId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepNumber, feedbackType: type, content: '' })
        });
        document.getElementById('feedback-banner').style.display = 'block';
        setTimeout(() => { document.getElementById('feedback-banner').style.display = 'none'; }, 5000);
    } catch (e) {}
};

window.submitStepFeedbackWithText = async function(stepNumber) {
    if (!currentMapId) return;
    const input = document.getElementById(`fb-input-${stepNumber}`);
    const content = input ? input.value.trim() : '';
    if (!content) return;

    try {
        await fetch(`/api/process-map/${currentMapId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepNumber, feedbackType: currentFeedbackType, content })
        });
        if (input) input.value = '';
        document.getElementById(`fb-form-${stepNumber}`).style.display = 'none';
        document.getElementById('feedback-banner').style.display = 'block';
        setTimeout(() => { document.getElementById('feedback-banner').style.display = 'none'; }, 5000);
    } catch (e) {}
};

window.showMissingStepForm = function() {
    const form = document.getElementById('missing-step-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.submitMissingStep = async function() {
    if (!currentMapId) return;
    const input = document.getElementById('missing-step-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        await fetch(`/api/process-map/${currentMapId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepNumber: null, feedbackType: 'missing_step', content })
        });
        input.value = '';
        document.getElementById('missing-step-form').style.display = 'none';
        document.getElementById('feedback-banner').style.display = 'block';
        setTimeout(() => { document.getElementById('feedback-banner').style.display = 'none'; }, 5000);
    } catch (e) {}
};

window.submitGeneralFeedback = async function() {
    if (!currentMapId) return;
    const textarea = document.getElementById('general-feedback-text');
    const content = textarea.value.trim();
    if (!content) return;

    try {
        await fetch(`/api/process-map/${currentMapId}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepNumber: null, feedbackType: 'comment', content })
        });
        textarea.value = '';
        document.getElementById('feedback-banner').style.display = 'block';
        setTimeout(() => { document.getElementById('feedback-banner').style.display = 'none'; }, 5000);
    } catch (e) {}
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
