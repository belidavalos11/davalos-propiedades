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
    
    // Ensure the animation completes (drawLogo is 2s)
    // We wait 2100ms to be safe and let the fill settle
    setTimeout(() => {
        loader.classList.add('hidden');
    }, 2100);
};

window.triggerLoader = function(url) {
    window.showLoader();

    // Navigate after the full animation completes
    setTimeout(() => {
        window.location.href = url;
    }, 2200);
};
