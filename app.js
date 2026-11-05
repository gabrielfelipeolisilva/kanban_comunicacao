/* =====================================================
   MEU KANBAN — Lógica da aplicação
   JavaScript puro (ES6+), sem dependências
   ===================================================== */

// ===== ESTADO GLOBAL =====
let tasks = [];
let draggedTask = null;
let currentEditId = null;
let calendarDate = new Date();
let currentFilter = 'all';

// Colunas do quadro (ordem de exibição)
const columns = ['todo', 'progress', 'approval', 'done'];

// Nomes das colunas em pt-BR
const COLUMN_NAMES = {
    todo: 'A Fazer',
    progress: 'Em Progresso',
    approval: 'Esperando Aprovação',
    done: 'Concluído'
};

// Membros da equipe
const TEAM_MEMBERS = {
    'colaborador-1': { name: 'Colaborador 1', initials: 'C1', color: '#1565c0', bg: '#e3f2fd' },
    'colaborador-2': { name: 'Colaborador 2', initials: 'C2', color: '#7b1fa2', bg: '#f3e5f5' },
    'colaborador-3': { name: 'Colaborador 3', initials: 'C3', color: '#2e7d32', bg: '#e8f5e9' },
    'colaborador-externo': { name: 'Colaborador Externo', initials: 'CE', color: '#e65100', bg: '#fff3e0' }
};

// Ordem de prioridade (para ordenação)
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Chave do localStorage
const STORAGE_KEY = 'kanban-tasks';

// Limite de caracteres da descrição antes do "Ver mais"
const DESC_LIMIT = 100;

// Nomes dos meses e dias da semana
const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ===== ÍCONES SVG (estilo Feather) =====
const svgOpen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const SVG_ICONS = {
    clock: svgOpen + '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    calendar: svgOpen + '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    alert: svgOpen + '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    zap: svgOpen + '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    check: svgOpen + '<polyline points="20 6 9 17 4 12"></polyline></svg>',
    link: svgOpen + '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    edit: svgOpen + '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
    trash: svgOpen + '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    x: svgOpen + '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    approval: svgOpen + '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    clipboard: svgOpen + '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
    externalLink: svgOpen + '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
    renderFilterBar();
    renderAllTasks();
    renderCalendar();
});

// ===== PERSISTÊNCIA =====

// Normaliza uma tarefa (migração de formatos antigos)
function migrateTask(task) {
    const t = Object.assign({}, task);

    // Tempo previsto padrão
    if (!t.estimatedTime || typeof t.estimatedTime !== 'object') {
        t.estimatedTime = { hours: 0, minutes: 0 };
    } else {
        t.estimatedTime = {
            hours: parseInt(t.estimatedTime.hours, 10) || 0,
            minutes: parseInt(t.estimatedTime.minutes, 10) || 0
        };
    }

    // Converte "assignee" (string) antigo em "assignees" (array)
    if (!Array.isArray(t.assignees)) {
        t.assignees = (typeof t.assignee === 'string' && t.assignee) ? [t.assignee] : [];
    }
    delete t.assignee;
    t.assignees = t.assignees.filter((key, i, arr) => TEAM_MEMBERS[key] && arr.indexOf(key) === i);

    // Demais campos com valores padrão
    t.id = parseInt(t.id, 10) || Date.now();
    t.title = typeof t.title === 'string' ? t.title : '';
    if (!columns.includes(t.column)) t.column = 'todo';
    if (!PRIORITY_ORDER.hasOwnProperty(t.priority)) t.priority = 'medium';
    t.deadline = typeof t.deadline === 'string' ? t.deadline : '';
    t.jiraLink = typeof t.jiraLink === 'string' ? t.jiraLink : '';
    t.description = typeof t.description === 'string' ? t.description : '';
    t.createdAt = t.createdAt || new Date().toISOString();

    return t;
}

// Carrega as tarefas do localStorage
function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        tasks = Array.isArray(parsed) ? parsed.map(migrateTask) : [];
    } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
        tasks = [];
    }
    saveTasks();
}

// Salva as tarefas no localStorage
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
        console.error('Erro ao salvar tarefas:', err);
    }
}

// ===== EVENTOS =====
function setupEventListeners() {
    // Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.tab === 'calendar' ? 'calendarView' : 'kanbanView';
            document.getElementById(view).classList.add('active');
            if (btn.dataset.tab === 'calendar') renderCalendar();
        });
    });

    // Formulários de criação rápida (Enter ou botão "+")
    document.querySelectorAll('.column').forEach(columnEl => {
        const form = columnEl.querySelector('.add-task-form');
        const input = columnEl.querySelector('.add-task-input');
        form.addEventListener('submit', e => {
            e.preventDefault();
            addTask(columnEl.dataset.column, input);
        });

        // Drag & drop nas colunas
        columnEl.addEventListener('dragover', handleDragOver);
        columnEl.addEventListener('dragleave', handleDragLeave);
        columnEl.addEventListener('drop', handleDrop);
    });

    // Delegação de eventos nos cards
    document.querySelector('.board').addEventListener('click', e => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        const id = parseInt(card.dataset.id, 10);
        const actionEl = e.target.closest('[data-action]');

        if (actionEl) {
            e.stopPropagation();
            const action = actionEl.dataset.action;
            if (action === 'jira') openJiraLink(id);
            else if (action === 'edit') openEditModal(id);
            else if (action === 'delete') deleteTask(id);
            else if (action === 'toggle-desc') toggleDesc(id);
            return;
        }

        // Clique no corpo do card abre a edição
        openEditModal(id);
    });

    // Modal de edição
    const editModal = document.getElementById('editModal');
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveTask);
    editModal.addEventListener('click', e => {
        if (e.target === editModal) closeModal();
    });
    document.getElementById('editTitle').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTask();
        }
    });

    // Abrir Jira a partir do modal
    document.getElementById('openJiraFromModal').addEventListener('click', () => {
        const url = document.getElementById('editJiraLink').value.trim();
        if (!url) {
            alert('Informe um link do Jira primeiro.');
            return;
        }
        if (!isValidUrl(url)) {
            alert('O link do Jira informado não é uma URL válida.');
            return;
        }
        window.open(url, '_blank', 'noopener');
    });

    // Seleção de responsáveis no modal
    document.getElementById('assigneeOptions').addEventListener('click', e => {
        const option = e.target.closest('.assignee-option');
        if (!option) return;
        const key = option.dataset.assignee;
        const container = document.getElementById('assigneeOptions');
        const unassigned = container.querySelector('.assignee-option[data-assignee=""]');

        if (key === '') {
            // "Não atribuído" limpa as outras opções
            container.querySelectorAll('.assignee-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        } else {
            option.classList.toggle('selected');
            const anySelected = container.querySelector('.assignee-option.selected:not([data-assignee=""])');
            unassigned.classList.toggle('selected', !anySelected);
        }
    });

    // Modal do dia
    const dayModal = document.getElementById('dayModal');
    document.getElementById('closeDayModalBtn').addEventListener('click', closeDayModal);
    dayModal.addEventListener('click', e => {
        if (e.target === dayModal) closeDayModal();
    });

    // Tecla ESC fecha os modais
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (editModal.classList.contains('active')) closeModal();
            if (dayModal.classList.contains('active')) closeDayModal();
        }
    });

    // Calendário
    document.getElementById('prevMonth').addEventListener('click', () => {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
        renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
        renderCalendar();
    });
    document.getElementById('calendarGrid').addEventListener('click', e => {
        const cell = e.target.closest('.calendar-day.has-tasks');
        if (cell) openDayModal(cell.dataset.date);
    });
    document.getElementById('shareCalendarBtn').addEventListener('click', exportCalendarHTML);

    // Exportar / importar JSON
    document.getElementById('exportDataBtn').addEventListener('click', exportDataJSON);
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', importDataJSON);
}

// ===== FILTRO POR RESPONSÁVEL =====
function renderFilterBar() {
    const container = document.getElementById('filterPills');
    let html = '';

    // "Todos" e "Não atribuído"
    html += `<button type="button" class="filter-pill no-avatar ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>`;
    html += `<button type="button" class="filter-pill no-avatar ${currentFilter === 'unassigned' ? 'active' : ''}" data-filter="unassigned">Não atribuído</button>`;

    // Um botão por membro
    Object.entries(TEAM_MEMBERS).forEach(([key, member]) => {
        const isActive = currentFilter === key;
        const style = isActive
            ? `background:${member.color};color:#fff;border-color:${member.color};`
            : `background:${member.bg};color:${member.color};border-color:${member.color}8C;`;
        html += `
            <button type="button" class="filter-pill ${isActive ? 'active' : ''}" data-filter="${key}" style="${style}">
                <span class="filter-avatar" style="background:${member.color};">${member.initials}</span>
                ${escapeHtml(member.name)}
            </button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            currentFilter = pill.dataset.filter;
            renderFilterBar();
            renderAllTasks();
        });
    });
}

// Verifica se a tarefa passa no filtro atual
function matchesFilter(task) {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'unassigned') return task.assignees.length === 0;
    return task.assignees.includes(currentFilter);
}

// ===== CRIAÇÃO DE TAREFAS =====
function addTask(column, input) {
    const title = input.value.trim();
    if (!title) return;

    const task = {
        id: Date.now(),
        title: title,
        column: column,
        priority: 'medium',
        deadline: '',
        estimatedTime: { hours: 0, minutes: 0 },
        jiraLink: '',
        description: '',
        assignees: [],
        createdAt: new Date().toISOString()
    };

    // Garante id único em criações muito rápidas
    while (tasks.some(t => t.id === task.id)) task.id += 1;

    tasks.push(task);
    saveTasks();
    input.value = '';
    renderAllTasks();
}

// ===== RENDERIZAÇÃO DOS CARDS =====

// Formata o tempo previsto ("2h 30min"); retorna "" se zerado
function formatEstimatedTime(estimatedTime) {
    if (!estimatedTime) return '';
    const h = parseInt(estimatedTime.hours, 10) || 0;
    const m = parseInt(estimatedTime.minutes, 10) || 0;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}min`);
    return parts.join(' ');
}

// Alterna "Ver mais" / "Ver menos" da descrição
function toggleDesc(id) {
    const card = document.querySelector(`.task-card[data-id="${parseInt(id, 10)}"]`);
    if (!card) return;
    const desc = card.querySelector('.task-desc');
    const btn = card.querySelector('.desc-toggle');
    const expanded = desc.classList.toggle('expanded');
    btn.textContent = expanded ? 'Ver menos' : 'Ver mais';
}

// Monta o HTML de um card
function renderTask(task) {
    const card = document.createElement('div');
    const isDone = task.column === 'done';
    const rotations = ['rot-left', 'rot-right', 'rot-none'];
    const rotation = rotations[Math.floor(Math.random() * rotations.length)];

    card.className = `task-card priority-${task.priority} ${rotation}${isDone ? ' completed' : ''}`;
    card.draggable = true;
    card.dataset.id = task.id;

    let html = '';

    // a) Selo URGENTE
    if (task.priority === 'high' && !isDone) {
        html += '<span class="urgent-stamp">Urgente</span>';
    }

    // b) Header: título + ações
    html += `
        <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-actions">
                <button type="button" class="task-action-btn jira-btn" data-action="jira" title="Abrir no Jira" ${task.jiraLink ? '' : 'disabled'}>${SVG_ICONS.externalLink}</button>
                <button type="button" class="task-action-btn edit-btn" data-action="edit" title="Editar">${SVG_ICONS.edit}</button>
                <button type="button" class="task-action-btn delete-btn" data-action="delete" title="Excluir">${SVG_ICONS.trash}</button>
            </div>
        </div>`;

    // c) Badges (tempo previsto e Jira)
    const timeText = formatEstimatedTime(task.estimatedTime);
    if (timeText || task.jiraLink) {
        html += '<div class="task-badges">';
        if (timeText) {
            html += `<span class="task-badge time-badge">${SVG_ICONS.clock}${escapeHtml(timeText)}</span>`;
        }
        if (task.jiraLink) {
            html += `<button type="button" class="task-badge jira-badge" data-action="jira" title="Abrir no Jira">${SVG_ICONS.link}Jira</button>`;
        }
        html += '</div>';
    }

    // d) Descrição com "Ver mais"
    if (task.description) {
        const isLong = task.description.length > DESC_LIMIT;
        if (isLong) {
            const short = task.description.slice(0, DESC_LIMIT).trimEnd() + '…';
            html += `
                <div class="task-desc-wrapper">
                    <div class="task-desc"><span class="desc-short">${escapeHtml(short)}</span><span class="desc-full">${escapeHtml(task.description)}</span></div>
                    <button type="button" class="desc-toggle" data-action="toggle-desc">Ver mais</button>
                </div>`;
        } else {
            html += `<div class="task-desc-wrapper"><div class="task-desc">${escapeHtml(task.description)}</div></div>`;
        }
    }

    // e) Data de criação
    const created = new Date(task.createdAt);
    if (!isNaN(created)) {
        const dateStr = created.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const timeStr = created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        html += `<div class="task-date">Criado em: ${dateStr} ${timeStr}</div>`;
    }

    // f) Responsáveis
    if (task.assignees.length > 0) {
        const members = task.assignees.map(key => TEAM_MEMBERS[key]).filter(Boolean);
        const avatars = members.map(m =>
            `<span class="avatar" style="background:${m.color};" title="${escapeHtml(m.name)}">${m.initials}</span>`
        ).join('');
        const names = members.map(m => escapeHtml(m.name)).join(', ');
        html += `
            <div class="task-assignees">
                <div class="avatar-stack">${avatars}</div>
                <span class="assignee-names">${names}</span>
            </div>`;
    }

    // g) Barra de prazo
    html += renderDeadlineBar(task);

    card.innerHTML = html;

    // Eventos de arraste
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
}

// Monta a barra de prazo do rodapé do card
function renderDeadlineBar(task) {
    const info = getDeadlineStatus(task);
    const plural = n => (n === 1 ? 'dia' : 'dias');

    switch (info.status) {
        case 'ok':
            return `<div class="deadline-bar ok">${SVG_ICONS.check}<span>Concluído</span></div>`;
        case 'overdue':
            return `<div class="deadline-bar overdue">${SVG_ICONS.alert}<span>${info.days} ${plural(info.days)} de atraso</span></div>`;
        case 'today':
            return `<div class="deadline-bar today">${SVG_ICONS.zap}<span>Vence hoje</span></div>`;
        case 'soon':
            return `<div class="deadline-bar soon">${SVG_ICONS.clock}<span>Vence em ${info.days} ${plural(info.days)}</span></div>`;
        case 'ontime':
            return `<div class="deadline-bar ontime"><span>No prazo</span><span class="deadline-date">${SVG_ICONS.calendar}${formatDate(task.deadline)}</span></div>`;
        default:
            return '<div class="deadline-bar none"><span>Sem prazo</span></div>';
    }
}

// Ordena: com prazo primeiro (ascendente); empate/sem prazo por criação desc
function sortTasks(list) {
    return list.slice().sort((a, b) => {
        if (a.deadline && b.deadline) {
            if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
        } else if (a.deadline && !b.deadline) {
            return -1;
        } else if (!a.deadline && b.deadline) {
            return 1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

// Renderiza todas as colunas (respeitando o filtro)
function renderAllTasks() {
    columns.forEach(column => {
        const columnEl = document.querySelector(`.column[data-column="${column}"]`);
        const listEl = columnEl.querySelector('.task-list');
        listEl.innerHTML = '';

        const columnTasks = sortTasks(tasks.filter(t => t.column === column && matchesFilter(t)));
        columnTasks.forEach(task => listEl.appendChild(renderTask(task)));
    });
    updateTaskCount();
}

// ===== EXCLUSÃO =====
function deleteTask(id) {
    id = parseInt(id, 10);
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Deseja realmente excluir a tarefa "${task.title}"?`)) return;
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderAllTasks();
    renderCalendar();
}

// ===== MODAL DE EDIÇÃO =====

// Monta a lista de opções de responsáveis no modal
function renderAssigneeOptions(selected) {
    const container = document.getElementById('assigneeOptions');
    let html = `
        <div class="assignee-option ${selected.length === 0 ? 'selected' : ''}" data-assignee="">
            <span class="avatar unassigned">–</span>
            <span class="assignee-option-name">Não atribuído</span>
            <span class="assignee-check">✓</span>
        </div>`;

    Object.entries(TEAM_MEMBERS).forEach(([key, member]) => {
        html += `
            <div class="assignee-option ${selected.includes(key) ? 'selected' : ''}" data-assignee="${key}">
                <span class="avatar" style="background:${member.color};">${member.initials}</span>
                <span class="assignee-option-name">${escapeHtml(member.name)}</span>
                <span class="assignee-check">✓</span>
            </div>`;
    });

    container.innerHTML = html;
}

function openEditModal(id) {
    id = parseInt(id, 10);
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    currentEditId = id;
    document.getElementById('editTitle').value = task.title;
    document.getElementById('editPriority').value = task.priority;
    document.getElementById('editDeadline').value = task.deadline || '';
    document.getElementById('editHours').value = task.estimatedTime.hours || 0;
    document.getElementById('editMinutes').value = task.estimatedTime.minutes || 0;
    document.getElementById('editJiraLink').value = task.jiraLink || '';
    document.getElementById('editDescription').value = task.description || '';
    renderAssigneeOptions(task.assignees);

    document.getElementById('editModal').classList.add('active');
    setTimeout(() => document.getElementById('editTitle').focus(), 50);
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditId = null;
}

function saveTask() {
    if (currentEditId === null) return;
    const task = tasks.find(t => t.id === currentEditId);
    if (!task) return;

    const title = document.getElementById('editTitle').value.trim();
    if (!title) {
        alert('O título da tarefa é obrigatório.');
        document.getElementById('editTitle').focus();
        return;
    }

    const jiraLink = document.getElementById('editJiraLink').value.trim();
    if (jiraLink && !isValidUrl(jiraLink)) {
        alert('O link do Jira informado não é uma URL válida.');
        document.getElementById('editJiraLink').focus();
        return;
    }

    // Tempo previsto com limites (0-999h / 0-59min)
    let hours = parseInt(document.getElementById('editHours').value, 10) || 0;
    let minutes = parseInt(document.getElementById('editMinutes').value, 10) || 0;
    hours = Math.min(Math.max(hours, 0), 999);
    minutes = Math.min(Math.max(minutes, 0), 59);

    // Responsáveis selecionados
    const assignees = Array.from(
        document.querySelectorAll('#assigneeOptions .assignee-option.selected')
    ).map(o => o.dataset.assignee).filter(key => key && TEAM_MEMBERS[key]);

    task.title = title;
    task.priority = document.getElementById('editPriority').value;
    task.deadline = document.getElementById('editDeadline').value;
    task.estimatedTime = { hours, minutes };
    task.jiraLink = jiraLink;
    task.description = document.getElementById('editDescription').value.trim();
    task.assignees = assignees;

    saveTasks();
    closeModal();
    renderAllTasks();
    renderCalendar();
}

// ===== JIRA =====
function isValidUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
        return false;
    }
}

function openJiraLink(id) {
    id = parseInt(id, 10);
    const task = tasks.find(t => t.id === id);
    if (!task || !task.jiraLink) return;
    if (!isValidUrl(task.jiraLink)) {
        alert('O link do Jira desta tarefa não é uma URL válida.');
        return;
    }
    window.open(task.jiraLink, '_blank', 'noopener');
}

// ===== PRAZOS =====

// Converte "YYYY-MM-DD" em Date local (meia-noite)
function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

// Data de hoje à meia-noite
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Retorna { status, days } — status: ok | overdue | today | soon | ontime | none
function getDeadlineStatus(task) {
    if (task.column === 'done') return { status: 'ok', days: 0 };
    const deadline = parseLocalDate(task.deadline);
    if (!deadline) return { status: 'none', days: 0 };

    const diff = Math.round((deadline - getToday()) / 86400000);
    if (diff < 0) return { status: 'overdue', days: Math.abs(diff) };
    if (diff === 0) return { status: 'today', days: 0 };
    if (diff <= 3) return { status: 'soon', days: diff };
    return { status: 'ontime', days: diff };
}

// Formata "YYYY-MM-DD" como "dd/mm"
function formatDate(dateStr) {
    const date = parseLocalDate(dateStr);
    if (!date) return '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ===== DRAG & DROP =====
function handleDragStart(e) {
    const card = e.currentTarget;
    draggedTask = parseInt(card.dataset.id, 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(draggedTask));
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
    draggedTask = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    const columnEl = e.currentTarget;
    // Só remove o destaque ao sair de fato da coluna
    if (!e.relatedTarget || !columnEl.contains(e.relatedTarget)) {
        columnEl.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const columnEl = e.currentTarget;
    columnEl.classList.remove('drag-over');

    const id = parseInt(e.dataTransfer.getData('text/plain'), 10) || draggedTask;
    const task = tasks.find(t => t.id === id);
    const newColumn = columnEl.dataset.column;

    if (task && task.column !== newColumn) {
        task.column = newColumn;
        saveTasks();
        renderAllTasks();
        renderCalendar();
    }
    draggedTask = null;
}

// ===== CONTADORES =====
function updateTaskCount() {
    columns.forEach(column => {
        const count = tasks.filter(t => t.column === column).length;
        const badge = document.querySelector(`.column[data-column="${column}"] .task-count`);
        if (badge) badge.textContent = count;
    });
}

// ===== SEGURANÇA =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

// ===== CALENDÁRIO =====

// Formata Date em "YYYY-MM-DD"
function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Status de uma tarefa para o calendário
function getCalendarStatus(task) {
    const info = getDeadlineStatus(task);
    return info.status === 'ok' ? 'done' : info.status;
}

// Status do dia: o mais urgente entre as não concluídas; tudo concluído = "done"
function getDayStatus(dayTasks) {
    const pending = dayTasks.filter(t => t.column !== 'done');
    if (pending.length === 0) return 'done';
    const order = ['overdue', 'today', 'soon', 'ontime'];
    const statuses = pending.map(getCalendarStatus);
    return order.find(s => statuses.includes(s)) || 'ontime';
}

// Ordena as bolinhas por urgência
function sortByUrgency(dayTasks) {
    const order = { overdue: 0, today: 1, soon: 2, ontime: 3, done: 4 };
    return dayTasks.slice().sort((a, b) => order[getCalendarStatus(a)] - order[getCalendarStatus(b)]);
}

// Agrupa as tarefas com prazo por data
function getTasksByDate() {
    const map = {};
    tasks.forEach(task => {
        if (!task.deadline) return;
        if (!map[task.deadline]) map[task.deadline] = [];
        map[task.deadline].push(task);
    });
    return map;
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const titleEl = document.getElementById('calendarTitle');
    if (!grid || !titleEl) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    titleEl.textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = toDateKey(getToday());
    const byDate = getTasksByDate();

    let html = WEEKDAY_NAMES.map(d => `<div class="calendar-weekday">${d}</div>`).join('');

    // Células vazias antes do dia 1
    for (let i = 0; i < firstWeekday; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = toDateKey(date);
        const dayTasks = byDate[key] || [];
        const weekday = date.getDay();
        const classes = ['calendar-day'];

        if (weekday === 0 || weekday === 6) classes.push('weekend');
        if (key === todayKey) classes.push('today');

        let indicators = '';
        let title = '';
        if (dayTasks.length > 0) {
            classes.push('has-tasks', `status-${getDayStatus(dayTasks)}`);
            const sorted = sortByUrgency(dayTasks);
            indicators = sorted.slice(0, 3)
                .map(t => `<span class="status-dot ${getCalendarStatus(t)}"></span>`)
                .join('');
            if (dayTasks.length > 3) {
                indicators += `<span class="day-more">+${dayTasks.length - 3}</span>`;
            }
            title = ` title="${dayTasks.length} tarefa${dayTasks.length > 1 ? 's' : ''}"`;
        }

        html += `
            <div class="${classes.join(' ')}" data-date="${key}"${title}>
                <span class="day-number">${day}</span>
                <div class="day-indicators">${indicators}</div>
            </div>`;
    }

    grid.innerHTML = html;
}

function openDayModal(dateKey) {
    const dayTasks = tasks.filter(t => t.deadline === dateKey);
    if (dayTasks.length === 0) return;

    const date = parseLocalDate(dateKey);
    document.getElementById('dayModalTitle').textContent = date.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Não concluídas primeiro; depois prioridade (alta → baixa)
    const sorted = dayTasks.slice().sort((a, b) => {
        const doneA = a.column === 'done' ? 1 : 0;
        const doneB = b.column === 'done' ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

    const priorityLabels = {
        high: '🔴 Alta',
        medium: '🟡 Média',
        low: '🟢 Baixa'
    };

    const html = sorted.map(task => {
        const isDone = task.column === 'done';
        let badges = `<span class="day-badge">${priorityLabels[task.priority]}</span>`;
        badges += `<span class="day-badge column-${task.column}">${COLUMN_NAMES[task.column]}</span>`;

        if (task.assignees.length > 0) {
            const names = task.assignees.map(k => TEAM_MEMBERS[k] ? TEAM_MEMBERS[k].name : '').filter(Boolean);
            badges += `<span class="day-badge">👤 ${escapeHtml(names.join(', '))}</span>`;
        }

        const timeText = formatEstimatedTime(task.estimatedTime);
        if (timeText) badges += `<span class="day-badge">⏱️ ${escapeHtml(timeText)}</span>`;

        if (task.jiraLink) {
            badges += `<button type="button" class="day-badge jira" data-jira-id="${task.id}">🔗 Jira</button>`;
        }

        return `
            <div class="day-task-item priority-${task.priority}${isDone ? ' completed' : ''}">
                <div class="day-task-title">${escapeHtml(task.title)}</div>
                <div class="day-task-badges">${badges}</div>
            </div>`;
    }).join('');

    const list = document.getElementById('dayTaskList');
    list.innerHTML = html;
    list.querySelectorAll('[data-jira-id]').forEach(btn => {
        btn.addEventListener('click', () => openJiraLink(parseInt(btn.dataset.jiraId, 10)));
    });

    document.getElementById('dayModal').classList.add('active');
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('active');
}

// Gera um arquivo HTML autônomo com o calendário do mês
function exportCalendarHTML() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = toDateKey(getToday());
    const byDate = getTasksByDate();
    const monthTitle = `${MONTH_NAMES[month]} ${year}`;

    // Grade do mês
    let cells = WEEKDAY_NAMES.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
    for (let i = 0; i < firstWeekday; i++) cells += '<div class="calendar-day empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = toDateKey(date);
        const dayTasks = byDate[key] || [];
        const classes = ['calendar-day'];
        if (date.getDay() === 0 || date.getDay() === 6) classes.push('weekend');
        if (key === todayKey) classes.push('today');

        let content = '';
        if (dayTasks.length > 0) {
            classes.push(`status-${getDayStatus(dayTasks)}`);
            content = sortByUrgency(dayTasks).map(t => {
                const st = getCalendarStatus(t);
                return `<div class="cal-task ${st}"><span class="status-dot ${st}"></span>${escapeHtml(t.title)}</div>`;
            }).join('');
        }

        cells += `<div class="${classes.join(' ')}"><span class="day-number">${day}</span>${content}</div>`;
    }

    // Lista detalhada das tarefas do mês
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthTasks = tasks
        .filter(t => t.deadline && t.deadline.startsWith(monthPrefix))
        .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]));

    const statusLabels = {
        overdue: 'Atrasado', today: 'Vence hoje', soon: 'Vence em breve', ontime: 'No prazo', done: 'Concluído'
    };
    const priorityLabels = { high: '🔴 Alta', medium: '🟡 Média', low: '🟢 Baixa' };

    const rows = monthTasks.map(t => {
        const st = getCalendarStatus(t);
        const names = t.assignees.map(k => TEAM_MEMBERS[k].name).join(', ') || 'Não atribuído';
        const timeText = formatEstimatedTime(t.estimatedTime);
        return `
            <tr class="${st === 'done' ? 'row-done' : ''}">
                <td>${formatDate(t.deadline)}</td>
                <td class="task-name">${escapeHtml(t.title)}</td>
                <td>${priorityLabels[t.priority]}</td>
                <td>${COLUMN_NAMES[t.column]}</td>
                <td>${escapeHtml(names)}</td>
                <td>${timeText ? '⏱️ ' + escapeHtml(timeText) : '—'}</td>
                <td><span class="status-pill ${st}">${statusLabels[st]}</span></td>
            </tr>`;
    }).join('');

    const generatedAt = new Date().toLocaleDateString('pt-BR') + ' ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const css = `
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f0f0;color:#333;padding:20px;line-height:1.5}
        .header{text-align:center;margin-bottom:24px}
        .header h1{font-size:2.5rem;font-weight:700}
        .header p{color:#777}
        .calendar-container{max-width:1100px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e8e8e8;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:24px}
        .calendar-title{font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:16px}
        .calendar-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:18px;margin-bottom:18px;font-size:.85rem;color:#555}
        .legend-item{display:inline-flex;align-items:center;gap:6px}
        .status-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#bdbdbd;flex-shrink:0}
        .status-dot.overdue{background:#c62828}.status-dot.today{background:#ef6c00}.status-dot.soon{background:#f9a825}.status-dot.ontime{background:#90a4ae}.status-dot.done{background:#43a047}
        .calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
        .calendar-weekday{text-align:center;font-weight:700;font-size:.82rem;color:#777;padding:6px 0;text-transform:uppercase;letter-spacing:.5px}
        .calendar-day{min-height:80px;padding:8px;border-radius:8px;background:#fafafa;border:1px solid #eee;display:flex;flex-direction:column;gap:4px;overflow:hidden}
        .calendar-day.empty{background:transparent;border-color:transparent}
        .calendar-day.weekend{background:#f3f3f6}
        .calendar-day.today{border:2px solid #1565c0;background:#e3f2fd}
        .calendar-day.today .day-number{color:#1565c0}
        .calendar-day.status-overdue{border-left:4px solid #c62828}.calendar-day.status-today{border-left:4px solid #ef6c00}.calendar-day.status-soon{border-left:4px solid #f9a825}.calendar-day.status-ontime{border-left:4px solid #90a4ae}.calendar-day.status-done{border-left:4px solid #43a047}
        .day-number{font-weight:700;font-size:.95rem;color:#444}
        .cal-task{display:flex;align-items:center;gap:5px;font-size:.72rem;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cal-task.done{opacity:.55;text-decoration:line-through}
        h2.section{font-size:1.15rem;margin:28px 0 12px}
        table{width:100%;border-collapse:collapse;font-size:.85rem}
        th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee}
        th{background:#fafafa;font-weight:700;color:#555}
        .task-name{font-weight:600}
        .row-done{opacity:.55}.row-done .task-name{text-decoration:line-through}
        .status-pill{display:inline-block;padding:2px 9px;border-radius:10px;font-size:.75rem;font-weight:600;background:#eee}
        .status-pill.overdue{background:#c62828;color:#fff}.status-pill.today{background:#ef6c00;color:#fff}.status-pill.soon{background:#f9a825;color:#3e2723}.status-pill.ontime{background:#eceff1;color:#455a64}.status-pill.done{background:#c8e6c9;color:#2e7d32}
        .empty-msg{text-align:center;color:#999;padding:16px}
        .footer{text-align:center;margin-top:24px;color:#888;font-size:.8rem}
        @media (max-width:768px){body{padding:10px}.header h1{font-size:2rem}.calendar-container{padding:12px;overflow-x:auto}.calendar-grid{gap:3px}.calendar-day{min-height:54px;padding:4px}.cal-task{font-size:.6rem}.calendar-weekday{font-size:.68rem}table{font-size:.75rem}th,td{padding:6px}}
    `;

    const page = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Calendário — ${monthTitle}</title>
<style>${css}</style>
</head>
<body>
<header class="header">
<h1>Meu Kanban</h1>
<p>Calendário de Prazos — ${monthTitle}</p>
</header>
<div class="calendar-container">
<div class="calendar-title">${monthTitle}</div>
<div class="calendar-legend">
<div class="legend-item"><span class="status-dot overdue"></span>Atrasado</div>
<div class="legend-item"><span class="status-dot today"></span>Vence hoje</div>
<div class="legend-item"><span class="status-dot soon"></span>Vence em breve</div>
<div class="legend-item"><span class="status-dot ontime"></span>No prazo</div>
<div class="legend-item"><span class="status-dot done"></span>Concluído</div>
</div>
<div class="calendar-grid">${cells}</div>
<h2 class="section">Tarefas do mês</h2>
${monthTasks.length > 0
        ? `<table><thead><tr><th>Prazo</th><th>Tarefa</th><th>Prioridade</th><th>Coluna</th><th>Responsáveis</th><th>Tempo</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="empty-msg">Nenhuma tarefa com prazo neste mês.</p>'}
</div>
<p class="footer">Gerado em ${generatedAt}</p>
</body>
</html>`;

    downloadFile(page, `calendario-${getFileDateStamp()}.html`, 'text/html;charset=utf-8');
}

// ===== EXPORTAR / IMPORTAR DADOS =====

// "dd-mm-aaaa" para nomes de arquivo
function getFileDateStamp() {
    return new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '-');
}

// Baixa um conteúdo como arquivo via Blob
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Feedback visual temporário em um botão de dados
function showButtonFeedback(button, text, type) {
    const label = button.querySelector('.data-btn-text');
    if (!button.dataset.originalText) button.dataset.originalText = label.textContent;
    clearTimeout(button._feedbackTimer);

    label.textContent = text;
    button.classList.remove('success', 'error');
    button.classList.add(type);

    button._feedbackTimer = setTimeout(() => {
        label.textContent = button.dataset.originalText;
        button.classList.remove('success', 'error');
    }, 2000);
}

function exportDataJSON() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        kanbanTasks: tasks
    };
    downloadFile(JSON.stringify(data, null, 2), `kanban-${getFileDateStamp()}.json`, 'application/json');
    showButtonFeedback(document.getElementById('exportDataBtn'), 'Salvo!', 'success');
}

function importDataJSON(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    const button = document.getElementById('importDataBtn');
    if (!file) return;

    const reader = new FileReader();

    reader.onload = event => {
        try {
            const data = JSON.parse(event.target.result);

            if (!data || !Array.isArray(data.kanbanTasks)) {
                alert('Arquivo inválido: estrutura "kanbanTasks" não encontrada.');
                showButtonFeedback(button, 'Erro!', 'error');
                return;
            }

            const ok = confirm(
                `Você tem ${tasks.length} tarefa(s) atualmente.\n` +
                `O arquivo contém ${data.kanbanTasks.length} tarefa(s).\n\n` +
                'Deseja substituir TODAS as tarefas atuais pelas do arquivo?'
            );
            if (!ok) return;

            tasks = data.kanbanTasks
                .filter(t => t && typeof t === 'object')
                .map(migrateTask);
            saveTasks();
            renderAllTasks();
            renderCalendar();
            showButtonFeedback(button, 'Carregado!', 'success');
        } catch (err) {
            console.error('Erro ao importar:', err);
            alert('Não foi possível ler o arquivo. Verifique se é um JSON válido.');
            showButtonFeedback(button, 'Erro!', 'error');
        } finally {
            // Permite reimportar o mesmo arquivo
            input.value = '';
        }
    };

    reader.onerror = () => {
        alert('Erro ao ler o arquivo.');
        showButtonFeedback(button, 'Erro!', 'error');
        input.value = '';
    };

    reader.readAsText(file);
}
