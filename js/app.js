// Modal Logic
window.toggleModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');

    // Hide all other modals first
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m.id !== modalId) m.classList.add('hidden');
    });

    // Toggle the target modal
    if (isHidden) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

window.closeModalOutside = function(event, modalId) {
    if (event.target.id === modalId) {
        window.toggleModal(modalId);
    }
};

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');
    if(mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.classList.toggle('active');
            if (navActions) navActions.classList.toggle('active');
            
            if(navLinks.classList.contains('active')) {
                mobileToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            } else {
                mobileToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
            }
        });
    }

    // Form Submission Handling (Prevent Reload) for modal forms
    document.querySelectorAll('form').forEach(form => {
        if (form.classList.contains('hero-search-bar') || form.getAttribute('method') === 'GET') {
            return; // Allow native submission for search forms
        }
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalText = submitBtn.innerText;
                submitBtn.innerText = 'Submitted Successfully ✓';
                submitBtn.style.backgroundColor = '#10b981';
                submitBtn.style.color = 'white';
                
                setTimeout(() => {
                    submitBtn.innerText = originalText;
                    submitBtn.style.backgroundColor = '';
                    submitBtn.style.color = '';
                    form.reset();
                    const modal = form.closest('.modal-overlay');
                    if (modal) {
                        window.toggleModal(modal.id);
                    }
                }, 3000);
            }
        });
    });

    // Hero Search Tabs Logic
    const heroTabs = document.querySelectorAll('.hero-tab');
    const heroSearchType = document.getElementById('hero-search-type');
    if (heroTabs.length > 0 && heroSearchType) {
        heroTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active from all tabs
                heroTabs.forEach(t => t.classList.remove('active'));
                // Add active to clicked tab
                tab.classList.add('active');
                // Update hidden input value
                heroSearchType.value = tab.getAttribute('data-type');
            });
        });
    }

    // Hero Search Bar Submission Redirect
    const heroSearchBar = document.querySelector('.hero-search-bar');
    if (heroSearchBar && heroSearchType) {
        heroSearchBar.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = heroSearchType.value;
            const query = heroSearchBar.querySelector('input[name="q"]').value;
            let targetPage = `search${type}.html`;
            if (query) {
                targetPage += `?q=${encodeURIComponent(query)}`;
            }
            window.location.href = targetPage;
        });
    }
});
