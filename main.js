// ===================================================================================
//  MAIN.JS
//  Núcleo de la aplicación. Se encarga de la inicialización, el flujo de
//  autenticación y la carga de datos. Orquesta las llamadas a los otros módulos.
// ===================================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let currentUserData = {};
let careerData = {}; 

document.addEventListener('DOMContentLoaded', function() {

    // --- CONFIGURACIÓN Y CONSTANTES ---
    const firebaseConfig = {
        apiKey: "AIzaSyB1W2yLlVHivzBQPZJVOgpApQeYnJUFzCs",
        authDomain: "vitreumucuencahub.firebaseapp.com",
        projectId: "vitreumucuencahub",
        storageBucket: "vitreumucuencahub.firebasestorage.app",
        messagingSenderId: "628136581064",
        appId: "1:6281365-4602fd2fd"
    };
    // Ahora apunta a los directorios de cada carrera
    const CAREER_DATA_PATHS = {
        'periodismo': 'https://raw.githubusercontent.com/EllieWasteland/VitreumUcuencaHUB/main/Perio', // Ruta a la carpeta
        'educacion-basica': 'https://raw.githubusercontent.com/EllieWasteland/VitreumUcuencaHUB/main/EBasica', // Ruta a la carpeta local
        'offline': './offline-data.json' // Offline sigue siendo un archivo único
    };

    // --- INICIALIZACIÓN DE FIREBASE ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    /**
     * Función principal que inicializa todos los componentes de la aplicación.
     */
    function initializeApp() {
        lucide.createIcons();
        setupNavigation();
        setupActionButtons();
        setupBackgroundChanger();
        setupModals();
        setRealViewportHeight();
        setupSidebar(handleLogout);
        setupScheduleAssistant();
        setupSearch();
        window.addEventListener('resize', setRealViewportHeight);
        loadCustomBackgroundAndTheme();
        determineInitialFlow();
    }
    
    // --- LÓGICA DE CARGA Y VALIDACIÓN DE DATOS ---
    
    /**
     * Obtiene los datos de la carrera desde una URL construida dinámicamente.
     * @param {string} major - El identificador de la carrera.
     * @param {string} cycle - El identificador del ciclo.
     * @returns {Promise<object>} Los datos de la carrera en formato JSON.
     */
    async function getRemoteCareerData(major, cycle) {
        if (major === 'offline') {
            const response = await fetch(CAREER_DATA_PATHS['offline']);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for offline data`);
            return await response.json();
        }

        if (!major || !cycle || !CAREER_DATA_PATHS[major]) {
            console.warn(`Carrera o ciclo no especificado o no encontrado: "${major}", "${cycle}".`);
            throw new Error('Carrera o ciclo inválido para la carga de datos.');
        }
        
        // La URL se construye dinámicamente para apuntar al JSON del ciclo específico
        const url = `${CAREER_DATA_PATHS[major]}/${cycle}.json`;
        console.log("Cargando datos desde:", url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        return await response.json();
    }

    /**
     * Gestiona la carga de datos, comparando la versión local con la remota.
     * @param {string} major - El identificador de la carrera del usuario.
     * @param {string} cycle - El identificador del ciclo del usuario.
     */
    async function handleDataLoadingAndValidation(major, cycle) {
        // La clave de almacenamiento local ahora incluye el ciclo para un caché específico
        const localDataKey = `vitreumHubData_${major}_${cycle}`;
        const localDataString = localStorage.getItem(localDataKey);
        let remoteData;

        try {
            remoteData = await getRemoteCareerData(major, cycle);
        } catch (error) {
            console.error("No se pudo cargar el archivo de datos remoto:", error);
            if (localDataString) {
                console.log("Cargando datos desde el almacenamiento local como fallback.");
                careerData = JSON.parse(localDataString);
                renderAppContent();
            } else {
                alert("Error crítico: No se pueden cargar los datos de la aplicación y no hay una copia local.");
                try {
                    careerData = await getRemoteCareerData('offline', null); // El ciclo no es necesario para offline
                    renderAppContent();
                } catch (offlineError) {
                    console.error("Fallo al cargar incluso los datos offline por defecto.", offlineError);
                }
            }
            return;
        }

        if (!localDataString || localDataString === JSON.stringify(remoteData)) {
            if (!localDataString) console.log("Primera carga para este ciclo, guardando datos locales.");
            else console.log("Los datos locales están actualizados.");
            localStorage.setItem(localDataKey, JSON.stringify(remoteData));
            careerData = remoteData;
            renderAppContent();
        } else {
            console.log("Actualización de datos disponible.");
            showUpdateModal(remoteData, JSON.parse(localDataString), localDataKey);
        }
    }

    /**
     * Muestra un modal para que el usuario confirme la actualización de los datos.
     * @param {object} newData - Los nuevos datos remotos.
     * @param {object} oldData - Los datos locales antiguos.
     * @param {string} storageKey - La clave para guardar en localStorage.
     */
    function showUpdateModal(newData, oldData, storageKey) {
        const modal = document.getElementById('data-update-modal');
        const confirmBtn = document.getElementById('update-data-confirm');
        const skipBtn = document.getElementById('update-data-skip');
        if (!modal || !confirmBtn || !skipBtn) return;

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        const newSkipBtn = skipBtn.cloneNode(true);
        skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);

        newConfirmBtn.onclick = () => {
            localStorage.setItem(storageKey, JSON.stringify(newData));
            careerData = newData;
            modal.classList.remove('show');
            renderAppContent();
        };
        newSkipBtn.onclick = () => {
            careerData = oldData;
            modal.classList.remove('show');
            renderAppContent();
        };
        
        lucide.createIcons();
        modal.classList.add('show');
    }

    /**
     * Llama a las funciones de renderizado después de que los datos se han cargado.
     */
    function renderAppContent() {
        const appWrapper = document.getElementById('app-wrapper');
        updateUIForUser(currentUserData);
        renderAllDynamicContent();
        renderSchedule();
        updateNextClassWidget();
        transitionTo(appWrapper);
    }
    
    // --- LÓGICA DE FLUJO INICIAL ---
    
    /**
     * Determina qué pantalla mostrar al iniciar la app (Onboarding, Login, Setup, etc.).
     */
    function determineInitialFlow() {
        const splashScreen = document.getElementById('splash-screen');
        const video1 = document.getElementById('splash-video-1');
        const video2 = document.getElementById('splash-video-2');

        const playVideo = async (video) => {
            try { if (video) await video.play(); } 
            catch (err) { console.error("Error al reproducir video:", err); }
        };

        const proceedToApp = () => {
            if(splashScreen) splashScreen.style.display = 'none';

            auth.onAuthStateChanged(async user => {
                if (localStorage.getItem('vitreumHubOnboardingComplete') !== 'true') {
                    transitionTo(document.getElementById('onboarding-screen'));
                    setupOnboarding();
                } else if (user) {
                    if (!user.email.endsWith('@ucuenca.edu.ec')) {
                        auth.signOut();
                        document.getElementById('login-error-modal')?.classList.add('show');
                        transitionTo(document.getElementById('login-screen'));
                        setupLogin();
                        return;
                    }
                    if (localStorage.getItem(`vitreumHubSetupComplete_${user.uid}`) === 'true') {
                        loadUserFromStorage(user);
                        setupResumeScreen(currentUserData);
                        transitionTo(document.getElementById('resume-screen'));
                    } else {
                        currentUserData = { displayName: user.displayName, photoURL: user.photoURL, email: user.email, uid: user.uid };
                        transitionTo(document.getElementById('setup-screen'));
                        setupInitialConfig();
                    }
                } else {
                    transitionTo(document.getElementById('login-screen'));
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
        
        Promise.all([video1?.play(), video2?.play()]).catch(() => {}).finally(startSplashScreenSequence);
    }

    /**
     * Configura la lógica y eventos de la pantalla de Onboarding.
     */
    function setupOnboarding() {
        const welcomeCard = document.getElementById('welcome-card');
        const privacyCard = document.getElementById('privacy-card');
        const agreementCard = document.getElementById('agreement-card');
        const onboardingTitle = document.getElementById('onboarding-title');
    
        const navigateOnboarding = (activeCard, title) => {
            [welcomeCard, privacyCard, agreementCard].forEach(card => card?.classList.remove('active'));
            activeCard?.classList.add('active');
            if (onboardingTitle) onboardingTitle.textContent = title;
        };
    
        document.getElementById('next-to-privacy-btn')?.addEventListener('click', () => navigateOnboarding(privacyCard, 'Tu Privacidad'));
        document.getElementById('back-to-welcome-btn')?.addEventListener('click', () => navigateOnboarding(welcomeCard, 'Bienvenida'));
        document.getElementById('next-to-agreement-btn')?.addEventListener('click', () => navigateOnboarding(agreementCard, 'Acuerdo de Usuario'));
        document.getElementById('back-to-privacy-btn')?.addEventListener('click', () => navigateOnboarding(privacyCard, 'Tu Privacidad'));
        document.getElementById('accept-btn')?.addEventListener('click', () => {
            localStorage.setItem('vitreumHubOnboardingComplete', 'true');
            transitionTo(document.getElementById('login-screen'));
            setupLogin();
        });
    }

    /**
     * Configura el botón de login con Google.
     */
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

    /**
     * Configura la pantalla de "Reanudar Sesión".
     * @param {object} userData - Datos del usuario.
     */
    function setupResumeScreen(userData) {
        const resumeProfilePic = document.getElementById('resume-profile-pic');
        const resumeDisplayName = document.getElementById('resume-display-name');
        const resumeBtn = document.getElementById('resume-btn');
        const resumeLogoutBtn = document.getElementById('resume-logout-btn');

        if (!userData || !resumeProfilePic || !resumeDisplayName || !resumeBtn || !resumeLogoutBtn) {
            transitionTo(document.getElementById('login-screen'));
            setupLogin();
            return;
        }

        resumeProfilePic.src = userData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';
        resumeDisplayName.textContent = userData.displayName || 'Usuario';
        
        const newResumeBtn = resumeBtn.cloneNode(true);
        resumeBtn.parentNode?.replaceChild(newResumeBtn, resumeBtn);
        // La llamada ahora incluye el ciclo del usuario
        newResumeBtn.addEventListener('click', () => handleDataLoadingAndValidation(userData.major, userData.cycle));
        
        const newResumeLogoutBtn = resumeLogoutBtn.cloneNode(true);
        resumeLogoutBtn.parentNode?.replaceChild(newResumeLogoutBtn, resumeLogoutBtn);
        newResumeLogoutBtn.addEventListener('click', handleLogout);
    }

    /**
     * Configura el asistente de configuración inicial multi-paso.
     */
    function setupInitialConfig() {
        let currentStep = 1;
        const totalSteps = 7;
        const setupData = { photoURL: currentUserData.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?' };
    
        const setupProfilePic = document.getElementById('setup-profile-pic');
        const firstNameInput = document.getElementById('setup-first-name');
        const lastNameInput = document.getElementById('setup-last-name');
        
        if (setupProfilePic) setupProfilePic.src = setupData.photoURL;
        if (currentUserData.displayName && firstNameInput && lastNameInput) {
            const nameParts = currentUserData.displayName.split(' ');
            lastNameInput.value = nameParts.pop() || '';
            firstNameInput.value = nameParts.join(' ');
        }
    
        document.getElementById('profile-pic-input')?.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (setupProfilePic && typeof e.target?.result === 'string') {
                        setupProfilePic.src = e.target.result;
                        setupData.photoURL = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    
        const navigateToStep = (stepNumber) => {
            currentStep = stepNumber;
            document.querySelectorAll('.setup-step').forEach(step => step.classList.remove('active'));
            document.getElementById(`setup-step-${stepNumber}`)?.classList.add('active');
            document.querySelectorAll('.progress-step').forEach(pStep => {
                pStep.classList.toggle('active', parseInt(pStep.dataset.step || "0", 10) <= stepNumber);
            });
        };
    
        document.querySelectorAll('.step-navigation button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'next' && currentStep < totalSteps) navigateToStep(currentStep + 1);
                else if (action === 'back' && currentStep > 1) navigateToStep(currentStep - 1);
                else if (action === 'finish' || action === 'skip') {
                    setupData.firstName = firstNameInput?.value.trim() || '';
                    setupData.lastName = lastNameInput?.value.trim() || '';
                    setupData.nickname = document.getElementById('setup-nickname')?.value.trim() || '';
                    setupData.major = document.querySelector('input[name="major"]:checked')?.value || (action === 'skip' ? 'offline' : '');
                    setupData.cycle = document.querySelector('input[name="cycle"]:checked')?.value || (action === 'skip' ? 'default' : '');
                    setupData.group = document.querySelector('input[name="group"]:checked')?.value || '';
                    setupData.modality = document.querySelector('input[name="modality"]:checked')?.value || '';
                    setupData.useAI = (action === 'finish');
                    finishSetup(setupData);
                }
            });
        });
        navigateToStep(1);
    }

    /**
     * Finaliza el proceso de configuración, guarda los datos del usuario y avanza a la app.
     * @param {object} data - Los datos recopilados en el setup.
     */
    async function finishSetup(data) {
        const user = auth.currentUser;
        if (user) {
            const displayName = `${data.firstName} ${data.lastName}`;
            currentUserData = { ...data, displayName, email: user.email, uid: user.uid };
            
            localStorage.setItem(`vitreumHubSetupComplete_${user.uid}`, 'true');
            localStorage.setItem(`vitreumHubDisplayName_${user.uid}`, displayName);
            localStorage.setItem(`vitreumHubMajor_${user.uid}`, data.major);
            localStorage.setItem(`vitreumHubCycle_${user.uid}`, data.cycle);
            localStorage.setItem(`vitreumHubGroup_${user.uid}`, data.group);
            localStorage.setItem(`vitreumHubModality_${user.uid}`, data.modality);
            localStorage.setItem('vitreumHubAI-Processing', data.useAI);
            if (data.photoURL.startsWith('data:image')) {
                localStorage.setItem(`vitreumHubPhotoURL_${user.uid}`, data.photoURL);
            }
    
            try {
                // La llamada ahora incluye el ciclo para cargar el archivo correcto
                careerData = await getRemoteCareerData(currentUserData.major, currentUserData.cycle);
                // La clave de almacenamiento ahora es específica del ciclo
                localStorage.setItem(`vitreumHubData_${currentUserData.major}_${currentUserData.cycle}`, JSON.stringify(careerData));
                renderAppContent();
                if (data.useAI && data.major !== 'offline') {
                    autoCompleteSchedule();
                }
            } catch(e) {
                alert("No se pudo descargar la configuración inicial. Por favor, intenta de nuevo.");
                console.error("Error en la configuración inicial al descargar datos", e);
            }
        }
    }

    // --- MANEJO DE DATOS DE USUARIO ---

    /**
     * Carga los datos del perfil del usuario desde localStorage.
     * @param {object} user - El objeto de usuario de Firebase.
     */
    function loadUserFromStorage(user) {
        currentUserData = {
            displayName: localStorage.getItem(`vitreumHubDisplayName_${user.uid}`) || user.displayName,
            photoURL: localStorage.getItem(`vitreumHubPhotoURL_${user.uid}`) || user.photoURL,
            email: user.email,
            uid: user.uid,
            major: localStorage.getItem(`vitreumHubMajor_${user.uid}`),
            cycle: localStorage.getItem(`vitreumHubCycle_${user.uid}`),
            group: localStorage.getItem(`vitreumHubGroup_${user.uid}`),
            modality: localStorage.getItem(`vitreumHubModality_${user.uid}`),
        };
    }

    /**
     * Actualiza los elementos de la UI con los datos del usuario (nombre, foto, email).
     * @param {object} userData - Los datos del usuario.
     */
    function updateUIForUser(userData) {
        if (!userData) return;
        document.querySelectorAll('.user-profile-pic').forEach(el => {
            el.src = userData.photoURL || 'https://placehold.co/120x120/ffffff/1e1e28?text=?';
            el.onerror = () => { el.src = 'https://placehold.co/120x120/ffffff/1e1e28?text=?'; };
        });
        document.querySelectorAll('.user-display-name').forEach(el => el.textContent = userData.displayName || 'Usuario');
        document.querySelectorAll('.user-email').forEach(el => el.textContent = userData.email || '');
    }

    /**
     * Cierra la sesión del usuario, limpia sus datos y recarga la página.
     */
    function handleLogout() {
        const user = auth.currentUser;
        if (user) {
            Object.keys(localStorage).forEach(key => {
                if (key.includes(user.uid) && !key.startsWith('vitreumHubData_')) {
                    localStorage.removeItem(key);
                }
            });
        }
        auth.signOut().then(() => {
            document.body.style.opacity = '0';
            setTimeout(() => location.reload(), 500);
        });
    }
    
    // --- INICIAR LA APLICACIÓN ---
    initializeApp();
});

