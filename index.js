const gaScript = document.createElement('script');
gaScript.async = true;
gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-YX08PG386W';
document.head.appendChild(gaScript);

window.dataLayer = window.dataLayer || [];

function gtag() {
    window.dataLayer.push(arguments);
}

gtag('js', new Date());
gtag('config', 'G-YX08PG386W');

document.fonts.ready.then(() => {
    document.body.classList.add('fonts-loaded');
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
        event.preventDefault();

        const target = document.querySelector(anchor.getAttribute('href'));
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

        document.querySelectorAll('.screenshot-pair').forEach((pair) => {
            pair.classList.toggle('active', pair.dataset.view === view);
        });
    });
});

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function closeLightbox() {
    if (!lightbox.classList.contains('active')) {
        return;
    }

    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
}

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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeLightbox();
    }
});