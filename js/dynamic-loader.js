/**
 * Dynamic Property Loader
 * Fetches properties from Google Sheets CMS and renders them across the site.
 */

let allProperties = [];

async function fetchProperties() {
    try {
        const cachedProps = sessionStorage.getItem('propera_properties_v3');
        if (cachedProps) {
            allProperties = JSON.parse(cachedProps);
            return allProperties;
        }

        const scriptUrl = typeof GOOGLE_APPS_SCRIPT_URL !== 'undefined' ? GOOGLE_APPS_SCRIPT_URL : "https://script.google.com/macros/s/AKfycbyZw_D87_-iHK-rPJrxoIORzlePkkTjqUUFNT38tlpI8lAVdcEZd-2AvjGgErz2slS_vg/exec";
        const url = scriptUrl + '?action=getProperties';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        let properties = await response.json();
        
        // --- CLIENT-SIDE HOTFIX ---
        // If the backend is running an older deployment, this will clean the data on the fly
        if (properties && properties.length > 0 && !properties.error) {
            properties = properties.map(prop => {
                // 1. Remove hardcoded 'Verified' badge from backend
                if (prop.badges) {
                    prop.badges = prop.badges.filter(b => b.toLowerCase() !== 'verified');
                } else {
                    prop.badges = [];
                }
                
                const isPremium = (prop.premium || prop.Premium || '').toString().toLowerCase() === 'yes';
                const isBudget = (prop.premium || prop.Premium || '').toString().toLowerCase() === 'no';
                const type = (prop.specs && prop.specs.type) ? prop.specs.type.toString().toLowerCase() : '';
                
                if (type.includes('plot')) {
                    if (!prop.badges.includes('Premium Plot')) prop.badges.unshift('Premium Plot');
                    if (!prop.badges.includes('Premium')) prop.badges.unshift('Premium');
                } else if (isPremium) {
                    if (!prop.badges.includes('Premium Property')) prop.badges.unshift('Premium Property');
                    if (!prop.badges.includes('Premium')) prop.badges.unshift('Premium');
                } else if (isBudget) {
                    if (!prop.badges.includes('Budget Friendly Home')) prop.badges.unshift('Budget Friendly Home');
                    if (!prop.badges.includes('Budget')) prop.badges.unshift('Budget');
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
            allProperties = properties;
            sessionStorage.setItem('propera_properties_v3', JSON.stringify(properties));
        }
        return properties;
    } catch (e) {
        console.error("Failed to fetch properties:", e);
        return [];
    }
}

// Generate HTML for a "Discovery Card" (Used on Homepage)
function createDiscoveryCardHTML(prop, hideBadge = false) {
    const defaultImg = "assets/Logo.jpeg"; // Fallback image
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" loading="lazy" class="carousel-slide">`).join('');
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
        <article class="discovery-card">
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
function createPropertyCardHTML(prop) {
    const defaultImg = "assets/Logo.jpeg"; // Fallback image
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" loading="lazy" class="carousel-slide">`).join('');
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
        <article class="property-card">
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
function createResultCardHTML(prop) {
    const defaultImg = "assets/Logo.jpeg";
    const images = prop.images && prop.images.length > 0 ? prop.images : [defaultImg];
    
    let carouselHTML = '';
    if (images.length > 1) {
        let slides = images.map(img => `<img src="${img}" alt="${prop.title}" loading="lazy" class="carousel-slide">`).join('');
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
    const badgesHTML = (prop.badges || []).map(b => 
        `<span class="badge badge-${b.toLowerCase().replace(' ', '-')}">${b}</span>`
    ).join('');

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
        <article class="result-card-hz">
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

// Initialization for Homepage
async function initHomepage() {
    const props = await fetchProperties();
    if (!props || props.length === 0) return;

    // Priority Premium Track
    const priorityTrack = document.getElementById('premium-track');
    if (priorityTrack) {
        const premiumProps = props.filter(p => p.badges && p.badges.includes('Premium'));
        priorityTrack.innerHTML = premiumProps.map(createPropertyCardHTML).join('');
    }

    // Premium Track
    const premiumTrack = document.getElementById('track-premium');
    if (premiumTrack) {
        const premiumProps = props.filter(p => p.badges && p.badges.includes('Premium'));
        premiumTrack.innerHTML = premiumProps.map(createDiscoveryCardHTML).join('');
    }

    // Buy Track
    const buyTrack = document.getElementById('track-buy');
    if (buyTrack) {
        const buyProps = props.filter(p => !((p.specs && p.specs.type) ? p.specs.type.toString().toLowerCase() : '').includes('plot'));
        buyTrack.innerHTML = buyProps.map(createDiscoveryCardHTML).join('');
    }

    // Budget Track
    const budgetTrack = document.getElementById('track-budget');
    if (budgetTrack) {
        const budgetProps = props.filter(p => {
            const isBudgetCol = (p.premium || p.Premium || '').toString().toLowerCase() === 'no';
            const type = (p.specs && p.specs.type) ? p.specs.type.toString().toLowerCase() : '';
            return isBudgetCol && !type.includes('plot');
        });
        budgetTrack.innerHTML = budgetProps.map(p => createDiscoveryCardHTML(p)).join('');
    }

    // Rent Track
    const rentTrack = document.getElementById('track-rent');
    if (rentTrack) {
        const rentProps = props.filter(p => !((p.specs && p.specs.type) ? p.specs.type.toString().toLowerCase() : '').includes('plot'));
        rentTrack.innerHTML = rentProps.map(createDiscoveryCardHTML).join('');
    }
    
    // Commercial Track
    const commercialTrack = document.getElementById('track-commercial');
    if (commercialTrack) {
        const commercialProps = props.filter(p => p.specs.type && p.specs.type.toLowerCase().includes('commercial'));
        commercialTrack.innerHTML = commercialProps.map(createDiscoveryCardHTML).join('');
    }
    
    // Plots Track
    const plotsTrack = document.getElementById('track-plots');
    if (plotsTrack) {
        const plotsProps = props.filter(p => p.specs.type && p.specs.type.toLowerCase().includes('plot'));
        plotsTrack.innerHTML = plotsProps.map(createDiscoveryCardHTML).join('');
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
    
    resultsContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">Loading properties...</div>';

    const props = await fetchProperties();
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
        resultsContainer.innerHTML = filteredProps.map(createResultCardHTML).join('');
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

document.addEventListener('click', function(e) {
    if (e.target.closest('.carousel-prev') || e.target.closest('.carousel-next')) {
        const btn = e.target.closest('button');
        const carousel = btn.closest('.card-carousel');
        const track = carousel.querySelector('.card-carousel-track');
        if (!track) return;
        
        pauseCarousel(track);
        
        const direction = btn.classList.contains('carousel-next') ? 1 : -1;
        const maxScrollLeft = track.scrollWidth - track.clientWidth;
        let nextScroll = track.scrollLeft + (track.clientWidth * direction);
        
        if (nextScroll < 0) nextScroll = maxScrollLeft;
        else if (nextScroll > maxScrollLeft + 10) nextScroll = 0;
        
        track.scrollTo({ left: nextScroll, behavior: 'smooth' });
    }
});

document.addEventListener('scroll', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('card-carousel-track')) {
        const track = e.target;
        const index = Math.round(track.scrollLeft / track.clientWidth);
        const dots = track.parentElement.querySelectorAll('.carousel-dot');
        if (dots && dots.length > index) {
            dots.forEach(d => d.classList.remove('active'));
            dots[index].classList.add('active');
        }
    }
}, true);

// Pause on touch interaction (swipe)
document.addEventListener('touchstart', function(e) {
    const track = e.target.closest('.card-carousel-track');
    if (track) pauseCarousel(track);
}, {passive: true});

// Auto-scroll interval (every 2 seconds)
setInterval(() => {
    const tracks = document.querySelectorAll('.card-carousel-track');
    const now = Date.now();
    tracks.forEach(track => {
        // Only scroll if there's more than 1 image
        if (track.children.length > 1) {
            const pausedUntil = window.carouselPauseStates.get(track) || 0;
            if (now > pausedUntil) {
                const maxScrollLeft = track.scrollWidth - track.clientWidth;
                let nextScroll = track.scrollLeft + track.clientWidth;
                
                // loop back
                if (nextScroll > maxScrollLeft + 10) {
                    nextScroll = 0;
                }
                
                track.scrollTo({ left: nextScroll, behavior: 'smooth' });
            }
        }
    });
}, 2000);
