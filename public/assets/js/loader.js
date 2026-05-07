document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    // Add active class to start animations
    loader.classList.add('loader-active');

    // Hide loader when page is fully loaded
    window.addEventListener('load', () => {
        window.hideLoader();
    });

    // Fallback
    setTimeout(() => {
        window.hideLoader();
    }, 5000);
});

window.showLoader = function() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.remove('hidden', 'loader-active');
    void loader.offsetWidth; // Force reflow
    loader.classList.add('loader-active');
};

window.hideLoader = function() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    
    setTimeout(() => {
        loader.classList.add('hidden');
    }, 1200);
};

window.triggerLoader = function(url) {
    window.showLoader();

    // Navigate after the drawing phase starts to feel completed (approx 1.8s)
    setTimeout(() => {
        window.location.href = url;
    }, 1800);
};
