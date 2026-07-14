let currentPropertyImages = [];
let currentLightboxIndex = 0;
let currentPropertyLocation = '';

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const propertySlug = params.get('propertyname') || params.get('property');
    const propertyId = params.get('id'); // Fallback

    if (!propertySlug && !propertyId) {
        displayError("Property reference is missing from the URL.");
        return;
    }

    try {
        let properties = null;
        const cachedProps = sessionStorage.getItem('propera_properties_v3');
        
        if (cachedProps) {
            properties = JSON.parse(cachedProps);
        } else {
            // Using GOOGLE_APPS_SCRIPT_URL defined in js/form-handler.js
            // Fallback to local json if undefined
            const url = typeof GOOGLE_APPS_SCRIPT_URL !== 'undefined' ? GOOGLE_APPS_SCRIPT_URL + '?action=getProperties' : 'js/data/properties.json';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            properties = await response.json();
            
            // Sanitize properties directly
            if (properties && properties.length > 0 && !properties.error) {
                properties = properties.map(prop => {
                    if (prop.badges) {
                        prop.badges = prop.badges.filter(b => b.toLowerCase() !== 'verified');
                    } else {
                        prop.badges = [];
                    }
                    
                    const isPremium = (prop.premium || prop.Premium || '').toString().toLowerCase() === 'yes';
                    const isBudget = (prop.premium || prop.Premium || '').toString().toLowerCase() === 'no';
                    
                    if (isPremium) {
                        if (!prop.badges.includes('Premium Property')) prop.badges.unshift('Premium Property');
                        if (!prop.badges.includes('Premium')) prop.badges.unshift('Premium');
                    } else if (isBudget) {
                        if (!prop.badges.includes('Budget Friendly Home')) prop.badges.unshift('Budget Friendly Home');
                    }

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
                
                sessionStorage.setItem('propera_properties_v3', JSON.stringify(properties));
            }
        }
        
        // Find property by slug, fallback to ID
        const property = properties.find(p => {
            if (propertySlug) {
                const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                return slug === propertySlug || p.id === propertySlug;
            }
            return p.id === propertyId;
        });
        
        if (property) {
            renderProperty(property);
        } else {
            displayError("Property not found.");
        }
    } catch (error) {
        console.error("Failed to load properties:", error);
        displayError("Failed to load property details. Please try again later.");
    }
});

function displayError(message) {
    const container = document.querySelector('.property-content');
    if (container) {
        container.innerHTML = `<div style="padding: 100px 20px; text-align: center; width: 100%;">
            <h1 class="text-h2" style="margin-bottom:1rem">${message}</h1>
            <a href="search.html" class="btn btn-primary" style="display: inline-block;">Back to Search</a>
        </div>`;
    }
}

function updateDynamicSEO(data) {
    const title = `${data.title} - Property Details | Propera India`;
    const desc = (data.description && data.description.length > 0) ? data.description[0].substring(0, 160) : `View details for ${data.title} located in ${data.location}.`;
    const imgUrl = (data.images && data.images.length > 0) ? data.images[0] : 'https://properaindia.com/assets/Logo.jpeg';
    const url = window.location.href;

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);

    const ogTags = {
        'og:title': title,
        'og:description': desc,
        'og:image': imgUrl,
        'og:url': url,
        'og:type': 'website'
    };

    for (const [property, content] of Object.entries(ogTags)) {
        let metaTag = document.querySelector(`meta[property="${property}"]`);
        if (metaTag) {
            metaTag.setAttribute('content', content);
        } else {
            metaTag = document.createElement('meta');
            metaTag.setAttribute('property', property);
            metaTag.setAttribute('content', content);
            document.head.appendChild(metaTag);
        }
    }
}

function renderProperty(data) {
    // 1. Update SEO, Title and Headers
    updateDynamicSEO(data);
    
    const titleEl = document.querySelector('.prop-title');
    if (titleEl) titleEl.textContent = data.title;
    
    // Set the hidden input in the Site Visit modal
    const visitPropInput = document.getElementById('visit-property-name');
    if (visitPropInput) visitPropInput.value = data.title;
    
    currentPropertyLocation = data.location;
    
    const subtitleEl = document.querySelector('.prop-subtitle');
    if (subtitleEl) subtitleEl.innerHTML = `by ${data.builder} &bull; ${data.location}`;
    
    const priceEl = document.querySelector('.prop-price');
    if (priceEl) priceEl.textContent = data.priceRange;

    // Helper to ensure array
    const ensureArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
        return [val];
    };

    // Helper to fix Google Drive image URLs so they can be embedded in <img> tags
    const fixImageUrl = (url) => {
        if (!url) return '';
        const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && url.includes('drive.google.com')) {
            return `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
        return url;
    };

    const badges = ensureArray(data.badges);
    const urgency = ensureArray(data.urgency);
    
    // Combine standard images array with raw Google Sheet columns if they exist
    let rawImages = ensureArray(data.images);
    if (data['main image'] || data.mainImage) rawImages.unshift(data['main image'] || data.mainImage);
    if (data.gallery) {
        rawImages = rawImages.concat(ensureArray(data.gallery));
    }
    // Deduplicate and fix URLs
    const images = [...new Set(rawImages)].map(fixImageUrl).filter(Boolean);
    
    const description = ensureArray(data.description);

    // 2. Update Badges (Removed per user request to keep gallery clean)
    const badgeContainer = document.querySelector('.badge-container');
    if (badgeContainer) {
        badgeContainer.innerHTML = '';
    }

    // 3. Update Urgency List
    const urgencyList = document.querySelector('.urgency-list');
    if (urgencyList) {
        urgencyList.innerHTML = urgency.map(u => `<li>${u}</li>`).join('');
    }

    // 4. Update Images
    currentPropertyImages = images;
    
    const mainImg = document.getElementById('main-prop-image');
    if (mainImg && images.length > 0) {
        mainImg.src = images[0].replace('&w=300', '&w=1200');
        // Update onclick to use lightbox index
        mainImg.onclick = () => openLightbox(currentLightboxIndex);
    }
    
    const thumbnailGallery = document.querySelector('.thumbnail-gallery');
    if (thumbnailGallery && images.length > 0) {
        thumbnailGallery.innerHTML = images.map((imgUrl, index) => {
            const thumbUrl = imgUrl.includes('&w=') ? imgUrl.replace(/&w=\d+/, '&w=300') : imgUrl;
            // Overriding inline switchImage to also update the currentLightboxIndex
            return `<img src="${thumbUrl}" alt="Thumb ${index+1}" class="thumb ${index === 0 ? 'active' : ''}" onclick="updateMainImage(this, ${index})" loading="${index === 0 ? 'eager' : 'lazy'}">`;
        }).join('');
    }

    // 5. Update Quick Facts
    const quickFactsContainer = document.querySelector('.quick-facts');
    if (quickFactsContainer) {
        quickFactsContainer.innerHTML = `
            <div class="quick-fact"><span class="spec-label">Type</span><span class="spec-value">${data.specs.type}</span></div>
            <div class="quick-fact"><span class="spec-label">Size</span><span class="spec-value">${data.specs.size}</span></div>
            <div class="quick-fact"><span class="spec-label">Possession</span><span class="spec-value">${data.specs.possession}</span></div>
            <div class="quick-fact"><span class="spec-label">Configuration</span><span class="spec-value">${data.specs.configuration}</span></div>
        `;
    }

    // 6. Update Specs Grid
    const specsGrid = document.querySelector('.prop-specs-grid');
    if (specsGrid) {
        specsGrid.innerHTML = `
            <div class="spec-item"><span class="spec-label">Configuration</span><span class="spec-value">${data.specs.configuration}</span></div>
            <div class="spec-item"><span class="spec-label">Size</span><span class="spec-value">${data.specs.size}</span></div>
            <div class="spec-item"><span class="spec-label">Status</span><span class="spec-value">${data.specs.status}</span></div>
            <div class="spec-item"><span class="spec-label">Possession</span><span class="spec-value">${data.specs.possession}</span></div>
            <div class="spec-item"><span class="spec-label">Property Type</span><span class="spec-value">${data.specs.type}</span></div>
        `;
    }

    // 7. Update Description
    const descContainer = document.querySelector('.content-text');
    if (descContainer) {
        // Format the text info details that's pulled from sheets in a design way
        descContainer.innerHTML = description.map(para => `<p style="line-height: 1.8; color: var(--color-text-muted); margin-bottom: 1rem; font-size: 1.05rem;">${para}</p>`).join('');
    }

    // 8. Update Amenities
    const amenities = ensureArray(data.amenities);
    const amenitiesChips = document.querySelector('.amenity-snapshot');
    if (amenitiesChips) {
        amenitiesChips.innerHTML = amenities.map(a => {
            const name = typeof a === 'string' ? a : (a.name || '');
            return `<span class="amenity-chip">${name.split(' ')[0]}</span>`;
        }).join('');
    }
    
    const amenitiesGrid = document.querySelector('.amenities-grid');
    if (amenitiesGrid) {
        amenitiesGrid.innerHTML = amenities.map(a => {
            const name = typeof a === 'string' ? a : (a.name || '');
            const icon = typeof a === 'object' && a.icon ? a.icon : '<svg class="amenity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
            return `
            <div class="amenity-item">
                ${icon}
                <span>${name}</span>
            </div>
        `;
        }).join('');
    }

    // 9. Update Highlights
    const highlights = ensureArray(data.highlights);
    const highlightsGrid = document.querySelector('.highlights-grid');
    if (highlightsGrid) {
        highlightsGrid.innerHTML = highlights.map(h => {
            const title = typeof h === 'string' ? h : (h.title || '');
            const desc = typeof h === 'object' && h.desc ? h.desc : '';
            return `
            <div class="highlight-card">
                <strong>${title}</strong>
                <p class="text-body-sm text-muted">${desc}</p>
            </div>
        `;
        }).join('');
    }

    // 10. Update Landmarks
    const landmarks = ensureArray(data.landmarks);
    const landmarksGrid = document.querySelector('.landmarks-grid');
    if (landmarksGrid) {
        landmarksGrid.innerHTML = landmarks.map(l => {
            const label = typeof l === 'string' ? l : (l.label || '');
            const val = typeof l === 'object' && l.value ? l.value : '';
            return `
            <div class="landmark-card">
                <span class="landmark-label">${label}</span>
                <span class="landmark-value">${val}</span>
            </div>
        `;
        }).join('');
    }
}

// Global functions for new gallery/lightbox
window.updateMainImage = function(thumbnail, index) {
    currentLightboxIndex = index;
    const mainImg = document.getElementById('main-prop-image');
    if (mainImg) {
        mainImg.src = thumbnail.src.replace('&w=300', '&w=1200');
    }
    document.querySelectorAll('.thumbnail-gallery .thumb').forEach(th => th.classList.remove('active'));
    thumbnail.classList.add('active');
};

window.openLightbox = function(index) {
    if (!currentPropertyImages.length) return;
    currentLightboxIndex = index;
    const lightbox = document.getElementById('gallery-lightbox');
    if (lightbox) {
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateLightboxView();
    }
};

window.closeLightbox = function() {
    const lightbox = document.getElementById('gallery-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
};

// Gallery Auto-Scroll Logic
let galleryPauseUntil = 0;

window.pauseGallery = function() {
    galleryPauseUntil = Date.now() + 5000;
};

window.prevMainImage = function(e) {
    if (e) {
        e.stopPropagation();
        window.pauseGallery();
    }
    if (!currentPropertyImages.length) return;
    let nextIndex = currentLightboxIndex - 1;
    if (nextIndex < 0) nextIndex = currentPropertyImages.length - 1;
    const thumbs = document.querySelectorAll('.thumbnail-gallery .thumb');
    if (thumbs.length > nextIndex) {
        window.updateMainImage(thumbs[nextIndex], nextIndex);
    }
};

window.nextMainImage = function(e) {
    if (e) {
        e.stopPropagation();
        window.pauseGallery();
    }
    if (!currentPropertyImages.length) return;
    let nextIndex = currentLightboxIndex + 1;
    if (nextIndex >= currentPropertyImages.length) nextIndex = 0;
    const thumbs = document.querySelectorAll('.thumbnail-gallery .thumb');
    if (thumbs.length > nextIndex) {
        window.updateMainImage(thumbs[nextIndex], nextIndex);
    }
};

// Add pause on touch/hover for gallery
document.addEventListener('DOMContentLoaded', () => {
    // We bind it globally or directly to the gallery since it's dynamically populated
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.prop-gallery')) window.pauseGallery();
    }, {passive: true});
    
    document.addEventListener('mousemove', (e) => {
        if (e.target.closest('.prop-gallery')) window.pauseGallery();
    }, {passive: true});
});

// Auto cycle the gallery every 2s
setInterval(() => {
    if (currentPropertyImages.length <= 1) return;
    if (document.getElementById('gallery-lightbox') && document.getElementById('gallery-lightbox').classList.contains('active')) return;
    
    if (Date.now() > galleryPauseUntil) {
        window.nextMainImage();
    }
}, 2000);

window.changeLightboxImage = function(direction) {
    if (!currentPropertyImages.length) return;
    currentLightboxIndex += direction;
    if (currentLightboxIndex >= currentPropertyImages.length) {
        currentLightboxIndex = 0;
    } else if (currentLightboxIndex < 0) {
        currentLightboxIndex = currentPropertyImages.length - 1;
    }
    updateLightboxView();
};

function updateLightboxView() {
    const img = document.getElementById('lightbox-main-img');
    const counter = document.getElementById('lightbox-counter');
    if (img && currentPropertyImages[currentLightboxIndex]) {
        img.src = currentPropertyImages[currentLightboxIndex].replace('&w=300', '&w=1200');
    }
    if (counter) {
        counter.textContent = `${currentLightboxIndex + 1} / ${currentPropertyImages.length}`;
    }
}

document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('gallery-lightbox');
    if (lightbox && lightbox.classList.contains('active')) {
        if (e.key === 'ArrowRight') window.changeLightboxImage(1);
        if (e.key === 'ArrowLeft') window.changeLightboxImage(-1);
        if (e.key === 'Escape') window.closeLightbox();
    }
});

window.loadMapEmbed = function() {
    const mapContainer = document.getElementById('prop-map-container');
    if (!mapContainer || !currentPropertyLocation) return;
    
    mapContainer.style.background = '#e5e3df'; // light grey background while map loads
    mapContainer.style.padding = '0';
    mapContainer.style.height = '400px';
    mapContainer.innerHTML = '<div style="display: flex; height: 100%; align-items: center; justify-content: center;">Loading interactive map...</div>';
    
    const initMap = () => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: currentPropertyLocation + ", India" }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                
                // Clear the 'Loading' text
                mapContainer.innerHTML = '';
                
                const map = new google.maps.Map(mapContainer, {
                    center: location,
                    zoom: 13,
                    mapTypeControl: true,
                    streetViewControl: false,
                });
                
                new google.maps.Marker({
                    position: location,
                    map: map
                });
                
                new google.maps.Circle({
                    strokeColor: "#4285F4",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#4285F4",
                    fillOpacity: 0.15,
                    map: map,
                    center: location,
                    radius: 5000 // 5km radius
                });
            } else {
                mapContainer.innerHTML = `<p style="padding: 2rem; text-align: center;">Unable to load map for this location.</p>`;
            }
        });
    };

    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        const script = document.createElement('script');
        // IMPORTANT: Replace YOUR_API_KEY_HERE with an actual Google Maps API Key
        script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE`;
        script.onload = initMap;
        document.head.appendChild(script);
    } else {
        initMap();
    }
};
