/**
 * Dynamic Property Loader
 * Fetches properties from Google Sheets CMS and renders them across the site.
 */

let allProperties = [];
let fetchPromise = null;

// If user does a hard refresh (F5/Reload), clear the cache so they get the absolute newest data
try {
    const navEntries = performance.getEntriesByType("navigation");
    if ((navEntries.length > 0 && navEntries[0].type === "reload") || 
        (window.performance && window.performance.navigation && window.performance.navigation.type === 1)) {
        sessionStorage.removeItem('propera_data_v5');
    }
} catch (e) {}

async function fetchProperties(forceFresh = false) {
    // 1. Memory cache (for multiple calls on same page)
    if (allProperties.length > 0 && !forceFresh) return allProperties;
    
    // 2. Session cache (lightning fast navigation)
    if (!forceFresh) {
        const cachedProps = sessionStorage.getItem('propera_data_v5');
        if (cachedProps) {
            allProperties = JSON.parse(cachedProps);
            
            // Stale-while-revalidate: Fetch fresh data in the background
            // so the NEXT page load is updated without penalizing this one.
            setTimeout(fetchFreshData, 100);
            return allProperties;
        }
    }
    
    // 3. Network fetch
    return await fetchFreshData();
}

async function fetchFreshData() {
    if (fetchPromise) return fetchPromise;
    
    fetchPromise = (async () => {
        try {
            const scriptUrl = typeof GOOGLE_APPS_SCRIPT_URL !== 'undefined' ? GOOGLE_APPS_SCRIPT_URL : "https://script.google.com/macros/s/AKfycbxkBu-BIS1bzOKV-lDDeZNtXm3B8wfHHUNzgw6LJ-8QoyttAckjs2-mDYyz5zGOMKFDgQ/exec";
            const url = scriptUrl + '?action=getProperties&t=' + Date.now();
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            let properties = await response.json();
            
            if (properties && properties.length > 0 && !properties.error) {
                properties = properties.map(prop => {
                    // 1. Remove hardcoded 'Verified' badge from backend
                    if (prop.badges) {
                        prop.badges = prop.badges.filter(b => b.toLowerCase() !== 'verified');
                    } else {
                        prop.badges = [];
                    }
                    
                    const isPremium = prop.badges && prop.badges.includes('Premium');
                    const isBudget = !isPremium;
                    const type = (prop.specs && prop.specs.type) ? prop.specs.type.toString().toLowerCase() : '';
                    
                    if (type.includes('plot')) {
                        if (!prop.badges.includes('Plots')) prop.badges.unshift('Plots');
                    } else if (type.includes('commercial')) {
                        if (!prop.badges.includes('Commercial Space')) prop.badges.unshift('Commercial Space');
                    } else if (isPremium) {
                        if (!prop.badges.includes('Premium Flat')) prop.badges.unshift('Premium Flat');
                    } else if (isBudget) {
                        if (!prop.badges.includes('Budget Flat')) prop.badges.unshift('Budget Flat');
                    }
                    
                    // 2. Rewrite old Google Drive image URLs to the working lh3 API
                    if (prop.images) {
                        prop.images = prop.images.map(url => {
                            const match = url.match(/id=([a-zA-Z0-9_-]+)/);
                            if (match && url.includes('drive.google.com')) {
                                return `https://lh3.googleusercontent.com/d/${match[1]}`;
                            }
                            return url;
                        });
                    }
                    // 3. Replace <> with - across all string fields
                    const sanitize = (obj) => {
                        for (let key in obj) {
                            if (typeof obj[key] === 'string') {
                                obj[key] = obj[key].replace(/<>/g, '-');
                            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                sanitize(obj[key]);
                            }
                        }
                    };
                    sanitize(prop);

                    return prop;
                });
                
                // If data actually changed from memory, we could trigger a re-render here
                const dataChanged = JSON.stringify(properties) !== JSON.stringify(allProperties);
                allProperties = properties;
                sessionStorage.setItem('propera_data_v5', JSON.stringify(properties));
                
                // If data changed in the background, automatically update the UI!
                if (dataChanged && document.readyState === 'complete') {
                    if (document.getElementById('track-premium') || document.getElementById('track-buy')) initHomepage();
                    if (document.getElementById('dynamic-search-results')) initSearchPage();
                }
            }
            return properties;
        } catch (e) {
            console.error("Failed to fetch properties:", e);
            return [];
        } finally {
            fetchPromise = null;
        }
    })();
    
    return fetchPromise;
}

// Generate HTML for a "Discovery Card" (Used on Homepage)
function createDiscoveryCardHTML(prop, index = 0, hideBadge = false) {
    const defaultImg = "assets/Logo.jpeg"; // Fallback image
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" class="carousel-slide">`).join('');
        carouselHTML = `
            <div class="card-carousel" style="width: 100%; height: 100%;">
                <div class="card-carousel-track">
                    ${slides}
                </div>
                <button class="carousel-prev" aria-label="Previous image">‹</button>
                <button class="carousel-next" aria-label="Next image">›</button>
                <div class="carousel-dots">
                    ${images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
    } else {
        carouselHTML = `<img src="${images[0]}" loading="lazy" alt="${prop.title}" class="card-image" style="object-fit: cover; height: 100%; width: 100%;">`;
    }
    
    let badgeWrapper = '';
    if (!hideBadge) {
        const badgeHTML = prop.badges && prop.badges.length > 0 
            ? `<span class="badge badge-${prop.badges[0].toLowerCase().replace(' ', '-')}">${prop.badges[0]}</span>`
            : `<span class="badge badge-verified">Verified</span>`;
        badgeWrapper = `<div class="card-badges" style="z-index: 10;">${badgeHTML}</div>`;
    }
        
    const propertySlug = prop.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return `
        <article class="discovery-card animate-card" style="animation-delay: ${Math.min(index * 0.08, 0.8)}s">
          <div class="card-image-wrapper">
            ${badgeWrapper}
            ${carouselHTML}
          </div>
          <div class="card-content">
            <div class="property-meta">${prop.specs.configuration || ''} ${prop.specs.type || ''}</div>
            <h3 class="property-name text-h5">${prop.title}</h3>
            <p class="property-location text-muted">${prop.location}</p>
            <div class="property-price">${prop.priceRange || 'Price on Request'}</div>
            <div class="card-actions">
              <a href="property-detail.html?propertyname=${propertySlug}" class="btn btn-primary flex-1 btn-small" style="text-decoration:none;">Explore</a>
            </div>
          </div>
        </article>
    `;
}

// Generate HTML for a "Property Card" (Used on Priority Premium Homepage)
function createPropertyCardHTML(prop, index = 0) {
    const defaultImg = "assets/Logo.jpeg"; // Fallback image
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" class="carousel-slide">`).join('');
        carouselHTML = `
            <div class="card-carousel" style="width: 100%; height: 100%;">
                <div class="card-carousel-track">
                    ${slides}
                </div>
                <button class="carousel-prev" aria-label="Previous image">‹</button>
                <button class="carousel-next" aria-label="Next image">›</button>
                <div class="carousel-dots">
                    ${images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
    } else {
        carouselHTML = `<img src="${images[0]}" loading="lazy" alt="${prop.title}" class="card-image" style="object-fit: cover; height: 100%; width: 100%;">`;
    }

    const badgeHTML = prop.badges && prop.badges.length > 0 
        ? `<span class="badge badge-${prop.badges[0].toLowerCase().replace(' ', '-')}">${prop.badges[0]}</span>`
        : `<span class="badge badge-verified">Verified</span>`;
        
    const propertySlug = prop.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return `
        <article class="property-card animate-card" style="animation-delay: ${Math.min(index * 0.08, 0.8)}s">
          <div class="card-image-wrapper">
            <div class="card-badges" style="z-index: 10;">
              ${badgeHTML}
            </div>
            ${carouselHTML}
          </div>
          <div class="card-content">
            <div class="property-meta">
              <span class="property-type">${prop.specs.configuration || ''} ${prop.specs.type || ''}</span>
              <span class="property-status">${prop.specs.status || ''}</span>
            </div>
            <h3 class="property-name text-h4">${prop.title}</h3>
            <p class="property-location text-muted">${prop.location}</p>
            <div class="property-price-row">
              <span class="property-price text-h4">${prop.priceRange || 'Price on Request'}</span>
            </div>
            <div class="card-actions" style="display: flex; gap: 0.5rem;">
              <a href="property-detail.html?propertyname=${propertySlug}" class="btn btn-primary flex-1" style="text-decoration:none;">View Details</a>
              <a href="about-contact.html#contact" class="btn btn-outline" style="text-decoration:none; padding: 0.5rem 1rem;">Contact</a>
            </div>
          </div>
        </article>
    `;
}

// Generate HTML for a "Result Card" (Used on Search Pages)
function createResultCardHTML(prop, index = 0) {
    const defaultImg = "assets/Logo.jpeg";
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" class="carousel-slide">`).join('');
        carouselHTML = `
            <div class="card-carousel">
                <div class="card-carousel-track">
                    ${slides}
                </div>
                <button class="carousel-prev" aria-label="Previous image">‹</button>
                <button class="carousel-next" aria-label="Next image">›</button>
                <div class="carousel-dots">
                    ${images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
                </div>
            </div>
        `;
    } else {
        carouselHTML = `<img src="${images[0]}" alt="${prop.title}" loading="lazy" style="width:100%; height:auto; aspect-ratio:16/10; object-fit:cover;">`;
    }
    
    // Convert badges to HTML
    const badgesHTML = (prop.badges || [])
        .filter(b => b !== 'Premium')
        .map(b => `<span class="badge badge-${b.toLowerCase().replace(' ', '-')}">${b}</span>`)
        .join('');

    let formattedPossession = prop.specs.possession || 'N/A';
    if (formattedPossession && formattedPossession.includes('GMT')) {
        try {
            const d = new Date(formattedPossession);
            if (!isNaN(d)) {
                formattedPossession = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            }
        } catch (e) {}
    }

    const propertySlug = prop.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    return `
        <article class="result-card-hz animate-card" style="animation-delay: ${Math.min(index * 0.08, 0.8)}s">
            <div class="result-card-image">
                <div class="result-badges" style="z-index: 10;">
                    ${badgesHTML}
                </div>
                ${carouselHTML}
            </div>
            <div class="result-card-content">
                <div class="result-card-header">
                    <div>
                        <h3 class="result-title">${prop.title}</h3>
                        ${prop.builder ? `<div class="result-builder">by ${prop.builder}</div>` : ''}
                        <div class="result-location">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span class="location-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prop.location}</span>
                        </div>
                    </div>
                    <div class="result-price">${prop.priceRange || 'Price on Request'}</div>
                </div>

                <div class="result-specs">
                    <div class="spec-item">
                        <span class="spec-label">Type</span>
                        <span class="spec-val">${prop.specs.type || 'N/A'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Config</span>
                        <span class="spec-val">${prop.specs.configuration || 'N/A'}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Possession</span>
                        <span class="spec-val">${formattedPossession}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Status</span>
                        <span class="spec-val">${prop.specs.status || 'N/A'}</span>
                    </div>
                </div>

                <div class="result-card-footer">
                    <div class="result-amenities">
                        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin:0;">${(prop.description && prop.description.length > 0) ? prop.description[0].substring(0, 80) + '...' : ''}</p>
                    </div>
                    <div class="card-actions">
                        <a href="property-detail.html?propertyname=${propertySlug}" class="btn btn-outline" style="text-decoration: none;">View Details</a>
                        <a href="about-contact.html#contact" class="btn btn-solid" style="text-decoration: none;">Contact Expert</a>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function showLoaders() {
    if (!document.getElementById('pro-loader-styles')) {
        const style = document.createElement('style');
        style.id = 'pro-loader-styles';
        style.textContent = `
            .pro-loader-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; width: 100%; min-height: 420px; gap: 15px; }
            .pro-spinner { width: 40px; height: 40px; border: 4px solid rgba(0, 0, 0, 0.1); border-left-color: var(--color-1, #0f172a); border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .pro-loader-text { font-size: 0.95rem; font-weight: 600; color: var(--color-2, #334155); font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.5px; }
            .pro-progress { color: var(--color-3, #2B5C8F); font-weight: 700; }
            
            @keyframes cardFadeInUp {
                from { opacity: 0; transform: translateY(40px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-card {
                animation: cardFadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                opacity: 0;
            }
        `;
        document.head.appendChild(style);
    }

    const loaderHTML = `
        <div class="pro-loader-container">
            <div class="pro-spinner"></div>
            <div class="pro-loader-text">Loading Properties... <span class="pro-progress">0%</span></div>
        </div>
    `;
    const tracks = ['premium-track', 'track-premium', 'track-buy', 'track-budget', 'track-rent', 'track-plots', 'track-commercial', 'dynamic-search-results'];
    tracks.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = loaderHTML;
    });

    if (window.proLoaderInterval) clearInterval(window.proLoaderInterval);
    let progress = 0; // use float for smooth slowdowns
    window.proLoaderInterval = setInterval(() => {
        let increment;
        if (progress < 40) {
            increment = Math.random() * 20 + 15; // 15-35
        } else if (progress < 75) {
            increment = Math.random() * 10 + 5;  // 5-15
        } else if (progress < 88) {
            increment = Math.random() * 3 + 1;   // 1-4
        } else if (progress < 95) {
            increment = Math.random() * 0.8 + 0.2; // 0.2-1.0
        } else if (progress < 98) {
            increment = Math.random() * 0.3 + 0.05; // 0.05-0.35
        } else {
            increment = Math.random() * 0.05;      // almost stopped, creeping to 99
        }
        
        progress += increment;
        if (progress > 99.9) progress = 99.9;
        
        let displayProgress = Math.floor(progress);
        document.querySelectorAll('.pro-progress').forEach(el => el.innerText = displayProgress + '%');
    }, 100);
}

function clearLoaders() {
    if (window.proLoaderInterval) clearInterval(window.proLoaderInterval);
    document.querySelectorAll('.pro-progress').forEach(el => el.innerText = '100%');
}

function fastForwardLoadersTo99() {
    return new Promise(resolve => {
        if (!window.proLoaderInterval) { resolve(); return; }
        clearInterval(window.proLoaderInterval);
        
        let progress = parseFloat(document.querySelector('.pro-progress')?.innerText || "0");
        let fastInterval = setInterval(() => {
            if (progress >= 99) {
                clearInterval(fastInterval);
                window.proLoaderInterval = null; // Prevent re-clearing
                resolve();
            } else {
                let diff = 99 - progress;
                let inc = Math.max(1, Math.floor(diff / 2));
                progress += inc;
                if (progress > 99) progress = 99;
                document.querySelectorAll('.pro-progress').forEach(el => el.innerText = Math.floor(progress) + '%');
            }
        }, 30);
    });
}

// Initialization for Homepage
async function initHomepage() {
    let loadersShown = false;
    if (allProperties.length === 0 && !sessionStorage.getItem('propera_data_v5')) {
        showLoaders();
        loadersShown = true;
    }
    const props = await fetchProperties();
    if (loadersShown) await fastForwardLoadersTo99();
    clearLoaders();
    if (!props || props.length === 0) return;

    // Priority Premium Track
    const priorityTrack = document.getElementById('premium-track');
    if (priorityTrack) {
        const premiumProps = props.filter(p => p.badges && p.badges.includes('Premium'));
        priorityTrack.innerHTML = premiumProps.map((p, i) => createPropertyCardHTML(p, i)).join('');
    }

    // Premium Track
    const premiumTrack = document.getElementById('track-premium');
    if (premiumTrack) {
        const premiumProps = props.filter(p => p.badges && p.badges.includes('Premium'));
        premiumTrack.innerHTML = premiumProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
    }

    // Buy Track
    const buyTrack = document.getElementById('track-buy');
    if (buyTrack) {
        const buyProps = props.filter(p => {
            const intent = (p.specs && p.specs.intent) ? p.specs.intent.toString().toLowerCase() : '';
            const type = (p.specs && p.specs.type) ? p.specs.type.toString().toLowerCase() : '';
            return intent !== 'rent' && !type.includes('plot');
        });
        if (buyProps.length > 0) {
            buyTrack.innerHTML = buyProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
        } else {
            buyTrack.innerHTML = '<div style="padding: 20px;">No Buy properties found.</div>';
        }
    }

    // Budget Track
    const budgetTrack = document.getElementById('track-budget');
    if (budgetTrack) {
        const budgetProps = props.filter(p => p.badges && p.badges.includes('Budget Flat'));
        if (budgetProps.length > 0) {
            budgetTrack.innerHTML = budgetProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
        } else {
            budgetTrack.innerHTML = '<div style="padding: 20px;">No Budget properties found.</div>';
        }
    }

    // Rent Track
    const rentTrack = document.getElementById('track-rent');
    if (rentTrack) {
        const rentProps = props.filter(p => {
            const intent = (p.specs && p.specs.intent) ? p.specs.intent.toString().toLowerCase() : '';
            return intent === 'rent';
        });
        if (rentProps.length > 0) {
            rentTrack.innerHTML = rentProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
        } else {
            rentTrack.innerHTML = '<div style="padding: 20px;">No Rental properties found.</div>';
        }
    }
    
    // Commercial Track
    const commercialTrack = document.getElementById('track-commercial');
    if (commercialTrack) {
        const commercialProps = props.filter(p => p.specs.type && p.specs.type.toLowerCase().includes('commercial'));
        commercialTrack.innerHTML = commercialProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
    }
    
    // Plots Track
    const plotsTrack = document.getElementById('track-plots');
    if (plotsTrack) {
        const plotsProps = props.filter(p => p.specs.type && p.specs.type.toLowerCase().includes('plot'));
        plotsTrack.innerHTML = plotsProps.map((p, i) => createDiscoveryCardHTML(p, i)).join('');
    }
    
    // Update Hero Slider dynamically with Premium Properties
    const heroSlider = document.getElementById('hero-img-carousel');
    if (heroSlider) {
        const premiumForHero = props.filter(p => p.badges && p.badges.includes('Premium')).slice(0, 5);
        const heroProps = premiumForHero.length > 0 ? premiumForHero : props.slice(0, 5);
        
        const heroImages = heroProps.map((p, i) => {
            const img = p.images && p.images.length > 0 ? p.images[0] : 'assets/Logo.jpeg';
            return `<img src="${img}" class="hero-img-slide ${i === 0 ? 'active' : ''}" alt="${p.title}" style="object-fit: cover; width: 100%; height: 100%; position: absolute; top: 0; left: 0;">`;
        }).join('');
        heroSlider.innerHTML = heroImages;
        
        // Re-init slider
        const slides = document.querySelectorAll('.hero-img-slide');
        if (slides.length > 0) {
            let currentSlide = 0;
            setInterval(() => {
              slides.forEach(s => s.classList.remove('active'));
              currentSlide = (currentSlide + 1) % slides.length;
              slides[currentSlide].classList.add('active');
            }, 6000); // 6s interval
        }
    }
}

// Initialization for Search Pages
async function initSearchPage() {
    const resultsContainer = document.getElementById('dynamic-search-results');
    if (!resultsContainer) return;
    
    let loadersShown = false;
    if (allProperties.length === 0 && !sessionStorage.getItem('propera_data_v5')) {
        showLoaders();
        loadersShown = true;
    }

    const props = await fetchProperties();
    if (loadersShown) await fastForwardLoadersTo99();
    clearLoaders();
    if (!props || props.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">No properties found.</div>';
        return;
    }

    // Very basic filtering based on URL parameters (can be expanded)
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('q') ? params.get('q').toLowerCase() : '';
    
    let filteredProps = props;
    
    if (searchQuery) {
        filteredProps = filteredProps.filter(p => 
            p.title.toLowerCase().includes(searchQuery) || 
            p.location.toLowerCase().includes(searchQuery) ||
            (p.builder && p.builder.toLowerCase().includes(searchQuery))
        );
    }
    
    // Render
    if (filteredProps.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">No matching properties found.</div>';
    } else {
        resultsContainer.innerHTML = filteredProps.map((p, i) => createResultCardHTML(p, i)).join('');
    }
    
    const countElement = document.getElementById('result-count');
    if (countElement) {
        countElement.textContent = filteredProps.length;
    }
}

// Auto-run depending on page
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('track-premium') || document.getElementById('track-buy') || document.getElementById('premium-track')) {
        initHomepage();
    }
    if (document.getElementById('dynamic-search-results')) {
        initSearchPage();
    }
});

// ==========================================
// Result Card Carousel Logic
// ==========================================

// Global object to track paused state
window.carouselPauseStates = window.carouselPauseStates || new WeakMap();

function pauseCarousel(track) {
    if (!track) return;
    // Pause for 5 seconds
    window.carouselPauseStates.set(track, Date.now() + 5000);
}

function updateCarouselDots(carousel, index) {
    const dots = carousel.querySelectorAll('.carousel-dot');
    if (dots && dots.length > index) {
        dots.forEach(d => d.classList.remove('active'));
        dots[index].classList.add('active');
    }
}

document.addEventListener('click', function(e) {
    if (e.target.closest('.carousel-prev') || e.target.closest('.carousel-next')) {
        const btn = e.target.closest('button');
        const carousel = btn.closest('.card-carousel');
        const track = carousel.querySelector('.card-carousel-track');
        if (!track) return;
        
        pauseCarousel(track);
        
        const direction = btn.classList.contains('carousel-next') ? 1 : -1;
        const totalSlides = track.children.length;
        let index = parseInt(carousel.dataset.index || 0) + direction;
        
        if (index < 0) index = totalSlides - 1;
        else if (index >= totalSlides) index = 0;
        
        carousel.dataset.index = index;
        track.style.transform = `translateX(-${index * 100}%)`;
        updateCarouselDots(carousel, index);
    }
});

window.hoverIntervals = new Map();
window.hoverTimeouts = new Map();

document.addEventListener('mouseover', function(e) {
    const card = e.target && e.target.closest ? e.target.closest('.discovery-card, .property-card, .result-card-hz') : null;
    if (card && !card.dataset.isHovered) {
        card.dataset.isHovered = 'true';
        const carousel = card.querySelector('.card-carousel');
        if (carousel) {
            const track = carousel.querySelector('.card-carousel-track');
            if (track && track.children.length > 1) {
                const totalSlides = track.children.length;
                
                // Wait 1 second before first slide
                const timeoutId = setTimeout(() => {
                    let index = parseInt(carousel.dataset.index || 0) + 1;
                    if (index >= totalSlides) index = 0;
                    carousel.dataset.index = index;
                    track.style.transform = `translateX(-${index * 100}%)`;
                    updateCarouselDots(carousel, index);
                    
                    const intervalId = setInterval(() => {
                        let idx = parseInt(carousel.dataset.index || 0) + 1;
                        if (idx >= totalSlides) idx = 0;
                        carousel.dataset.index = idx;
                        track.style.transform = `translateX(-${idx * 100}%)`;
                        updateCarouselDots(carousel, idx);
                    }, 2000);
                    window.hoverIntervals.set(card, intervalId);
                }, 1000);
                window.hoverTimeouts.set(card, timeoutId);
            }
        }
    }
});

document.addEventListener('mouseout', function(e) {
    const card = e.target && e.target.closest ? e.target.closest('.discovery-card, .property-card, .result-card-hz') : null;
    if (card) {
        if (!e.relatedTarget || !card.contains(e.relatedTarget)) {
            card.dataset.isHovered = '';
            
            if (window.hoverTimeouts.has(card)) {
                clearTimeout(window.hoverTimeouts.get(card));
                window.hoverTimeouts.delete(card);
            }
            if (window.hoverIntervals.has(card)) {
                clearInterval(window.hoverIntervals.get(card));
                window.hoverIntervals.delete(card);
            }
            
            const carousel = card.querySelector('.card-carousel');
            if (carousel) {
                const track = carousel.querySelector('.card-carousel-track');
                if (track) {
                    // Slide back to main image with guaranteed animation
                    carousel.dataset.index = 0;
                    track.style.transform = `translateX(0%)`;
                    updateCarouselDots(carousel, 0);
                }
            }
        }
    }
});
