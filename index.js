const headerInner = document.querySelector('.header-inner');
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.getElementById('site-nav');

let closeSiteNav = () => {};

if (headerInner && navToggle && siteNav) {
    const setSiteNavOpen = (isOpen) => {
        headerInner.dataset.navOpen = isOpen ? 'true' : 'false';
        navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        document.body.classList.toggle('nav-open', isOpen);
    };

    closeSiteNav = () => {
        setSiteNavOpen(false);
    };

    setSiteNavOpen(false);

    navToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setSiteNavOpen(headerInner.dataset.navOpen !== 'true');
    });

    siteNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            closeSiteNav();
        });
    });

    document.addEventListener('click', (event) => {
        if (headerInner.dataset.navOpen === 'true' && !headerInner.contains(event.target)) {
            closeSiteNav();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSiteNav();
        }
    });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
        const targetSelector = anchor.getAttribute('href');

        if (!targetSelector || targetSelector === '#') {
            return;
        }

        event.preventDefault();

        const target = document.querySelector(targetSelector);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

document.querySelectorAll('.screenshot-tab').forEach((button) => {
    button.addEventListener('click', () => {
        const { view } = button.dataset;

        document.querySelectorAll('.screenshot-tab').forEach((tab) => {
            tab.classList.remove('active');
        });

        button.classList.add('active');

        document.querySelectorAll('.screenshot-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.view === view);
        });
    });
});

document.querySelectorAll('.screenshot-panel').forEach((panel) => {
    const featureCard = panel.querySelector('.screenshot-feature');
    const featureImage = featureCard?.querySelector('img');
    const featureLabel = featureCard?.querySelector('.screenshot-label');
    const variants = panel.querySelectorAll('.screenshot-variant');

    if (!featureCard || !featureImage || variants.length === 0) {
        return;
    }

    variants.forEach((variant) => {
        variant.addEventListener('click', () => {
            variants.forEach((button) => {
                const isActive = button === variant;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });

            featureCard.dataset.fullsrc = variant.dataset.fullsrc || featureCard.dataset.fullsrc;
            featureCard.setAttribute('aria-label', variant.dataset.ariaLabel || featureCard.getAttribute('aria-label') || '');
            featureImage.src = variant.dataset.previewsrc || featureImage.src;
            featureImage.alt = variant.dataset.alt || featureImage.alt;

            if (featureLabel && variant.dataset.label) {
                featureLabel.textContent = variant.dataset.label;
            }
        });
    });
});

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function closeLightbox() {
    if (!lightbox || !lightbox.classList.contains('active')) {
        return;
    }

    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
}

if (lightbox && lightboxImg) {
    document.querySelectorAll('.screenshot-card').forEach((card) => {
        card.addEventListener('click', () => {
            const preview = card.querySelector('img');

            lightboxImg.src = card.dataset.fullsrc;
            lightboxImg.alt = preview.alt;
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('lightbox-open');
        });
    });

    lightbox.addEventListener('click', closeLightbox);
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeSiteNav();
        closeLightbox();
    }
});
