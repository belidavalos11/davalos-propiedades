document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    // Calcular la longitud exacta de cada trazo para que la animacion sea 100% continua
    const paths = loader.querySelectorAll('.logo-path');
    paths.forEach(path => {
        try {
            const length = Math.ceil(path.getTotalLength()) + 1;
            path.style.setProperty('--path-length', length);
            path.style.strokeDasharray = `${length} ${length}`;
            path.style.strokeDashoffset = length;
        } catch (e) {
            // fallback
        }
    });

    // Forzar reflow antes de arrancar
    void loader.offsetWidth;

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
    const paths = loader.querySelectorAll('.logo-path');
    paths.forEach(path => {
        try {
            const length = Math.ceil(path.getTotalLength()) + 1;
            path.style.setProperty('--path-length', length);
            path.style.strokeDasharray = `${length} ${length}`;
            path.style.strokeDashoffset = length;
        } catch (e) {
            // fallback
        }
    });
    loader.classList.remove('hidden', 'loader-active');
    void loader.offsetWidth; // Force reflow
    loader.classList.add('loader-active');
};

window.hideLoader = function() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    
    // Ensure the animation completes smoothly (drawLogo is 2.2s)
    setTimeout(() => {
        loader.classList.add('hidden');
    }, 2300);
};

window.triggerLoader = function(url) {
    window.showLoader();

    // Navigate after the full animation completes
    setTimeout(() => {
        window.location.href = url;
    }, 2400);
};
