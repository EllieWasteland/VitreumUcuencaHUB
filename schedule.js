// ===================================================================================
//  SCHEDULE.JS
//  Módulo para toda la lógica relacionada con el horario, el asistente de creación
//  y el widget de "Próxima Clase".
// ===================================================================================

// --- ESTADO DEL MÓDULO DE HORARIO ---
let scheduleData = {};
let currentAssistantDay = 'lunes';
let nextClassInterval;

/**
 * Autocompleta el horario del usuario basado en una plantilla predefinida para su carrera.
 */
function autoCompleteSchedule() {
    // El ciclo ya no es necesario para acceder a los datos, ya que careerData es específico del ciclo
    const { group, modality } = currentUserData;
    // La ruta a los horarios ahora es un nivel más corta
    const templateSchedule = careerData?.[group]?.[modality]?.schedules;

    if (templateSchedule) {
        console.log(`Horario encontrado para autocompletar.`);
        const scheduleWithIds = {};
        Object.keys(templateSchedule).forEach(day => {
            scheduleWithIds[day] = templateSchedule[day].map(subject => ({ ...subject, id: Date.now() + Math.random() }));
        });
        
        scheduleData = scheduleWithIds;
        saveSchedule();
        renderSchedule();
        updateNextClassWidget();
    } else {
        console.warn(`No se encontró un horario para la combinación seleccionada. Se abrirá el asistente manual.`);
        openScheduleAssistant();
    }
}

/**
 * Obtiene la clave única para guardar/cargar el horario del usuario en localStorage.
 * @returns {string|null} La clave del horario o null si no hay usuario.
 */
function getScheduleKey() {
    const user = firebase.auth().currentUser;
    return user ? `vitreumHubSchedule_${user.uid}` : null;
}

/**
 * Carga el horario del usuario desde localStorage.
 * @returns {object} El objeto del horario.
 */
function loadSchedule() {
    const key = getScheduleKey();
    if (!key) return {};
    try {
        return JSON.parse(localStorage.getItem(key) || '{}') || { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
    } catch(e) {
        console.error("Error parsing schedule data:", e);
        return { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
    }
}

/**
 * Guarda el horario actual en localStorage.
 */
function saveSchedule() {
    const key = getScheduleKey();
    if (key) localStorage.setItem(key, JSON.stringify(scheduleData));
}

/**
 * Abre el modal del asistente para editar el horario.
 */
function openScheduleAssistant() {
    scheduleData = loadSchedule();
    currentAssistantDay = 'lunes';
    renderAssistantForDay(currentAssistantDay);
    const scheduleAssistantScreen = document.getElementById('schedule-assistant-screen');
    if(scheduleAssistantScreen) scheduleAssistantScreen.classList.add('show');
}

/**
 * Cierra el modal del asistente de horario.
 */
function closeScheduleAssistant() {
    const scheduleAssistantScreen = document.getElementById('schedule-assistant-screen');
    if(scheduleAssistantScreen) scheduleAssistantScreen.classList.remove('show');
}

/**
 * Renderiza la lista de materias para un día específico en el asistente.
 * @param {string} day - El día a renderizar ('lunes', 'martes', etc.).
 */
function renderAssistantForDay(day) {
    currentAssistantDay = day;
    const dayTitle = document.getElementById('assistant-day-title');
    const listContainer = document.getElementById('current-day-subjects-list');
    
    document.querySelectorAll('.day-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.day === day));

    if(dayTitle) dayTitle.textContent = day.charAt(0).toUpperCase() + day.slice(1);
    if(listContainer) listContainer.innerHTML = '';

    const subjectsForDay = scheduleData[day] || [];
    if (subjectsForDay.length === 0) {
        if(listContainer) listContainer.innerHTML = `<p class="empty-list-msg">No hay materias para este día.</p>`;
        return;
    }

    subjectsForDay.sort((a, b) => a.start.localeCompare(b.start)).forEach(subject => {
        const item = document.createElement('div');
        item.className = 'subject-item-assistant';
        item.innerHTML = `
            <div class="subject-details">
                <p>${subject.name}</p>
                <span>${subject.teacher ? subject.teacher + ' | ' : ''}${subject.start} - ${subject.end}</span>
            </div>
            <button class="delete-subject-btn" data-id="${subject.id}"><i data-lucide="trash-2"></i></button>
        `;
        listContainer?.appendChild(item);
    });
    lucide.createIcons();
}

/**
 * Configura los eventos y la lógica del asistente de horario (formulario, pestañas, botones).
 */
function setupScheduleAssistant() {
    const form = document.getElementById('add-subject-form');
    const listContainer = document.getElementById('current-day-subjects-list');

    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => renderAssistantForDay(tab.dataset.day || 'lunes'));
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('subject-name');
        const teacherInput = document.getElementById('subject-teacher');
        const startInput = document.getElementById('subject-start-time');
        const endInput = document.getElementById('subject-end-time');

        if (startInput.value >= endInput.value) { alert("La hora de inicio debe ser anterior a la hora de fin."); return; }

        const newSubject = { id: Date.now(), name: nameInput.value, teacher: teacherInput.value, start: startInput.value, end: endInput.value };

        if(!scheduleData[currentAssistantDay]) scheduleData[currentAssistantDay] = [];
        scheduleData[currentAssistantDay].push(newSubject);
        renderAssistantForDay(currentAssistantDay);
        form.reset();
    });

    listContainer?.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-subject-btn');
        if (deleteButton) {
            const subjectId = Number(deleteButton.dataset.id);
            scheduleData[currentAssistantDay] = scheduleData[currentAssistantDay].filter(s => s.id !== subjectId);
            renderAssistantForDay(currentAssistantDay);
        }
    });

    document.getElementById('save-schedule-btn')?.addEventListener('click', () => {
        saveSchedule();
        renderSchedule();
        updateNextClassWidget();
        closeScheduleAssistant();
    });
    document.getElementById('close-assistant-btn')?.addEventListener('click', closeScheduleAssistant);
}

/**
 * Renderiza el horario completo en la página de Horario.
 */
function renderSchedule() {
    const container = document.getElementById('schedule-render-area'); 
    if(!container) return;

    const data = loadSchedule();
    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const hasSubjects = days.some(day => data[day] && data[day].length > 0);

    if (!hasSubjects) {
        container.innerHTML = `
            <div class="schedule-empty-state">
                <i data-lucide="calendar-off" style="width: 60px; height: 60px;"></i>
                <h3>No has creado tu horario</h3>
                <p>Usa el asistente para añadir tus materias y visualizar tu semana.</p>
                <button id="create-schedule-from-empty-btn" class="onboarding-btn primary" style="max-width: 250px;">Crear Horario Ahora</button>
            </div>
        `;
        document.getElementById('create-schedule-from-empty-btn')?.addEventListener('click', openScheduleAssistant);
        lucide.createIcons();
        return;
    }

    let html = '<div class="schedule-view-container">';
    days.forEach(day => {
        html += `<div class="schedule-day-column"><h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>`;
        const subjects = data[day] ? [...data[day]].sort((a, b) => a.start.localeCompare(b.start)) : [];
        if (subjects.length > 0) {
            subjects.forEach(subject => {
                html += `
                    <div class="subject-card">
                        <h4>${subject.name}</h4>
                        ${subject.teacher ? `<p><i data-lucide="user"></i> ${subject.teacher}</p>` : ''}
                        <p><i data-lucide="clock"></i> ${subject.start} - ${subject.end}</p>
                    </div>
                `;
            });
        } else {
            html += `<p class="no-subjects-msg" style="text-align:center; opacity: 0.5;">Día libre</p>`;
        }
        html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
    lucide.createIcons();
}

/**
 * Determina el estado actual de las clases (en curso, próxima, semana terminada).
 * @returns {object} - Objeto con el estado y la información de la clase.
 */
function getCurrentClassState() {
    const schedule = loadSchedule();
    const now = new Date();
    const dayMapping = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

    const hasSubjects = Object.values(schedule).some(day => Array.isArray(day) && day.length > 0);
    if (!hasSubjects) return { status: 'NO_SCHEDULE' };

    const upcomingClasses = [];
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + i);
        const dayName = dayMapping[checkDate.getDay()];
        
        if (schedule[dayName] && schedule[dayName].length > 0) {
            for (const subject of schedule[dayName]) {
                const [startH, startM] = subject.start.split(':').map(Number);
                const [endH, endM] = subject.end.split(':').map(Number);
                const startDate = new Date(checkDate); startDate.setHours(startH, startM, 0, 0);
                const endDate = new Date(checkDate); endDate.setHours(endH, endM, 0, 0);
                upcomingClasses.push({ ...subject, startDate, endDate, day: dayName.charAt(0).toUpperCase() + dayName.slice(1) });
            }
        }
    }
    
    upcomingClasses.sort((a, b) => a.startDate - b.startDate);

    for (const classInstance of upcomingClasses) {
        if (now >= classInstance.startDate && now < classInstance.endDate) return { status: 'IN_PROGRESS', classInfo: classInstance };
        if (now < classInstance.startDate) return { status: 'UPCOMING', classInfo: classInstance };
    }

    return { status: 'WEEK_DONE' };
}

/**
 * Formatea una diferencia de tiempo en milisegundos a un string legible.
 * @param {number} ms - Milisegundos.
 * @returns {string} - Tiempo formateado (ej. "01:23:45").
 */
function formatTimeDiff(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Actualiza el contenido del widget "Próxima Clase" y gestiona el temporizador.
 */
function updateNextClassWidget() {
    if (nextClassInterval) clearInterval(nextClassInterval);
    const widget = document.getElementById('next-class-widget');
    if (!widget) return;

    const render = () => {
        const state = getCurrentClassState();
        const now = new Date();
        let contentHTML = '';

        switch (state.status) {
            case 'IN_PROGRESS':
            case 'UPCOMING': {
                const classInfo = state.classInfo;
                const diff = state.status === 'IN_PROGRESS' ? classInfo.endDate.getTime() - now.getTime() : classInfo.startDate.getTime() - now.getTime();
                if (diff <= 0) { setTimeout(updateNextClassWidget, 1000); return; }

                const badgeClass = state.status === 'IN_PROGRESS' ? 'in-progress' : 'upcoming';
                const badgeText = state.status === 'IN_PROGRESS' ? 'En Curso' : 'Próximamente';
                const countdownLabel = state.status === 'IN_PROGRESS' ? 'Termina en:' : `Empieza en (${classInfo.start}):`;

                contentHTML = `
                    <div class="next-class-content">
                        <span class="status-badge ${badgeClass}">${badgeText}</span>
                        <div class="class-details">
                            <h4>${classInfo.name}</h4>
                            ${classInfo.teacher ? `<p class="teacher-info"><i data-lucide="user"></i> ${classInfo.teacher}</p>` : ''}
                        </div>
                        <div class="countdown-container">
                            <p class="countdown-label">${countdownLabel}</p>
                            <div class="countdown-timer">${formatTimeDiff(diff)}</div>
                        </div>
                    </div>
                `;
                break;
            }
            case 'WEEK_DONE':
                contentHTML = `
                    <div class="no-class-info">
                        <i data-lucide="party-popper"></i>
                        <h4>¡Semana terminada!</h4>
                        <p>Disfruta tu merecido descanso.</p>
                    </div>
                `;
                 if (nextClassInterval) clearInterval(nextClassInterval);
                break;
            case 'NO_SCHEDULE':
            default:
                contentHTML = `
                    <div class="no-class-info">
                        <i data-lucide="calendar-plus"></i>
                        <h4>No hay horario</h4>
                        <p>Añade tus clases para ver aquí tu próxima materia.</p>
                    </div>
                `;
                 if (nextClassInterval) clearInterval(nextClassInterval);
                break;
        }

        widget.innerHTML = `
            <div style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1;">
                <div class="card-header">
                    <div class="app-icon" style="background-color: rgba(255, 201, 102, 0.15); color: var(--accent-color);"><i data-lucide="clock"></i></div>
                    <h4>Próxima Clase</h4>
                </div>
                ${contentHTML}
                <div class="card-actions">
                    <a href="#" class="card-button" onclick="document.querySelector('.nav-link[data-target=\\'schedule-content\\']').click(); return false;">Ver Horario Completo</a>
                </div>
            </div>
        `;
        lucide.createIcons();
    };

    render();
    const initialState = getCurrentClassState();
    if (initialState.status === 'IN_PROGRESS' || initialState.status === 'UPCOMING') {
        nextClassInterval = setInterval(render, 1000);
    }
}
