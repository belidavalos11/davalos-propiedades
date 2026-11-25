/**
 * DÁVALOS PROPIEDADES - Gestor compartido de Modo Oscuro / Claro
 * Se carga en <head> antes del primer pintado para evitar parpadeos (FOUC).
 */
(function () {
    const STORAGE_KEY = "davalos_theme";

    function readSavedTheme() {
        try {
            const val = localStorage.getItem(STORAGE_KEY);
            if (val === "dark" || val === "light") return val;
        } catch (_) {}
        return "light";
    }

    function updateMetaThemeColor(theme) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute("content", theme === "dark" ? "#0b1120" : "#050e36");
        }
    }

    function syncToggleButtons(theme) {
        const isDark = theme === "dark";
        const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
        document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
            btn.setAttribute("aria-pressed", isDark ? "true" : "false");
            btn.setAttribute("aria-label", label);
            btn.setAttribute("title", label);
            btn.classList.toggle("is-dark", isDark);
            const labelSpan = btn.querySelector("[data-theme-label]");
            if (labelSpan) {
                labelSpan.textContent = isDark ? "Modo claro" : "Modo oscuro";
            }
        });
    }

    const INLINE_THEME_VARS = [
        "--primary",
        "--primary-dark",
        "--gold-light",
        "--gold-dark",
        "--secondary",
        "--background",
        "--surface",
        "--text",
        "--text-light",
        "--text-dark",
        "--loader-bg",
        "--loader-color"
    ];

    function clearInlineBrandThemeVars() {
        const rootStyle = document.documentElement.style;
        INLINE_THEME_VARS.forEach((v) => rootStyle.removeProperty(v));
    }

    function applyTheme(theme, persist = false) {
        const normalized = theme === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", normalized);
        document.documentElement.style.colorScheme = normalized;

        if (normalized === "dark") {
            clearInlineBrandThemeVars();
        } else if (typeof window.applyBrandThemeColors === "function") {
            window.applyBrandThemeColors();
        }

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, normalized);
            } catch (_) {}
        }
        updateMetaThemeColor(normalized);
        syncToggleButtons(normalized);
    }

    function getTheme() {
        return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    function toggleTheme() {
        applyTheme(getTheme() === "dark" ? "light" : "dark", true);
    }

    // Aplicar inmediatamente antes del primer render
    const initialTheme = readSavedTheme();
    document.documentElement.setAttribute("data-theme", initialTheme);
    document.documentElement.style.colorScheme = initialTheme;

    function initButtons() {
        const current = getTheme();
        updateMetaThemeColor(current);
        syncToggleButtons(current);

        document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
            if (btn.dataset.themeBound === "1") return;
            btn.dataset.themeBound = "1";
            btn.addEventListener("click", toggleTheme);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initButtons);
    } else {
        initButtons();
    }

    // Sincronizar entre pestañas (Home <-> Gestión <-> Detalle)
    window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light")) {
            applyTheme(e.newValue, false);
        }
    });

    window.ThemeManager = {
        getTheme,
        setTheme: (t) => applyTheme(t, true),
        toggleTheme
    };
})();
