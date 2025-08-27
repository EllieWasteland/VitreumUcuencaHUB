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
    const focusWave = splashScreen.querySelector('.focus-wave');
    const loadingText = splashScreen.querySelector('.loading-text');
    
    const onboardingScreen = document.getElementById('onboarding-screen');
    const loginScreen = document.getElementById('login-screen');
    const setupScreen = document.getElementById('setup-screen');
    const resumeScreen = document.getElementById('resume-screen');
    const appWrapper = document.getElementById('app-wrapper');
    let currentUserData = {};

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
        window.addEventListener('resize', setRealViewportHeight);
        fetchUpdates();
        determineInitialFlow(); 
    }

    // --- LÓGICA DE FLUJO INICIAL (CON VIDEOS) ---
    function determineInitialFlow() {
        const playVideo = async (videoElement) => {
            try {
                await videoElement.play();
            } catch (err) {
                console.error("Error al intentar reproducir el video (autoplay bloqueado):", err);
            }
        };

        const proceedToApp = () => {
            splashScreen.style.display = 'none';
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
            video1.classList.add('visible');
            playVideo(video1);
            focusWave.classList.add('scanning-forward');
            loadingText.classList.add('visible');
            loadingText.textContent = "Iniciando...";

            // --- CAMBIO: Transición al segundo video después de 1 segundo ---
            setTimeout(() => {
                loadingText.textContent = "Cargando componentes...";
                video1.classList.remove('visible');
                video2.classList.add('visible');
                playVideo(video2);
                focusWave.classList.remove('scanning-forward');
                focusWave.classList.add('scanning-backward');
            }, 2000);

            // --- CAMBIO: Salir del splash screen después de 2 segundos en total ---
            setTimeout(() => {
                loadingText.textContent = "Listo.";
                splashScreen.classList.add('exit');
                splashScreen.addEventListener('transitionend', proceedToApp, { once: true });
            }, 3000);
        };

        const checkVideoReady = (videoElement) => {
            return new Promise((resolve, reject) => {
                if (!videoElement) return resolve();
                if (videoElement.error) return reject(new Error(`Error al cargar video: ${videoElement.error.message}`));
                if (videoElement.readyState >= 3) return resolve();
                videoElement.oncanplaythrough = resolve;
                videoElement.onerror = () => reject(new Error(`No se pudo cargar: ${videoElement.src}`));
            });
        };

        // --- CAMBIO: Esperar a que AMBOS videos estén listos ---
        Promise.all([checkVideoReady(video1), checkVideoReady(video2)])
        .then(startSplashScreenSequence)
        .catch(error => {
            console.error("Fallo al cargar videos, saltando splash screen:", error.message);
            proceedToApp(); 
        });
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

    // --- MÓDULO DE ACTUALIZACIONES DESDE GITHUB ---
    async function fetchUpdates() {
        const logElement = document.getElementById('updates-log');
        if (!logElement) return;
        const url = 'https://raw.githubusercontent.com/EllieWasteland/VitreumUcuencaHUB/main/README.md';
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`Error de red! Estatus: ${response.status}`);
            const markdown = await response.text();
            const heading = '## Últimas Actualizaciones';
            const startIndex = markdown.indexOf(heading);
            if (startIndex === -1) { logElement.textContent = 'Error: No se encontró el encabezado.'; return; }
            const codeBlockStartIndex = markdown.indexOf('```', startIndex);
            if (codeBlockStartIndex === -1) { logElement.textContent = 'Error: No se encontró el bloque de código.'; return; }
            const codeBlockEndIndex = markdown.indexOf('```', codeBlockStartIndex + 3);
            if (codeBlockEndIndex === -1) { logElement.textContent = 'Error: No se encontró el final del bloque de código.'; return; }
            const updatesContent = markdown.substring(codeBlockStartIndex + 3, codeBlockEndIndex).trim();
            if (updatesContent) {
                const escapedContent = updatesContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const formattedHtml = escapedContent
                    .replace(/\[OK\]/g, '[<span class="log-success">OK</span>]')
                    .replace(/\[INFO\]/g, '[<span class="log-info">INFO</span>]')
                    .replace(/\[WARN\]/g, '[<span class="log-warn">WARN</span>]');
                logElement.innerHTML = formattedHtml;
            } else {
                logElement.textContent = 'La sección de actualizaciones está vacía.';
            }
        } catch (error) {
            console.error('Error al cargar las actualizaciones:', error);
            logElement.textContent = '> Error de conexión al cargar actualizaciones.';
        }
    }

    function setRealViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // --- MANEJO DE TRANSICIONES Y MODALES ---
    function transitionTo(activeScreen) {
        [onboardingScreen, loginScreen, setupScreen, appWrapper, resumeScreen].forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none'; 
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

        closeLoginErrorBtn?.addEventListener('click', () => loginErrorModal?.classList.remove('show'));
        
        enovaLoginBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            enovaRedirectModal?.classList.add('show');
        });

        enovaRedirectConfirm?.addEventListener('click', () => {
            window.open('https://enova-grado.ucuenca.edu.ec/login/index.php', '_blank');
            enovaRedirectModal?.classList.remove('show');
        });

        enovaRedirectCancel?.addEventListener('click', () => enovaRedirectModal?.classList.remove('show'));
    }

    // --- MANEJO DEL ONBOARDING ---
    function setupOnboarding() {
        const nextBtn = document.getElementById('next-btn');
        const acceptBtn = document.getElementById('accept-btn');
        const denyBtn = document.getElementById('deny-btn');
        const onboardingTitle = document.getElementById('onboarding-title');

        nextBtn.addEventListener('click', () => {
            document.getElementById('welcome-card').classList.remove('active');
            document.getElementById('agreement-card').classList.add('active');
            if (onboardingTitle) {
                onboardingTitle.textContent = 'Acuerdo de Usuario';
            }
        });

        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('vitreumHubOnboardingComplete', 'true');
            transitionTo(loginScreen);
            setupLogin();
        });

        denyBtn.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.innerHTML = `<div class="modal-overlay show"><div class="modal-content"><h3>Acuerdo Requerido</h3><p>Debes aceptar los términos para poder usar la aplicación.</p><button class="modal-btn primary">Entendido</button></div></div>`;
            document.body.appendChild(modal);
            modal.querySelector('button').onclick = () => modal.remove();
        });
    }

    // --- MÓDULO DE LOGIN CON GOOGLE ---
    function setupLogin() {
        const googleLoginBtn = document.getElementById('google-login-btn');
        const newBtn = googleLoginBtn.cloneNode(true);
        googleLoginBtn.parentNode.replaceChild(newBtn, googleLoginBtn);
        newBtn.addEventListener('click', () => {
            auth.signInWithPopup(provider).catch(error => {
                console.error("Error de login:", error);
                document.getElementById('login-error-modal')?.classList.add('show');
            });
        });
    }
    
    // --- NUEVA FUNCIÓN: MANEJO DE PANTALLA DE REANUDACIÓN ---
    function setupResumeScreen(userData) {
        const resumeProfilePic = document.getElementById('resume-profile-pic');
        const resumeDisplayName = document.getElementById('resume-display-name');
        const resumeBtn = document.getElementById('resume-btn');
        const resumeLogoutBtn = document.getElementById('resume-logout-btn');

        if (!userData || !resumeProfilePic || !resumeDisplayName || !resumeBtn || !resumeLogoutBtn) {
            console.error("Elementos de la pantalla de reanudación no encontrados.");
            transitionTo(loginScreen);
            setupLogin();
            return;
        }

        resumeProfilePic.src = userData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';
        resumeDisplayName.textContent = userData.displayName || 'Usuario';

        const newResumeBtn = resumeBtn.cloneNode(true);
        resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);
        newResumeBtn.addEventListener('click', () => {
            updateUIForUser(userData);
            transitionTo(appWrapper);
        });

        const newResumeLogoutBtn = resumeLogoutBtn.cloneNode(true);
        resumeLogoutBtn.parentNode.replaceChild(newResumeLogoutBtn, resumeLogoutBtn);
        newResumeLogoutBtn.addEventListener('click', handleLogout);
    }


    // --- MANEJO DE CONFIGURACIÓN INICIAL ---
    function setupInitialConfig() {
        const setupProfilePic = document.getElementById('setup-profile-pic');
        const setupDisplayName = document.getElementById('setup-display-name');
        const profilePicInput = document.getElementById('profile-pic-input');
        const finishSetupBtn = document.getElementById('finish-setup-btn');

        setupProfilePic.src = currentUserData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';
        setupDisplayName.value = currentUserData.displayName;

        profilePicInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { setupProfilePic.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        };

        finishSetupBtn.onclick = () => {
            const user = auth.currentUser;
            if (user) {
                currentUserData.displayName = setupDisplayName.value;
                currentUserData.photoURL = setupProfilePic.src;
                localStorage.setItem(`vitreumHubSetupComplete_${user.uid}`, 'true');
                localStorage.setItem(`vitreumHubDisplayName_${user.uid}`, currentUserData.displayName);
                if (currentUserData.photoURL.startsWith('data:image')) {
                    localStorage.setItem(`vitreumHubPhotoURL_${user.uid}`, currentUserData.photoURL);
                }
                updateUIForUser(currentUserData);
                transitionTo(appWrapper);
            }
        };
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
        document.querySelectorAll('.user-profile-pic').forEach(el => el.src = userData.photoURL);
        document.querySelectorAll('.user-display-name').forEach(el => el.textContent = userData.displayName);
        document.querySelectorAll('.user-email').forEach(el => el.textContent = userData.email);
    }

    // --- ACCIONES (NAVEGACIÓN Y LOGOUT) ---
    function setupNavigation() {
        const windowTitle = document.getElementById('window-title');
        const desktopNav = document.getElementById('desktop-nav-container');

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                const titleText = link.querySelector('span').textContent;
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                
                document.querySelectorAll(`.nav-link[data-target="${targetId}"]`).forEach(matchingLink => {
                    matchingLink.classList.add('active');
                });

                const targetPage = document.getElementById(targetId);
                if(targetPage) {
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
        auth.signOut().then(() => {
            document.body.style.opacity = '0';
            setTimeout(() => location.reload(), 500);
        });
    }

    function setupActionButtons() {
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        document.querySelector('.logout-btn-mobile')?.addEventListener('click', handleLogout);
    }

    // --- FUNCIONES DE UI ADICIONALES ---
    function loadCustomBackground() {
        const customBg = localStorage.getItem('vitreumHubCustomBackground');
        if (customBg) appWrapper.style.backgroundImage = `url('${customBg}')`;
    }

    function setupBackgroundChanger() {
        const bgFileInput = document.getElementById('background-file-input');
        bgFileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newBgDataUrl = event.target.result;
                    appWrapper.style.backgroundImage = `url('${newBgDataUrl}')`;
                    localStorage.setItem('vitreumHubCustomBackground', newBgDataUrl);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- MÓDULOS DE UI (RELOJ, BARRAS DE PROGRESO) ---
    function startClock() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;
        function updateClock() {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
            dateEl.textContent = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });
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
                bar.style.strokeDashoffset = circumference * (1 - progress / 100);
            }
        });
    }

    // --- INICIAR LA APLICACIÓN ---
    initializeApp();
});
