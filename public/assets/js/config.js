const SITE_CONFIG = {
    // 1. Identidad de la Inmobiliaria
    brand: {
        name: "Dávalos Propiedades",
        upperName: "DÁVALOS PROPIEDADES",
        siteTitle: "DÁVALOS PROPIEDADES SALTA | Venta, Alquiler y Tasaciones",
        heroEyebrow: "DÁVALOS PROPIEDADES · SALTA",
        tagline: "Compra, venta, alquileres, tasaciones e inversiones con un acompañamiento responsable en cada etapa de tu operación.",
        heroTitleHtml: "El lugar que buscás,<br>más cerca de lo que creés.",
        heroHighlights: ["Compra y venta", "Alquileres", "Tasaciones"],
        foundedYear: 2002,
        license: "MP N° 96",
        aboutEyebrow: "● NOSOTROS",
        aboutTitle: "Sobre Dávalos Propiedades.",
        aboutSubtitle: "Más de 20 años acompañando a cada cliente con confianza, transparencia y atención personalizada.",
        aboutText: `Con más de 20 años de trayectoria en el mercado inmobiliario, en <strong>DÁVALOS PROPIEDADES</strong> nos dedicamos a brindar un servicio de excelencia, basado en la confianza, la transparencia y la atención personalizada.<br><br>Nuestra misión es ayudar a cada cliente a encontrar no solo una propiedad, sino el lugar donde comenzarán una nueva etapa de su vida.`
    },

    // 1.1 Configuración SEO y Open Graph (Marca Blanca)
    seo: {
        siteUrl: "https://davalospropiedades.com.ar",
        defaultTitle: "DÁVALOS PROPIEDADES SALTA | Venta, Alquiler y Tasaciones",
        description: "Dávalos Propiedades Salta (MP N° 96). Más de 20 años de trayectoria en compra, venta, alquileres, tasaciones e inversiones inmobiliarias en Salta.",
        keywords: "inmobiliaria salta, davalos propiedades, venta de casas salta, alquileres salta, departamentos salta, terrenos salta, tasaciones inmobiliarias salta",
        ogImage: "assets/images/logo-completo.png",
        locale: "es_AR",
        twitterCard: "summary_large_image"
    },

    // 2. Contacto y Ubicación
    contact: {
        phone: "+543874155902",
        phoneDisplay: "+54 387 415-5902",
        whatsapp: "5493874155902",
        email: "contacto@davalospropiedades.com.ar",
        address: "Del Milagro 635",
        city: "Salta",
        province: "Salta",
        country: "Argentina",
        mapCenter: [-24.7859, -65.4117],
        footerText: "© 2002 DÁVALOS PROPIEDADES - MP N° 96 - DEL MILAGRO 635"
    },

    // 3. Recursos visuales (Rutas relativas a /public)
    assets: {
        logoHeader: "assets/images/logo-horizontal.svg",
        logoFooter: "assets/images/logo-completo.png",
        logoSeal: "assets/images/logo-seal.svg",
        ogImage: "assets/images/logo-completo.png",
        heroBackground: "assets/images/cabildo.jpg",
        placeholderImage: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80"
    },

    // 4. Redes Sociales (Opcional: completar con la URL para mostrar ícono en el footer)
    social: {
        instagram: "",
        facebook: "",
        linkedin: "",
        youtube: "",
        tiktok: ""
    },

    // 5. Paleta de Colores y Tipografía (:root)
    theme: {
        primary: "#050e36",
        primaryDark: "#02061c",
        secondary: "#1a1a1a",
        background: "#f4f3ef",
        surface: "#ffffff",
        text: "#2d3436",
        textLight: "#636e72",
        textDark: "#111827",
        loaderBg: "#ffffff",
        loaderColor: "#050e36",
        fontFamily: "'Montserrat', sans-serif"
    },

    // 6. Sección "Explora por categoría" (Categorías desacopladas para Marca Blanca)
    categoriesSection: {
        eyebrow: "● PROPIEDADES",
        title: "Explora por categoría",
        subtitle: "Accedé directamente a las categorías disponibles y encontrá opciones alineadas a lo que estás buscando."
    },
    propertyCategories: [
        {
            id: "campo",
            label: "Campo",
            matchTypes: ["campo"],
            image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "casaquinta",
            label: "Casaquinta",
            matchTypes: ["casaquinta", "quinta"],
            image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "casa",
            label: "Casas",
            matchTypes: ["casa", "casas"],
            image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "departamento",
            label: "Departamentos",
            matchTypes: ["departamento", "departamentos"],
            image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "duplex",
            label: "Dúplexs",
            matchTypes: ["duplex", "dúplex", "duplexs"],
            image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "finca",
            label: "Finca",
            matchTypes: ["finca"],
            image: "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "galpon",
            label: "Galpón",
            matchTypes: ["galpon", "galpón"],
            image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "local",
            label: "Locales comerciales",
            matchTypes: ["local", "comercio", "locales comerciales"],
            image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "oficina",
            label: "Oficinas",
            matchTypes: ["oficina", "oficinas"],
            image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: "terreno",
            label: "Terrenos",
            matchTypes: ["terreno", "lote", "terrenos"],
            image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
        }
    ],

    // 7. Origen de datos del catálogo desacoplado
    data: {
        catalogUrl: "data/properties.json"
    },

    // 8. Equipo de Agentes / Vendedores (Contacto directo por propiedad)
    defaultAgent: {
        id: "agente-default",
        name: "Dávalos Propiedades",
        role: "Asesor Inmobiliario",
        phone: "+543874155902",
        whatsapp: "5493874155902",
        email: "contacto@davalospropiedades.com.ar",
        photoUrl: "assets/images/logo-simple-bordered.png"
    },
    agents: [
        {
            id: "agente-1",
            name: "Beli Dávalos",
            aliases: ["beli", "belid", "belidavalos"],
            role: "Asesora Comercial",
            phone: "+543875053884",
            whatsapp: "5493875053884",
            email: "beli@davalospropiedades.com.ar",
            photoUrl: ""
        },
        {
            id: "agente-2",
            name: "Florencia Pfister",
            aliases: ["flopy", "flopypfister"],
            role: "Asesora Comercial",
            phone: "+543874155902",
            whatsapp: "5493874155902",
            email: "florencia@davalospropiedades.com.ar",
            photoUrl: ""
        },
        {
            id: "agente-3",
            name: "Irene García",
            aliases: ["ire", "irene", "irenegarcia"],
            role: "Asesora Comercial",
            phone: "+543871234567",
            whatsapp: "5493871234567",
            email: "irene@davalospropiedades.com.ar",
            photoUrl: ""
        }
    ]
};

window.SITE_CONFIG = SITE_CONFIG;

// Normaliza números telefónicos al formato internacional para wa.me (ej. 549387...)
window.normalizeWhatsappPhone = function (raw) {
    let phone = String(raw || "").replace(/\D/g, "");
    if (!phone) {
        return String(window.SITE_CONFIG?.defaultAgent?.whatsapp || window.SITE_CONFIG?.contact?.whatsapp || "5493874155902").replace(/\D/g, "");
    }
    if (phone.startsWith("0")) phone = phone.substring(1);
    if (phone.startsWith("38715") && phone.length === 12) {
        phone = "387" + phone.substring(5);
    } else if (phone.length === 12 && phone.substring(2, 4) === "15") {
        phone = phone.substring(0, 2) + phone.substring(4);
    } else if (phone.length === 11 && phone.startsWith("15")) {
        phone = phone.substring(2);
    }
    if (phone.startsWith("549")) return phone;
    if (phone.startsWith("54")) return "549" + phone.substring(2);
    return "549" + phone;
};

// Obtiene el agente asignado a una propiedad (por agentId, por nombre legacy o usuarios dinámicos) con fallback a defaultAgent
const resolvePropertyAgentByConfig = function (prop) {
    const cfg = window.SITE_CONFIG || {};
    const agents = Array.isArray(cfg.agents) ? cfg.agents : [];
    const fallback = cfg.defaultAgent || {
        id: "agente-default",
        name: cfg.brand?.name || "Dávalos Propiedades",
        role: "Asesor Inmobiliario",
        phone: cfg.contact?.phone || "+543874155902",
        whatsapp: cfg.contact?.whatsapp || "5493874155902",
        email: cfg.contact?.email || "",
        photoUrl: ""
    };

    if (!prop) return fallback;

    const targetId = String(prop.agentId || "").trim().toLowerCase();
    const targetName = String(prop.agent || "").trim().toLowerCase();

    // 1. Buscar en SITE_CONFIG.agents por id exacto
    if (targetId) {
        const byId = agents.find(a => String(a.id).toLowerCase() === targetId);
        if (byId) return byId;
    }

    // 2. Buscar en SITE_CONFIG.agents por nombre o alias (compatibilidad con propiedades existentes)
    const searchKey = targetId || targetName;
    if (searchKey) {
        const byNameOrAlias = agents.find(a => {
            const nameMatch = String(a.name || "").toLowerCase() === searchKey || String(a.name || "").toLowerCase().includes(searchKey);
            const aliasMatch = Array.isArray(a.aliases) && a.aliases.some(al => String(al).toLowerCase() === searchKey);
            return nameMatch || aliasMatch;
        });
        if (byNameOrAlias) return byNameOrAlias;
    }

    // 3. Buscar en AuthManager si fue asignado a un usuario creado desde Gestión de Usuarios
    if (searchKey && window.AuthManager && typeof window.AuthManager.getAllUsersSync === "function") {
        const users = window.AuthManager.getAllUsersSync() || [];
        const matchedUser = users.find(u =>
            String(u.username || "").toLowerCase() === searchKey ||
            String(u.displayName || "").toLowerCase() === searchKey
        );
        if (matchedUser) {
            const fullName = [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(" ").trim() || matchedUser.displayName || matchedUser.username;
            const normWa = window.normalizeWhatsappPhone(matchedUser.phone || fallback.whatsapp);
            return {
                id: matchedUser.username,
                name: fullName,
                role: "Asesor Inmobiliario",
                phone: matchedUser.phone || fallback.phone,
                whatsapp: normWa,
                email: matchedUser.email || fallback.email,
                photoUrl: matchedUser.photoUrl || ""
            };
        }
    }

    return fallback;
};

// Wrapper público: si el documento trae agentWhatsapp/agentPhone, ese número tiene prioridad;
// el nombre, rol, etc. se resuelven por agentId (o por defaultAgent si no coincide).
window.getPropertyAgent = function (prop) {
    const agent = resolvePropertyAgentByConfig(prop);
    const directPhone = String(prop?.agentWhatsapp || prop?.agentPhone || "").replace(/\D/g, "");
    if (!directPhone) return agent;
    return { ...agent, whatsapp: window.normalizeWhatsappPhone(directPhone), phone: prop.agentPhone || agent.phone };
};

// Resuelve una ruta de imagen/recurso como URL absoluta para Open Graph y WhatsApp
window.resolveAbsoluteUrl = function (rawPath) {
    if (!rawPath) return "";
    const trimmed = String(rawPath).trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
    const base = window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : (window.SITE_CONFIG?.seo?.siteUrl || "https://davalospropiedades.com.ar");
    if (trimmed.startsWith("/")) return `${base}${trimmed}`;
    // Si estamos dentro de /public/ en servidor local, respetar el directorio base
    const dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    return `${base}${dir}${trimmed}`;
};

// Resuelve la URL completa y directa a la publicación de la propiedad
window.getPropertyDirectUrl = function (prop) {
    if (!prop) return "";
    // Si estamos navegando dentro de details.html y coincide con la propiedad visualizada, usar window.location.href
    if (typeof window !== "undefined" && window.location && window.location.pathname.includes("details.html")) {
        const urlParams = new URLSearchParams(window.location.search);
        if (!prop.id || urlParams.get("id") == prop.id) {
            return window.location.href;
        }
    }
    const propId = prop.id ?? "";
    const relativeUrl = `details.html?id=${encodeURIComponent(propId)}`;
    if (typeof window.resolveAbsoluteUrl === "function") {
        return window.resolveAbsoluteUrl(relativeUrl);
    }
    const base = (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null")
        ? window.location.origin
        : (window.SITE_CONFIG?.seo?.siteUrl || "https://davalospropiedades.com.ar");
    return `${base}/${relativeUrl}`;
};

// Determina si una propiedad tiene un vendedor/asesor específico asignado y devuelve su nombre (o null si es genérico)
window.getPropertySellerName = function (prop, agent) {
    const rawAgent = agent || (window.getPropertyAgent ? window.getPropertyAgent(prop) : null);
    if (!rawAgent) return null;

    // Si el ID es explícitamente el genérico por defecto
    if (rawAgent.id === "agente-default") return null;

    // Si la propiedad no tiene ni agentId ni agent especificado
    if (!prop?.agentId && !prop?.agent) return null;

    const brandName = String(window.SITE_CONFIG?.brand?.name || "Dávalos Propiedades").trim().toLowerCase();
    const rawName = String(rawAgent.name || "").trim();
    if (!rawName) return null;

    const lower = rawName.toLowerCase();
    const genericNames = [
        brandName,
        "dávalos propiedades",
        "davalos propiedades",
        "admin",
        "administrador",
        "asesor",
        "asesora",
        "asesor inmobiliario",
        "inmobiliaria"
    ];
    if (genericNames.includes(lower)) return null;

    return rawName;
};

// Helper centralizado para generar el enlace de WhatsApp con formato unificado y URL directa
window.buildPropertyWhatsappUrl = function (prop, consultantName = "") {
    const agent = window.getPropertyAgent ? window.getPropertyAgent(prop) : null;
    const rawPhone = window.normalizeWhatsappPhone
        ? window.normalizeWhatsappPhone(agent?.whatsapp || agent?.phone || window.SITE_CONFIG?.contact?.whatsapp || "5493874155902")
        : String(agent?.whatsapp || agent?.phone || window.SITE_CONFIG?.contact?.whatsapp || "5493874155902").replace(/\D/g, "");

    const rawName = String(consultantName || "").trim();
    const title = String(prop?.title || "la propiedad").trim();
    const directUrl = window.getPropertyDirectUrl ? window.getPropertyDirectUrl(prop) : "";

    let message = "";
    if (rawName) {
        message = `¡Hola me llamo ${rawName}, vi esta propiedad en la página '${title}' (${directUrl}) y me gustaría que me pasen más información. ¡Muchas gracias!`;
    } else {
        message = `¡Hola, vi esta propiedad en la página '${title}' (${directUrl}) y me gustaría que me pasen más información. ¡Muchas gracias!`;
    }

    return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
};

// Actualiza dinámicamente <title>, meta description, keywords, Open Graph, Twitter Cards y canonical
window.updatePageSeoMeta = function (meta = {}) {
    const cfg = window.SITE_CONFIG || {};
    const seoCfg = cfg.seo || {};
    const brandCfg = cfg.brand || {};

    const title = meta.title || seoCfg.defaultTitle || brandCfg.siteTitle || "DÁVALOS PROPIEDADES SALTA";
    const description = meta.description || seoCfg.description || brandCfg.tagline || "";
    const keywords = meta.keywords || seoCfg.keywords || "";
    const image = window.resolveAbsoluteUrl(meta.image || seoCfg.ogImage || cfg.assets?.ogImage || "assets/images/logo-completo.png");
    const url = meta.url || window.location.href;
    const type = meta.type || "website";
    const siteName = brandCfg.name || "Dávalos Propiedades";
    const locale = seoCfg.locale || "es_AR";
    const twitterCard = seoCfg.twitterCard || "summary_large_image";

    document.title = title;

    const setMeta = (attrName, attrValue, content) => {
        if (!content) return;
        let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute(attrName, attrValue);
            document.head.appendChild(el);
        }
        el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    setMeta("name", "keywords", keywords);
    setMeta("name", "author", siteName);

    // Open Graph (WhatsApp, Facebook, LinkedIn)
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:locale", locale);

    // Twitter Cards
    setMeta("name", "twitter:card", twitterCard);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
};

function applySiteConfig() {
    const cfg = window.SITE_CONFIG;
    if (!cfg) return;

    const root = document.documentElement;

    // 1. Inyectar variables CSS (:root)
    if (cfg.theme) {
        if (cfg.theme.primary) {
            root.style.setProperty("--primary", cfg.theme.primary);
            root.style.setProperty("--gold-light", cfg.theme.primary);
        }
        if (cfg.theme.primaryDark) {
            root.style.setProperty("--primary-dark", cfg.theme.primaryDark);
            root.style.setProperty("--gold-dark", cfg.theme.primaryDark);
        }
        if (cfg.theme.secondary) root.style.setProperty("--secondary", cfg.theme.secondary);
        if (cfg.theme.background) root.style.setProperty("--background", cfg.theme.background);
        if (cfg.theme.surface) root.style.setProperty("--surface", cfg.theme.surface);
        if (cfg.theme.text) root.style.setProperty("--text", cfg.theme.text);
        if (cfg.theme.textLight) root.style.setProperty("--text-light", cfg.theme.textLight);
        if (cfg.theme.textDark) root.style.setProperty("--text-dark", cfg.theme.textDark);
        if (cfg.theme.loaderBg) root.style.setProperty("--loader-bg", cfg.theme.loaderBg);
        if (cfg.theme.loaderColor) root.style.setProperty("--loader-color", cfg.theme.loaderColor);
        if (cfg.theme.fontFamily) root.style.setProperty("--font-main", cfg.theme.fontFamily);

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme && cfg.theme.primary) {
            metaTheme.setAttribute("content", cfg.theme.primary);
        }
    }

    // 1.1 Inicializar metadatos SEO y Open Graph base desde config.js
    const isDetailsPage = /details/i.test(window.location.pathname);
    if (!isDetailsPage && window.updatePageSeoMeta) {
        window.updatePageSeoMeta({
            title: cfg.seo?.defaultTitle || cfg.brand?.siteTitle,
            description: cfg.seo?.description,
            keywords: cfg.seo?.keywords,
            image: cfg.seo?.ogImage || cfg.assets?.ogImage,
            type: "website"
        });
    }

    // 2. Actualizar Logos (Header y Footer)
    const headerLogo = document.querySelector(".logo-img-main");
    if (headerLogo && cfg.assets?.logoHeader) {
        headerLogo.src = cfg.assets.logoHeader;
        headerLogo.alt = cfg.brand?.upperName || "Inmobiliaria";
    }

    const footerLogo = document.querySelector(".logo-footer");
    if (footerLogo && cfg.assets?.logoFooter) {
        footerLogo.src = cfg.assets.logoFooter;
        footerLogo.alt = cfg.brand?.upperName || "Inmobiliaria";
    }

    // 3. Actualizar Textos de Portada y Nosotros (index.html)
    const heroEyebrowText = document.getElementById("hero-eyebrow-text");
    if (heroEyebrowText && cfg.brand?.heroEyebrow) {
        heroEyebrowText.textContent = cfg.brand.heroEyebrow;
    }

    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle && cfg.brand?.heroTitleHtml) {
        heroTitle.innerHTML = cfg.brand.heroTitleHtml;
    }

    const heroSubtitle = document.querySelector(".hero-subtitle");
    if (heroSubtitle && cfg.brand?.tagline) {
        heroSubtitle.textContent = cfg.brand.tagline;
    }

    const heroWaBtn = document.getElementById("btn-hero-whatsapp");
    if (heroWaBtn) {
        const waPhone = window.normalizeWhatsappPhone(cfg.contact?.whatsapp || cfg.defaultAgent?.whatsapp || "5493874155902");
        const waMsg = encodeURIComponent(`Hola, me comunico desde el sitio web de ${cfg.brand?.name || "Dávalos Propiedades"} para realizar una consulta.`);
        heroWaBtn.href = `https://wa.me/${waPhone}?text=${waMsg}`;
    }

    const aboutEyebrow = document.getElementById("about-eyebrow");
    if (aboutEyebrow && cfg.brand?.aboutEyebrow) {
        aboutEyebrow.textContent = cfg.brand.aboutEyebrow;
    }

    const aboutTitle = document.getElementById("about-title") || document.querySelector("#nosotros .section-title");
    if (aboutTitle && cfg.brand?.aboutTitle) {
        aboutTitle.textContent = cfg.brand.aboutTitle;
    }

    const aboutSubtitle = document.getElementById("about-subtitle");
    if (aboutSubtitle && cfg.brand?.aboutSubtitle) {
        aboutSubtitle.textContent = cfg.brand.aboutSubtitle;
    }

    const aboutText = document.getElementById("about-body-text") || document.querySelector("#nosotros .about-card-content p");
    if (aboutText && cfg.brand?.aboutText) {
        aboutText.innerHTML = cfg.brand.aboutText;
    }

    // 4. Actualizar Footer (Texto legal + Redes Sociales si existen)
    const footerContainer = document.querySelector(".footer .container");
    if (footerContainer) {
        const footerP = footerContainer.querySelector("p");
        if (footerP && cfg.contact?.footerText) {
            footerP.textContent = cfg.contact.footerText;
        }

        // Renderizar enlaces sociales si están configurados
        if (cfg.social) {
            const activeSocials = Object.entries(cfg.social).filter(([_, url]) => url && String(url).trim() !== "");
            let socialContainer = footerContainer.querySelector(".footer-socials");
            if (activeSocials.length > 0) {
                if (!socialContainer) {
                    socialContainer = document.createElement("div");
                    socialContainer.className = "footer-socials";
                    socialContainer.style.cssText = "display: flex; justify-content: center; gap: 16px; margin: 15px 0;";
                    footerContainer.insertBefore(socialContainer, footerP);
                }
                const labels = {
                    instagram: "Instagram",
                    facebook: "Facebook",
                    linkedin: "LinkedIn",
                    youtube: "YouTube",
                    tiktok: "TikTok"
                };
                socialContainer.innerHTML = activeSocials.map(([net, url]) =>
                    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--white); opacity: 0.85; text-decoration: none; font-size: 0.9rem; font-weight: 500;">${labels[net] || net}</a>`
                ).join(" • ");
            }
        }
    }
}

// Ejecutar tan pronto como el DOM esté listo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySiteConfig);
} else {
    applySiteConfig();
}

// Auto-reload para entorno de desarrollo local (localhost)
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    let lastMtime = null;
    setInterval(async () => {
        try {
            const res = await fetch("/__mtime__", { cache: "no-store" });
            if (!res.ok) return;
            const mtime = await res.text();
            if (lastMtime === null) {
                lastMtime = mtime;
            } else if (mtime !== lastMtime) {
                window.location.reload();
            }
        } catch (_) {
            // Silencioso si el servidor no implementa /__mtime__
        }
    }, 1200);
}
