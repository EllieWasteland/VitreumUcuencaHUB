document.addEventListener('DOMContentLoaded', function() {

    // --- CONFIGURACIÓN DE FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyB1W2yLlVHivzBQPZJVOgpApQeYnJUFzCs",
        authDomain: "vitreumucuencahub.firebaseapp.com",
        projectId: "vitreumucuencahub",
        storageBucket: "vitreumucuencahub.firebasestorage.app",
        messagingSenderId: "628136581064",
        appId: "1:628136581064:web:9ba793a7dfc104602fd2fd"
    };

    // --- INICIALIZACIÓN DE FIREBASE ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- SELECTORES DE ELEMENTOS DEL DOM ---
    const splashScreen = document.getElementById('splash-screen');
    const video1 = document.getElementById('splash-video-1');
    const video2 = document.getElementById('splash-video-2');
    const onboardingScreen = document.getElementById('onboarding-screen');
    const loginScreen = document.getElementById('login-screen');
    const setupScreen = document.getElementById('setup-screen');
    const resumeScreen = document.getElementById('resume-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const scheduleAssistantScreen = document.getElementById('schedule-assistant-screen');
    let currentUserData = {};
    let nextClassInterval;

    // --- MÓDULO DE INICIALIZACIÓN PRINCIPAL ---
    function initializeApp() {
        lucide.createIcons();
        startClock();
        animateProgressBars();
        setupNavigation();
        setupActionButtons();
        setupBackgroundChanger();
        setupModals();
        setRealViewportHeight();
        setupDesktopMenu();
        setupScheduleAssistant();
        setupEnovaSlider();
        window.addEventListener('resize', setRealViewportHeight);
        fetchUpdates();
        loadCustomBackgroundAndTheme();
        determineInitialFlow();
    }

    // --- LÓGICA DE FLUJO INICIAL ---
    function determineInitialFlow() {
        const playVideo = async (videoElement) => {
            try {
                if (videoElement) await videoElement.play();
            } catch (err) {
                console.error("Error al reproducir video:", err);
            }
        };
        const proceedToApp = () => {
            if(splashScreen) splashScreen.style.display = 'none';
            auth.onAuthStateChanged(user => {
                const onboardingComplete = localStorage.getItem('vitreumHubOnboardingComplete');
                if (onboardingComplete !== 'true') {
                    transitionTo(onboardingScreen);
                    setupOnboarding();
                    return;
                }
                if (user) {
                    if (!user.email.endsWith('@ucuenca.edu.ec')) {
                        auth.signOut();
                        document.getElementById('login-error-modal')?.classList.add('show');
                        transitionTo(loginScreen);
                        setupLogin();
                        return;
                    }
                    const setupComplete = localStorage.getItem(`vitreumHubSetupComplete_${user.uid}`);
                    if (setupComplete === 'true') {
                        loadUserFromStorage(user);
                        setupResumeScreen(currentUserData);
                        renderSchedule();
                        updateNextClassWidget();
                        transitionTo(resumeScreen);
                    } else {
                        currentUserData = { displayName: user.displayName, photoURL: user.photoURL, email: user.email, uid: user.uid };
                        transitionTo(setupScreen);
                        setupInitialConfig();
                    }
                } else {
                    transitionTo(loginScreen);
                    setupLogin();
                }
            });
        };
        const startSplashScreenSequence = () => {
            if(video1) video1.classList.add('visible');
            playVideo(video1);
            setTimeout(() => {
                if(video1) video1.classList.remove('visible');
                if(video2) video2.classList.add('visible');
                playVideo(video2);
            }, 2000);
            setTimeout(() => {
                if(splashScreen) {
                    splashScreen.classList.add('exit');
                    splashScreen.addEventListener('transitionend', proceedToApp, { once: true });
                } else {
                    proceedToApp();
                }
            }, 3000);
        };
        Promise.all([(video1?.play(), video2?.play())]).catch(() => {}).finally(startSplashScreenSequence);
    }

    // --- LÓGICA DEL MENÚ DE ESCRITORIO ---
    function setupDesktopMenu() {
        const menuBtn = document.getElementById('menu-btn');
        const desktopNav = document.getElementById('desktop-nav-container');
        if (menuBtn && desktopNav) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                desktopNav.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!desktopNav.contains(e.target) && !menuBtn.contains(e.target)) {
                    desktopNav.classList.remove('active');
                }
            });
        }
    }

    // --- MÓDULO DE ACTUALIZACIONES ---
    async function fetchUpdates() {
        const logElement = document.getElementById('updates-log');
        if (!logElement) return;
        try {
            const response = await fetch('https://raw.githubusercontent.com/EllieWasteland/VitreumUcuencaHUB/main/README.md', { cache: 'no-cache' });
            if (!response.ok) throw new Error('Network response was not ok');
            const markdown = await response.text();
            const heading = '## Últimas Actualizaciones';
            const startIndex = markdown.indexOf(heading);
            if (startIndex === -1) return;
            const codeBlockStartIndex = markdown.indexOf('```', startIndex);
            if (codeBlockStartIndex === -1) return;
            const codeBlockEndIndex = markdown.indexOf('```', codeBlockStartIndex + 3);
            if (codeBlockEndIndex === -1) return;
            const updatesContent = markdown.substring(codeBlockStartIndex + 3, codeBlockEndIndex).trim();
            if (updatesContent) {
                const escapedContent = updatesContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                logElement.innerHTML = escapedContent
                    .replace(/\[OK\]/g, '[<span class="log-success">OK</span>]')
                    .replace(/\[INFO\]/g, '[<span class="log-info">INFO</span>]')
                    .replace(/\[WARN\]/g, '[<span class="log-warn">WARN</span>]');
            }
        } catch (error) {
            console.error('Failed to fetch updates:', error);
            logElement.textContent = '> Error de conexión.';
        }
    }

    function setRealViewportHeight() {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    }

    // --- MANEJO DE TRANSICIONES Y MODALES ---
    function transitionTo(activeScreen) {
        [onboardingScreen, loginScreen, setupScreen, appWrapper, resumeScreen].forEach(screen => {
            if (screen) {
                screen.classList.remove('active');
                screen.style.display = 'none';
            }
        });
        if (activeScreen) {
            activeScreen.style.display = 'flex';
            setTimeout(() => activeScreen.classList.add('active'), 20);
        }
    }

    function setupModals() {
        const loginErrorModal = document.getElementById('login-error-modal');
        const closeLoginErrorBtn = document.getElementById('login-error-modal-close');
        const enovaRedirectModal = document.getElementById('enova-redirect-modal');
        const enovaRedirectConfirm = document.getElementById('enova-redirect-confirm');
        const enovaRedirectCancel = document.getElementById('enova-redirect-cancel');
        const enovaLoginBtn = document.getElementById('enova-login-btn');

        if (closeLoginErrorBtn) {
            closeLoginErrorBtn.addEventListener('click', () => {
                if (loginErrorModal) loginErrorModal.classList.remove('show');
            });
        }

        if (enovaLoginBtn) {
            enovaLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (enovaRedirectModal) enovaRedirectModal.classList.add('show');
            });
        }

        if (enovaRedirectConfirm) {
            enovaRedirectConfirm.addEventListener('click', () => {
                window.open('https://enova-grado.ucuenca.edu.ec/login/index.php', '_blank');
                if (enovaRedirectModal) enovaRedirectModal.classList.remove('show');
            });
        }

        if (enovaRedirectCancel) {
            enovaRedirectCancel.addEventListener('click', () => {
                if (enovaRedirectModal) enovaRedirectModal.classList.remove('show');
            });
        }
    }

    // --- MANEJO DEL ONBOARDING ---
    function setupOnboarding() {
        const nextBtn = document.getElementById('next-btn');
        const acceptBtn = document.getElementById('accept-btn');
        const denyBtn = document.getElementById('deny-btn');
        const onboardingTitle = document.getElementById('onboarding-title');
        const welcomeCard = document.getElementById('welcome-card');
        const agreementCard = document.getElementById('agreement-card');

        if(nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (welcomeCard) welcomeCard.classList.remove('active');
                if (agreementCard) agreementCard.classList.add('active');
                if (onboardingTitle) onboardingTitle.textContent = 'Acuerdo de Usuario';
            });
        }
        if(acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                localStorage.setItem('vitreumHubOnboardingComplete', 'true');
                transitionTo(loginScreen);
                setupLogin();
            });
        }
        if(denyBtn) {
            denyBtn.addEventListener('click', () => {
                const modal = document.createElement('div');
                modal.innerHTML = `<div class="modal-overlay show"><div class="modal-content"><h3>Acuerdo Requerido</h3><p>Debes aceptar los términos para poder usar la aplicación.</p><button class="modal-btn primary">Entendido</button></div></div>`;
                document.body.appendChild(modal);
                modal.querySelector('button')?.addEventListener('click', () => modal.remove());
            });
        }
    }

    // --- MÓDULO DE LOGIN CON GOOGLE ---
    function setupLogin() {
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            const newBtn = googleLoginBtn.cloneNode(true);
            googleLoginBtn.parentNode?.replaceChild(newBtn, googleLoginBtn);
            newBtn.addEventListener('click', () => {
                auth.signInWithPopup(provider).catch(error => {
                    console.error("Error de login:", error);
                    document.getElementById('login-error-modal')?.classList.add('show');
                });
            });
        }
    }

    // --- MANEJO DE PANTALLA DE REANUDACIÓN ---
    function setupResumeScreen(userData) {
        const resumeProfilePic = document.getElementById('resume-profile-pic');
        const resumeDisplayName = document.getElementById('resume-display-name');
        const resumeBtn = document.getElementById('resume-btn');
        const resumeLogoutBtn = document.getElementById('resume-logout-btn');
        if (!userData || !resumeProfilePic || !resumeDisplayName || !resumeBtn || !resumeLogoutBtn) {
            console.error("Elementos de reanudación no encontrados.");
            transitionTo(loginScreen);
            setupLogin();
            return;
        }
        resumeProfilePic.src = userData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';
        resumeDisplayName.textContent = userData.displayName || 'Usuario';
        
        const newResumeBtn = resumeBtn.cloneNode(true);
        resumeBtn.parentNode?.replaceChild(newResumeBtn, resumeBtn);
        newResumeBtn.addEventListener('click', () => {
            updateUIForUser(userData);
            transitionTo(appWrapper);
        });
        
        const newResumeLogoutBtn = resumeLogoutBtn.cloneNode(true);
        resumeLogoutBtn.parentNode?.replaceChild(newResumeLogoutBtn, resumeLogoutBtn);
        newResumeLogoutBtn.addEventListener('click', handleLogout);
    }

    // --- MANEJO DE CONFIGURACIÓN INICIAL MULTI-STEP ---
    function setupInitialConfig() {
        let currentStep = 1;
        const totalSteps = 4;
        const setupData = {};

        const steps = document.querySelectorAll('.setup-step');
        const progressSteps = document.querySelectorAll('.progress-step');
        const setupProfilePic = document.getElementById('setup-profile-pic');
        const profilePicInput = document.getElementById('profile-pic-input');
        const firstNameInput = document.getElementById('setup-first-name');
        const lastNameInput = document.getElementById('setup-last-name');
        const nicknameInput = document.getElementById('setup-nickname');
        const majorSelect = document.getElementById('setup-major');

        if(setupProfilePic) {
            setupProfilePic.src = currentUserData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';
        }
        setupData.photoURL = currentUserData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';

        if (currentUserData.displayName && firstNameInput && lastNameInput) {
            const nameParts = currentUserData.displayName.split(' ');
            lastNameInput.value = nameParts.pop() || '';
            firstNameInput.value = nameParts.join(' ');
        }
        
        if(profilePicInput) {
            profilePicInput.onchange = (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result;
                        if(setupProfilePic && typeof result === 'string') {
                            setupProfilePic.src = result;
                            setupData.photoURL = result;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        function navigateToStep(stepNumber) {
            currentStep = stepNumber;
            steps.forEach(step => step.classList.remove('active'));
            document.getElementById(`setup-step-${stepNumber}`)?.classList.add('active');
            progressSteps.forEach(pStep => {
                const step = parseInt(pStep.dataset.step || "0", 10);
                pStep.classList.toggle('active', step <= stepNumber);
            });
        }

        function validateStep(stepNumber) {
            if (stepNumber === 2 && (!firstNameInput?.value.trim() || !lastNameInput?.value.trim())) {
                alert('Por favor, ingresa tus nombres y apellidos.');
                return false;
            }
            if (stepNumber === 3 && !majorSelect?.value) {
                alert('Por favor, selecciona tu carrera.');
                return false;
            }
            return true;
        }

        document.querySelectorAll('.step-navigation button').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target;
                const action = target.dataset.action;
                if (action === 'next') {
                    if (validateStep(currentStep) && currentStep < totalSteps) {
                        navigateToStep(currentStep + 1);
                    }
                } else if (action === 'back' && currentStep > 1) {
                    navigateToStep(currentStep - 1);
                } else if (action === 'finish' || action === 'skip') {
                    setupData.firstName = firstNameInput?.value.trim() || '';
                    setupData.lastName = lastNameInput?.value.trim() || '';
                    setupData.nickname = nicknameInput?.value.trim() || '';
                    setupData.major = majorSelect?.value || '';
                    setupData.wantsSchedule = (action === 'finish');
                    finishSetup(setupData);
                }
            });
        });
        navigateToStep(1);
    }

    function finishSetup(data) {
        const user = auth.currentUser;
        if (user) {
            const displayName = `${data.firstName} ${data.lastName}`;

            localStorage.setItem(`vitreumHubSetupComplete_${user.uid}`, 'true');
            localStorage.setItem(`vitreumHubDisplayName_${user.uid}`, displayName);
            localStorage.setItem(`vitreumHubFirstName_${user.uid}`, data.firstName);
            localStorage.setItem(`vitreumHubLastName_${user.uid}`, data.lastName);
            localStorage.setItem(`vitreumHubNickname_${user.uid}`, data.nickname);
            localStorage.setItem(`vitreumHubMajor_${user.uid}`, data.major);

            if (data.photoURL && data.photoURL.startsWith('data:image')) {
                localStorage.setItem(`vitreumHubPhotoURL_${user.uid}`, data.photoURL);
            }

            currentUserData = {
                displayName: displayName,
                photoURL: data.photoURL,
                email: user.email,
                uid: user.uid
            };

            updateUIForUser(currentUserData);
            transitionTo(appWrapper);

            if (data.wantsSchedule) {
                setTimeout(openScheduleAssistant, 500);
            } else {
                renderSchedule();
                updateNextClassWidget();
            }
        }
    }

    // --- MANEJO DE DATOS DE USUARIO ---
    function loadUserFromStorage(user) {
        currentUserData = {
            displayName: localStorage.getItem(`vitreumHubDisplayName_${user.uid}`) || user.displayName,
            photoURL: localStorage.getItem(`vitreumHubPhotoURL_${user.uid}`) || user.photoURL,
            email: user.email,
            uid: user.uid
        };
    }

    function updateUIForUser(userData) {
        if (!userData) return;
        document.querySelectorAll('.user-profile-pic').forEach(el => el.src = userData.photoURL || '');
        document.querySelectorAll('.user-display-name').forEach(el => el.textContent = userData.displayName || 'Usuario');
        document.querySelectorAll('.user-email').forEach(el => el.textContent = userData.email || '');
    }

    // --- ACCIONES (NAVEGACIÓN Y LOGOUT) ---
    function setupNavigation() {
        const windowTitle = document.getElementById('window-title');
        const desktopNav = document.getElementById('desktop-nav-container');
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                const titleText = link.querySelector('span')?.textContent;
                if (!targetId || !titleText) return;
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                
                document.querySelectorAll(`.nav-link[data-target="${targetId}"]`).forEach(matchingLink => {
                    matchingLink.classList.add('active');
                });
                
                const targetPage = document.getElementById(targetId);
                if (targetPage) {
                    targetPage.classList.add('active');
                    targetPage.scrollTo(0, 0);
                }
                
                if (windowTitle) {
                    windowTitle.textContent = titleText;
                }
                
                if (desktopNav) {
                    desktopNav.classList.remove('active');
                }
            });
        });
    }

    function handleLogout() {
        const user = auth.currentUser;
        if (user) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes(user.uid)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        auth.signOut().then(() => {
            document.body.style.opacity = '0';
            setTimeout(() => location.reload(), 500);
        });
    }

    function setupActionButtons() {
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.querySelector('.logout-btn-mobile')?.addEventListener('click', handleLogout);
        document.getElementById('edit-schedule-btn')?.addEventListener('click', openScheduleAssistant);
    }

    // --- MÓDULO DE HORARIO ---

    let scheduleData = {};
    let currentAssistantDay = 'lunes';

    function getScheduleKey() {
        const user = auth.currentUser;
        return user ? `vitreumHubSchedule_${user.uid}` : null;
    }

    function loadSchedule() {
        const key = getScheduleKey();
        if (!key) return {};
        try {
            return JSON.parse(localStorage.getItem(key) || '{}') || {
                lunes: [], martes: [], miercoles: [], jueves: [], viernes: []
            };
        } catch(e) {
            console.error("Error parsing schedule data:", e);
            return { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
        }
    }

    function saveSchedule() {
        const key = getScheduleKey();
        if (key) {
            localStorage.setItem(key, JSON.stringify(scheduleData));
        }
    }

    function openScheduleAssistant() {
        scheduleData = loadSchedule();
        currentAssistantDay = 'lunes';
        renderAssistantForDay(currentAssistantDay);
        if(scheduleAssistantScreen) scheduleAssistantScreen.classList.add('show');
    }

    function closeScheduleAssistant() {
        if(scheduleAssistantScreen) scheduleAssistantScreen.classList.remove('show');
    }

    function renderAssistantForDay(day) {
        currentAssistantDay = day;
        const dayTitle = document.getElementById('assistant-day-title');
        const listContainer = document.getElementById('current-day-subjects-list');
        
        document.querySelectorAll('.day-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.day === day);
        });

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

            if (startInput.value >= endInput.value) {
                alert("La hora de inicio debe ser anterior a la hora de fin.");
                return;
            }

            const newSubject = {
                id: Date.now(),
                name: nameInput.value,
                teacher: teacherInput.value,
                start: startInput.value,
                end: endInput.value
            };

            if(!scheduleData[currentAssistantDay]) {
                scheduleData[currentAssistantDay] = [];
            }
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

    function renderSchedule() {
        const container = document.getElementById('schedule-content');
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
            html += `
                <div class="schedule-day-column">
                    <h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>
            `;
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

    // --- WIDGET PRÓXIMA CLASE ---
    function findNextClass() {
        const schedule = loadSchedule();
        const now = new Date();
        const dayMapping = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() + i);
            const dayName = dayMapping[checkDate.getDay()];

            if (schedule[dayName] && schedule[dayName].length > 0) {
                const sortedSubjects = [...schedule[dayName]].sort((a, b) => a.start.localeCompare(b.start));

                for (const subject of sortedSubjects) {
                    const [hours, minutes] = subject.start.split(':');
                    const subjectDateTime = new Date(checkDate);
                    subjectDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

                    if (subjectDateTime > now) {
                        return { ...subject,
                            date: subjectDateTime,
                            day: dayName
                        };
                    }
                }
            }
        }
        return null;
    }

    function updateNextClassWidget() {
        if (nextClassInterval) clearInterval(nextClassInterval);

        const widget = document.getElementById('next-class-widget');
        if (!widget) return;

        const nextClass = findNextClass();

        if (!nextClass) {
            widget.innerHTML = `
                <h3>Próxima Clase</h3>
                <p class="subtitle">¡Todo listo por ahora!</p>
                <div class="next-class-info" style="margin-top: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1;">
                    <i data-lucide="coffee" style="width: 48px; height: 48px; color: var(--accent-color);"></i>
                    <p style="margin-top: 10px;">No tienes más clases programadas.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const render = () => {
            const now = new Date();
            const diff = nextClass.date.getTime() - now.getTime();

            if (diff <= 0) {
                widget.innerHTML = `
                    <h3>Próxima Clase</h3>
                    <p class="subtitle">¡Ahora mismo!</p>
                    <div class="next-class-info" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                        <h4>${nextClass.name}</h4>
                        ${nextClass.teacher ? `<p class="teacher-info"><i data-lucide="user-check"></i>${nextClass.teacher}</p>` : ''}
                    </div>
                    <div class="countdown" style="color: var(--log-success);">En Curso</div>
                `;
                lucide.createIcons();
                clearInterval(nextClassInterval);
                setTimeout(updateNextClassWidget, 1000 * 60);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let countdownText = '';
            if (days > 0) {
                countdownText = `${days}d ${hours}h ${minutes}m`;
            } else {
                countdownText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }

            widget.innerHTML = `
                <h3>Próxima Clase</h3>
                <p class="subtitle">${nextClass.day.charAt(0).toUpperCase() + nextClass.day.slice(1)} a las ${nextClass.start}</p>
                <div class="next-class-info" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                    <h4>${nextClass.name}</h4>
                    ${nextClass.teacher ? `<p class="teacher-info"><i data-lucide="user-check"></i>${nextClass.teacher}</p>` : ''}
                </div>
                <div class="countdown">${countdownText}</div>
            `;
            lucide.createIcons();
        };

        render();
        nextClassInterval = setInterval(render, 1000);
    }

    // --- MÓDULO SLIDER ENOVA ---
    function setupEnovaSlider() {
        const sliderContainer = document.getElementById('enova-slider-container');
        const sliderHandle = document.getElementById('enova-slider-handle');
        if (!sliderContainer || !sliderHandle) return;

        let isDragging = false;
        let startX = 0;

        const startDrag = (e) => {
            isDragging = true;
            startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            sliderContainer.style.cursor = 'grabbing';
            sliderHandle.style.transition = 'none';
        };

        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const currentX = clientX - startX;

            const containerRect = sliderContainer.getBoundingClientRect();
            const handleWidth = sliderHandle.offsetWidth;
            const minX = 0;
            const maxX = containerRect.width - handleWidth - 8; // 4px padding on each side

            let newLeft = currentX;
            if (newLeft < minX) newLeft = minX;
            if (newLeft > maxX) newLeft = maxX;

            sliderHandle.style.left = `${newLeft + 4}px`;
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            sliderContainer.style.cursor = 'grab';
            sliderHandle.style.transition = 'left 0.2s ease-out';

            const containerRect = sliderContainer.getBoundingClientRect();
            const handleRect = sliderHandle.getBoundingClientRect();
            const threshold = containerRect.width * 0.8;

            if (handleRect.left - containerRect.left > threshold) {
                window.location.href = 'https://enova-grado.ucuenca.edu.ec/login/index.php';
            }
            
            // Reset position regardless of outcome after a small delay
            setTimeout(() => {
                 sliderHandle.style.left = '4px';
            }, 200);
        };

        sliderContainer.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        sliderContainer.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    // --- FUNCIONES DE UI ADICIONALES ---

    function updateThemeColor(imageUrl) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;
        img.onload = () => {
            const colorThief = new ColorThief();
            try {
                const dominantColor = colorThief.getColor(img);
                document.documentElement.style.setProperty('--card-dominant-r', dominantColor[0]);
                document.documentElement.style.setProperty('--card-dominant-g', dominantColor[1]);
                document.documentElement.style.setProperty('--card-dominant-b', dominantColor[2]);
            } catch (e) {
                console.error("Error al obtener el color dominante:", e);
                // Revertir a los valores por defecto en caso de error
                document.documentElement.style.setProperty('--card-dominant-r', 35);
                document.documentElement.style.setProperty('--card-dominant-g', 35);
                document.documentElement.style.setProperty('--card-dominant-b', 45);
            }
        };
        img.onerror = (e) => {
            console.error("Error al cargar la imagen para extracción de color:", e);
             // Revertir a los valores por defecto si la imagen no carga
            document.documentElement.style.setProperty('--card-dominant-r', 35);
            document.documentElement.style.setProperty('--card-dominant-g', 35);
            document.documentElement.style.setProperty('--card-dominant-b', 45);
        };
    }
    
    function loadCustomBackgroundAndTheme() {
        const customBg = localStorage.getItem('vitreumHubCustomBackground');
        if (customBg) {
            const screens = [onboardingScreen, loginScreen, setupScreen, appWrapper, resumeScreen];
            screens.forEach(screen => {
                if (screen) {
                    screen.style.backgroundImage = `url('${customBg}')`;
                }
            });
            updateThemeColor(customBg);
        }
    }

    function setupBackgroundChanger() {
        const bgFileInput = document.getElementById('background-file-input');
        if (bgFileInput) {
            bgFileInput.addEventListener('change', (e) => {
                const target = e.target;
                const file = target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const newBgDataUrl = event.target?.result;
                        if (typeof newBgDataUrl === 'string') {
                            localStorage.setItem('vitreumHubCustomBackground', newBgDataUrl);
                            const screens = [onboardingScreen, loginScreen, setupScreen, appWrapper, resumeScreen];
                            screens.forEach(screen => {
                                if (screen) screen.style.backgroundImage = `url('${newBgDataUrl}')`;
                            });
                            updateThemeColor(newBgDataUrl);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }


    // --- MÓDULOS DE UI (RELOJ, BARRAS DE PROGRESO) ---
    function startClock() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;

        function updateClock() {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            dateEl.textContent = now.toLocaleDateString('es-EC', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
            });
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    function animateProgressBars() {
        document.querySelectorAll('.progress-circle').forEach(circle => {
            const bar = circle.querySelector('.progress-bar');
            const progress = circle.dataset.progress;
            if (bar && progress) {
                const r = bar.r.baseVal.value;
                const circumference = 2 * Math.PI * r;
                bar.style.strokeDashoffset = String(circumference * (1 - parseInt(progress, 10) / 100));
            }
        });
    }

    // --- INICIAR LA APLICACIÓN ---
    initializeApp();
});
