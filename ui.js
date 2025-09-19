// ===================================================================================
//  UI.JS
//  Módulo de renderizado y manejo de la interfaz de usuario. Contiene todas
//  las funciones que modifican el DOM para mostrar contenido dinámico.
// ===================================================================================

// --- ESTADO DEL MÓDULO DE UI ---
let summarySliderInterval;
let searchableItems = [];

/**
 * Orquesta el renderizado de todo el contenido dinámico de la aplicación.
 */
function renderAllDynamicContent() {
    if (!careerData) return;

    // El ciclo ya no es necesario aquí para acceder a los datos
    const { group, modality, major } = currentUserData;
    let contentData;

    if (major === 'offline') {
        // Asumiendo que los datos offline pueden tener una estructura diferente
        contentData = careerData.cycle_specific.default; 
    } else {
        // careerData ya es el objeto para el ciclo específico. Solo necesitamos grupo y modalidad.
        contentData = careerData[group]?.[modality];
        
        if (!contentData) {
            console.warn(`No se encontraron datos para ${major} -> grupo ${group}/${modality}. Buscando fallback.`);
            // La lógica de fallback también se simplifica
            const fallbackGroup = careerData ? Object.keys(careerData)[0] : null;
            const fallbackModality = fallbackGroup && careerData[fallbackGroup] ? Object.keys(careerData[fallbackGroup])[0] : null;
            
            if (fallbackGroup && fallbackModality) {
                console.log(`Usando fallback: grupo ${fallbackGroup}/${fallbackModality}`);
                contentData = careerData[fallbackGroup][fallbackModality];
            } else {
                console.error("No se encontró contenido de respaldo dentro de los datos del ciclo cargado.");
                return;
            }
        }
    }
    
    if (contentData) { // Verificar si contentData se asignó correctamente
        if (contentData.summary_content) {
            renderSummary(contentData.summary_content);
        }
        if (contentData.services) {
            renderServices(contentData.services);
            renderSidebar(contentData.services);
        }
        if (contentData.apps) {
            renderApps(contentData.apps);
        }
        if (contentData.contacts) {
            renderContacts(contentData.contacts);
        }
        
        searchableItems = collectSearchableItems(contentData);
    } else {
        console.error("No se pudo determinar el contentData para renderizar.");
    }
}


/**
 * Renderiza el contenido de la página de Resumen.
 * @param {object} content - Datos para la sección de resumen.
 */
function renderSummary(content) {
    if (!content) return;
    const { summary_slider, summary_services, quick_access_cards } = content;

    if (summary_slider) {
        renderSummarySlider(summary_slider);
    }

    const servicesSection = document.getElementById('summary-services-section');
    if (servicesSection && summary_services) {
        const itemsHTML = summary_services.items.map(item => `
            <li class="installed-app-item">
                <div class="app-identity">
                    <div class="app-icon" style="background-color: ${item.color}; color: ${item.textColor};"><i data-lucide="${item.icon}"></i></div>
                    <span>${item.name}</span>
                </div>
                <div class="app-status">
                    <span class="status-dot ${item.online ? 'green' : 'red'}"></span>
                    <span>${item.online ? 'En línea' : 'Offline'}</span>
                </div>
                <div class="app-actions">
                    <a href="${item.url}" target="_blank" class="action-button open">Abrir</a>
                </div>
            </li>
        `).join('');
        servicesSection.innerHTML = `
            <h3 class="summary-section-title">${summary_services.title}</h3>
            <div class="widget installed-apps-container">
                <ul class="installed-apps-list">${itemsHTML}</ul>
            </div>
        `;
    }

    const quickAccessSection = document.getElementById('quick-access-section');
    if (quickAccessSection && quick_access_cards) {
        const cardsHTML = quick_access_cards.items.map(card => `
            <div class="widget quick-access-card">
                <div class="card-header">
                    <div class="app-icon" style="background-color: ${card.color}; color: ${card.textColor};"><i data-lucide="${card.icon}"></i></div>
                    <h4>${card.title}</h4>
                </div>
                <p class="card-subtext">${card.description}</p>
                <div class="card-actions">
                    <a href="${card.url}" target="_blank" class="card-button">${card.buttonText}</a>
                </div>
            </div>
        `).join('');
        
        quickAccessSection.innerHTML = `
            <h3 class="summary-section-title">${quick_access_cards.title}</h3>
            <div class="summary-cards-grid">
                <div id="next-class-widget" class="widget quick-access-card next-class-widget-container"></div>
                ${cardsHTML}
            </div>
        `;
        updateNextClassWidget();
    }
    lucide.createIcons();
}

/**
 * Renderiza y controla el carrusel de imágenes en la cabecera.
 * @param {Array} slides - Array de objetos de slide.
 */
function renderSummarySlider(slides) {
    const headerContainer = document.getElementById('summary-header-container');
    if (!headerContainer || !slides || slides.length === 0) return;

    if (summarySliderInterval) clearInterval(summarySliderInterval);

    let currentSlideIndex = 0;
    let slidesHTML = slides.map((slide, index) => {
        const isActive = index === 0 ? 'active' : '';
        return `
            <div class="slider-slide ${isActive}" data-index="${index}">
                <a href="${slide.url}" data-target="${slide.url.substring(1)}">
                    <img src="${slide.image}" alt="${slide.title}" class="slider-slide-img">
                    <div class="summary-header-text">
                        <h3>${slide.title.replace('{userName}', currentUserData.displayName?.split(' ')[0] || 'Usuario')}</h3>
                        <p>${slide.description}</p>
                        <div class="summary-header-button">${slide.buttonText}</div>
                    </div>
                </a>
            </div>`;
    }).join('');
    
    let dotsHTML = slides.map((_, index) => `<div class="slider-dot ${index === 0 ? 'active' : ''}" data-slide-to="${index}"></div>`).join('');

    headerContainer.innerHTML = `
        ${slidesHTML}
        <button class="slider-nav prev"><i data-lucide="chevron-left"></i></button>
        <button class="slider-nav next"><i data-lucide="chevron-right"></i></button>
        <div class="slider-dots">${dotsHTML}</div>
    `;
    lucide.createIcons();

    const slideElements = headerContainer.querySelectorAll('.slider-slide');
    const dotElements = headerContainer.querySelectorAll('.slider-dot');

    function showSlide(index) {
        slideElements.forEach(slide => slide.classList.remove('active'));
        dotElements.forEach(dot => dot.classList.remove('active'));
        slideElements[index]?.classList.add('active');
        dotElements[index]?.classList.add('active');
        currentSlideIndex = index;
    }

    const nextSlide = () => showSlide((currentSlideIndex + 1) % slides.length);
    const prevSlide = () => showSlide((currentSlideIndex - 1 + slides.length) % slides.length);

    const resetInterval = () => {
        clearInterval(summarySliderInterval);
        summarySliderInterval = setInterval(nextSlide, 5000);
    };
    
    headerContainer.querySelector('.next').addEventListener('click', () => { nextSlide(); resetInterval(); });
    headerContainer.querySelector('.prev').addEventListener('click', () => { prevSlide(); resetInterval(); });
    
    dotElements.forEach(dot => {
        dot.addEventListener('click', (e) => {
            showSlide(parseInt(e.target.dataset.slideTo, 10));
            resetInterval();
        });
    });

    headerContainer.querySelectorAll('.slider-slide a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = link.dataset.target;
            document.querySelector(`.nav-link[data-target='${targetId}']`)?.click();
        });
    });

    summarySliderInterval = setInterval(nextSlide, 5000);
    showSlide(0);
}

/**
 * Renderiza la cuadrícula de aplicaciones en la página de Apps.
 * @param {Array} appsData - Array de datos de las apps.
 */
function renderApps(appsData) {
    const container = document.getElementById('apps-grid-container');
    if (!container || !appsData) return;
    container.innerHTML = appsData.map(app => `
        <div class="widget app-card">
            <div class="app-preview-image"><img src="${app.image}" alt="${app.title}"></div>
            <div class="app-info">
                <h3>${app.title}</h3>
                <p>${app.description}</p>
            </div>
            <a href="${app.url}" target="_blank" class="app-open-button">${app.buttonText}</a>
        </div>
    `).join('');
}

/**
 * Renderiza las categorías y tarjetas de servicios.
 * @param {Array} servicesData - Datos de los servicios.
 */
function renderServices(servicesData) {
    const container = document.getElementById('services-categories-container');
    if (!container || !servicesData) return;
    
    container.innerHTML = ''; 
    servicesData.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'services-category';
        
        let cardsHTML = category.subcategories.map(sub => 
            sub.cards.map(card => `
                <div class="widget app-card">
                    <div class="app-preview-image"><img src="${card.image}" alt="${card.title}"></div>
                    <div class="app-info">
                        <h3>${card.title}</h3>
                        <p>${card.description}</p>
                    </div>
                    <a href="${card.url}" id="${card.id || ''}" target="_blank" class="app-open-button">${card.buttonText}</a>
                </div>
            `).join('')
        ).join('');

        categoryElement.innerHTML = `
            <h2 class="category-title">${category.category}</h2>
            <p class="category-description">${category.description || ''}</p>
            <div class="apps-grid">${cardsHTML}</div>
        `;
        container.appendChild(categoryElement);
    });
    
    const enovaLoginBtn = document.getElementById('enova-login-btn');
    if(enovaLoginBtn) {
        enovaLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('enova-redirect-modal');
            if (modal) modal.classList.add('show');
            
            document.getElementById('enova-redirect-confirm')?.addEventListener('click', () => {
                window.open(enovaLoginBtn.href, '_blank');
                if (modal) modal.classList.remove('show');
            }, { once: true });
            document.getElementById('enova-redirect-cancel')?.addEventListener('click', () => {
                if (modal) modal.classList.remove('show');
            }, { once: true });
        });
    }
}

/**
 * Renderiza los elementos del submenú de servicios en la barra lateral.
 * @param {Array} servicesData - Datos de los servicios.
 */
function renderSidebar(servicesData) {
    const servicesNavItem = document.getElementById('services-nav-item');
    const submenu = servicesNavItem?.querySelector('.submenu');
    if (!submenu || !servicesData) return;

    submenu.innerHTML = '';
    let subcategoryCount = 0;

    servicesData.forEach(category => {
        category.subcategories.forEach(sub => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="nav-link" data-target="services-content"><span>${sub.title}</span></a>`;
            submenu.appendChild(li);
            subcategoryCount++;
        });
    });

    const arrow = servicesNavItem.querySelector('.submenu-arrow');
    if (arrow) arrow.style.display = subcategoryCount > 0 ? 'inline-block' : 'none';
}

/**
 * Renderiza la lista de tarjetas de contacto.
 * @param {Array} contactsData - Datos de los contactos.
 */
function renderContacts(contactsData) {
    const container = document.getElementById('contacts-list-container');
    if (!container || !contactsData || contactsData.length === 0) {
        if (container) container.innerHTML = `<p class="empty-list-msg">No hay contactos disponibles para tu selección.</p>`;
        return;
    }

    container.innerHTML = contactsData.map(contact => `
        <div class="widget contact-card">
            <div class="contact-info">
                <h3 class="contact-name">${contact.name}</h3>
                <p class="contact-position">${contact.position}</p>
                <p class="contact-email"><i data-lucide="mail"></i> ${contact.email}</p>
            </div>
            <a href="mailto:${contact.email}" class="contact-button">Enviar Mensaje</a>
        </div>
    `).join('');
    lucide.createIcons();
}

/**
 * Configura los eventos y la lógica de la barra lateral (abrir, cerrar, submenú).
 * @param {Function} logoutHandler - La función para manejar el cierre de sesión.
 */
function setupSidebar(logoutHandler) {
    const menuBtn = document.getElementById('menu-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const servicesNavItem = document.getElementById('services-nav-item');
    
    const closeSidebar = () => document.body.classList.remove('sidebar-open');

    menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.classList.toggle('sidebar-open');
    });
    overlay?.addEventListener('click', closeSidebar);
    
    document.getElementById('logout-btn-sidebar')?.addEventListener('click', logoutHandler);

    if (servicesNavItem) {
        const servicesLink = servicesNavItem.querySelector('.nav-link');
        const submenu = servicesNavItem.querySelector('.submenu');
        const arrow = servicesNavItem.querySelector('.submenu-arrow');

        servicesLink?.addEventListener('click', (e) => {
            if (submenu?.children.length > 0) {
                 e.preventDefault();
                 servicesNavItem.classList.toggle('open');
                 submenu.style.maxHeight = servicesNavItem.classList.contains('open') ? submenu.scrollHeight + "px" : '0';
                 if (arrow) arrow.style.transform = servicesNavItem.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }
}

/**
 * Ajusta la altura del viewport para corregir problemas en móviles (100vh).
 */
function setRealViewportHeight() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}

/**
 * Gestiona la transición visual entre las diferentes pantallas principales.
 * @param {HTMLElement} activeScreen - El elemento de la pantalla a mostrar.
 */
function transitionTo(activeScreen) {
    const screens = [
        document.getElementById('onboarding-screen'),
        document.getElementById('login-screen'),
        document.getElementById('setup-screen'),
        document.getElementById('app-wrapper'),
        document.getElementById('resume-screen')
    ];
    screens.forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
            screen.style.display = 'none';
        }
    });
    if (activeScreen) {
        activeScreen.style.display = (activeScreen.id === 'app-wrapper') ? 'block' : 'flex';
        setTimeout(() => activeScreen.classList.add('active'), 20);
    }
}

/**
 * Configura los eventos para los modales de la aplicación.
 */
function setupModals() {
    document.getElementById('login-error-modal-close')?.addEventListener('click', () => {
        document.getElementById('login-error-modal')?.classList.remove('show');
    });
}

/**
 * Configura la navegación principal de la aplicación a través de la barra lateral.
 */
function setupNavigation() {
    document.querySelector('.sidebar-nav')?.addEventListener('click', (e) => {
        const link = e.target.closest('a.nav-link');
        if (!link || link.classList.contains('has-submenu')) return;

        e.preventDefault();
        const targetId = link.getAttribute('data-target') || link.getAttribute('href')?.substring(1);
        if (!targetId) return;

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        
        link.classList.add('active');
        link.closest('#services-nav-item')?.querySelector('.nav-link.has-submenu')?.classList.add('active');

        const targetPage = document.getElementById(targetId);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.scrollTo(0, 0);
        }

        if (document.body.classList.contains('sidebar-open')) {
            document.body.classList.remove('sidebar-open');
        }
    });
}

/**
 * Añade listeners a los botones de acción globales (ej. editar horario).
 */
function setupActionButtons() {
    document.getElementById('edit-schedule-btn')?.addEventListener('click', openScheduleAssistant);
    document.getElementById('edit-schedule-btn-from-page')?.addEventListener('click', openScheduleAssistant);
}

/**
 * Recopila todos los elementos que se pueden buscar de los datos de la carrera.
 * @param {object} data - Los datos de la carrera.
 * @returns {Array} Un array de objetos buscables.
 */
function collectSearchableItems(data) {
    const items = [];
    const seenKeys = new Set(); 

    const addItem = (name, url, icon, type) => {
        const key = `${name}|${url}`;
        if (name && url && !seenKeys.has(key)) {
            items.push({ name, url, icon, type });
            seenKeys.add(key);
        }
    };
    
    addItem('Resumen', '#summary-content', 'layout-grid', 'internal');
    addItem('Horario', '#schedule-content', 'calendar-clock', 'internal');
    addItem('Servicios', '#services-content', 'briefcase', 'internal');
    addItem('Apps', '#apps-content', 'app-window', 'internal');
    addItem('Contactos', '#contacts-content', 'contact', 'internal');
    addItem('Ajustes', '#settings-content', 'settings', 'internal');

    if (!data) return items;

    data.summary_content?.summary_slider?.forEach(item => addItem(item.title, item.url, item.icon || 'link', 'internal'));
    data.summary_content?.summary_services?.items.forEach(item => addItem(item.name, item.url, item.icon, 'external'));
    data.summary_content?.quick_access_cards?.items.forEach(item => addItem(item.title, item.url, item.icon, 'external'));
    data.apps?.forEach(app => addItem(app.title, app.url, 'app-window', 'external'));
    data.services?.forEach(category => {
        category.subcategories?.forEach(sub => {
            addItem(sub.title, '#services-content', category.icon || 'briefcase', 'internal');
            sub.cards?.forEach(card => addItem(card.title, card.url, card.icon || 'link', 'external'));
        });
    });
    data.contacts?.forEach(contact => addItem(contact.name, '#contacts-content', 'contact', 'internal'));
    return items;
}

/**
 * Configura los eventos y la lógica para la barra de búsqueda.
 */
function setupSearch() {
    const searchInput = document.getElementById('app-search-input');
    const resultsContainer = document.getElementById('search-results');

    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length < 2) {
            resultsContainer.classList.remove('visible');
            return;
        }
        const filteredItems = searchableItems.filter(item => item.name.toLowerCase().includes(query));
        renderSearchResults(filteredItems);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) resultsContainer.classList.add('visible');
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) resultsContainer.classList.remove('visible');
    });
}

/**
 * Renderiza los resultados de la búsqueda en su contenedor.
 * @param {Array} items - Los items a mostrar.
 */
function renderSearchResults(items) {
    const resultsContainer = document.getElementById('search-results');
    if(!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (items.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results-message">No se encontraron resultados.</div>';
    } else {
        items.forEach(item => {
            const resultItem = document.createElement('a');
            resultItem.className = 'search-result-item';
            resultItem.href = item.url;
            resultItem.innerHTML = `<i data-lucide="${item.icon || 'link'}"></i><span>${item.name}</span>`;
            resultItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (item.url.startsWith('http')) {
                    window.open(item.url, '_blank');
                } else if (item.url.startsWith('#')) {
                    document.querySelector(`.nav-link[data-target='${item.url.substring(1)}']`)?.click();
                }
                document.getElementById('app-search-input').value = '';
                resultsContainer.classList.remove('visible');
            });
            resultsContainer.appendChild(resultItem);
        });
    }
    lucide.createIcons();
    resultsContainer.classList.add('visible');
}

/**
 * Extrae el color dominante de una imagen para usarlo en el tema.
 * @param {string} imageUrl - URL de la imagen de fondo.
 */
function updateThemeColor(imageUrl) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    const setDefaultColor = () => {
        document.documentElement.style.setProperty('--card-dominant-r', 35);
        document.documentElement.style.setProperty('--card-dominant-g', 35);
        document.documentElement.style.setProperty('--card-dominant-b', 45);
    };
    img.onload = () => {
        try {
            const colorThief = new ColorThief();
            const dominantColor = colorThief.getColor(img);
            document.documentElement.style.setProperty('--card-dominant-r', dominantColor[0]);
            document.documentElement.style.setProperty('--card-dominant-g', dominantColor[1]);
            document.documentElement.style.setProperty('--card-dominant-b', dominantColor[2]);
        } catch (e) {
            console.error("Error al obtener el color dominante:", e);
            setDefaultColor();
        }
    };
    img.onerror = setDefaultColor;
}

/**
 * Carga el fondo y tema personalizados guardados por el usuario.
 */
function loadCustomBackgroundAndTheme() {
    const customBg = localStorage.getItem('vitreumHubCustomBackground');
    if (customBg) {
        const screens = [
            document.getElementById('onboarding-screen'),
            document.getElementById('login-screen'),
            document.getElementById('setup-screen'),
            document.getElementById('app-wrapper'),
            document.getElementById('resume-screen')
        ];
        screens.forEach(screen => { if (screen) screen.style.backgroundImage = `url('${customBg}')`; });
        updateThemeColor(customBg);
    }
}

/**
 * Configura el input para cambiar la imagen de fondo.
 */
function setupBackgroundChanger() {
    const bgFileInput = document.getElementById('background-file-input');
    bgFileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newBgDataUrl = event.target?.result;
                if (typeof newBgDataUrl === 'string') {
                    localStorage.setItem('vitreumHubCustomBackground', newBgDataUrl);
                    loadCustomBackgroundAndTheme(); // Recargamos para aplicar en todas las pantallas
                }
            };
            reader.readAsDataURL(file);
        }
    });
}
