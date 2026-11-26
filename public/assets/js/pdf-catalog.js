/**
 * DÁVALOS PROPIEDADES - Generador de Catálogo PDF Profesional (ADMIN / SUPER_ADMIN)
 * Permite combinar filtros acumulables (operación, categorías, moneda, zona, orden)
 * y descargar una hoja/catálogo PDF corporativo con el logo y colores de la marca.
 */
(function () {
    "use strict";

    const CATEGORY_OPTIONS = [
        { id: "casa", label: "Casas" },
        { id: "departamento", label: "Departamentos" },
        { id: "terreno", label: "Terrenos / Lotes" },
        { id: "duplex", label: "Dúplex" },
        { id: "local", label: "Locales comerciales" },
        { id: "oficina", label: "Oficinas" },
        { id: "casaquinta", label: "Casaquintas" },
        { id: "campo", label: "Campos / Fincas" },
        { id: "galpon", label: "Galpones" }
    ];

    const pdfState = {
        selectedOps: new Set(),   // "venta", "alquiler" (vacío = ambas)
        selectedTypes: new Set(), // IDs de CATEGORY_OPTIONS (vacío = todas)
        currency: "todas",
        sort: "type-op",
        searchText: "",
        includePhotos: true,
        includeLinks: true,
        isGenerating: false
    };

    function isAuthorizedAdmin() {
        const m = window.AuthManager;
        if (!m || !m.isLoggedIn()) return false;
        const role = m.getUserRole();
        return Boolean(
            role === "SUPER_ADMIN" ||
            role === "ADMIN" ||
            (m.Permissions && m.hasPermission(m.Permissions.MANAGE_USERS))
        );
    }

    function getAvailableProperties() {
        const list = typeof window.getCatalogProperties === "function"
            ? window.getCatalogProperties()
            : [];
        const checkAvailable = typeof window.isPropertyAvailable === "function"
            ? window.isPropertyAvailable
            : (p) => p && p.status !== "no_disponible" && p.available !== false && p.disponible !== false;
        return list.filter(checkAvailable);
    }

    function matchesType(prop, typeId) {
        if (typeof window.matchesSelectedPropertyType === "function") {
            return window.matchesSelectedPropertyType(prop, typeId);
        }
        const raw = String(prop.propertyType || prop.type || "").toLowerCase();
        return raw.includes(typeId);
    }

    function getCategoryLabel(prop) {
        for (const opt of CATEGORY_OPTIONS) {
            if (matchesType(prop, opt.id)) {
                return opt.label.replace(/s$/, "");
            }
        }
        const raw = String(prop.propertyType || prop.type || "").trim();
        return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Propiedad";
    }

    function getOperationKey(prop) {
        const op = String(prop.category || prop.operation || "").toLowerCase();
        if (op.includes("alquiler")) return "alquiler";
        return "venta";
    }

    function getOperationLabel(prop) {
        return getOperationKey(prop) === "alquiler" ? "ALQUILER" : "VENTA";
    }

    function formatPricePdf(price, currency) {
        const num = Number(price || 0);
        if (!num || isNaN(num)) return "Consultar";
        const cur = String(currency || "USD").toUpperCase();
        const prefix = cur === "ARS" ? "AR$" : "U$D";
        const formatted = num.toLocaleString("es-AR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return `${prefix} ${formatted}`;
    }

    function sanitizePdfText(str) {
        return String(str || "")
            .replace(/[\r\n\t]+/g, " ")
            .replace(/\s+/g, " ")
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
            .trim();
    }

    function getFilteredProperties() {
        const available = getAvailableProperties();
        const query = pdfState.searchText.trim().toLowerCase();

        const filtered = available.filter((prop) => {
            if (pdfState.selectedOps.size > 0) {
                if (!pdfState.selectedOps.has(getOperationKey(prop))) return false;
            }
            if (pdfState.selectedTypes.size > 0) {
                let matched = false;
                for (const tId of pdfState.selectedTypes) {
                    if (matchesType(prop, tId)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) return false;
            }
            if (pdfState.currency !== "todas") {
                const cur = String(prop.currency || "USD").toUpperCase();
                if (cur !== pdfState.currency) return false;
            }
            if (query) {
                const haystack = [
                    prop.title,
                    prop.description,
                    prop.barrio,
                    prop.zone,
                    prop.neighborhood,
                    prop.location,
                    prop.address,
                    prop.propertyType,
                    prop.category
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });

        switch (pdfState.sort) {
            case "price-asc":
                filtered.sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity));
                break;
            case "price-desc":
                filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
                break;
            case "recent":
                filtered.sort((a, b) => (Number(b.createdAtTs) || 0) - (Number(a.createdAtTs) || 0));
                break;
            case "type-op":
            default:
                filtered.sort((a, b) => {
                    const opCmp = getOperationKey(a).localeCompare(getOperationKey(b));
                    if (opCmp !== 0) return opCmp;
                    const typeCmp = getCategoryLabel(a).localeCompare(getCategoryLabel(b));
                    if (typeCmp !== 0) return typeCmp;
                    return (Number(a.price) || Infinity) - (Number(b.price) || Infinity);
                });
                break;
        }

        return filtered;
    }

    function buildFilterSummaryText() {
        const parts = [];
        if (pdfState.selectedTypes.size === 0) {
            parts.push("Todas las categorías");
        } else {
            const labels = CATEGORY_OPTIONS
                .filter((o) => pdfState.selectedTypes.has(o.id))
                .map((o) => o.label);
            parts.push(labels.join(", "));
        }

        if (pdfState.selectedOps.size === 1) {
            parts.push(pdfState.selectedOps.has("venta") ? "En Venta" : "En Alquiler");
        } else {
            parts.push("Venta y Alquiler");
        }

        if (pdfState.currency !== "todas") {
            parts.push(pdfState.currency === "USD" ? "En U$D" : "En AR$");
        }
        if (pdfState.searchText.trim()) {
            parts.push(`"${pdfState.searchText.trim()}"`);
        }

        if (
            pdfState.selectedTypes.size === 0 &&
            pdfState.selectedOps.size === 0 &&
            pdfState.currency === "todas" &&
            !pdfState.searchText.trim()
        ) {
            return "Catálogo completo de propiedades disponibles";
        }
        return parts.join(" · ");
    }

    function buildFileName() {
        const today = new Date().toISOString().slice(0, 10);
        const slugParts = ["Davalos-Propiedades"];
        if (pdfState.selectedTypes.size > 0 && pdfState.selectedTypes.size <= 3) {
            const typeSlug = CATEGORY_OPTIONS
                .filter((o) => pdfState.selectedTypes.has(o.id))
                .map((o) => o.id)
                .join("-");
            slugParts.push(typeSlug);
        } else {
            slugParts.push("Catalogo");
        }
        if (pdfState.selectedOps.size === 1) {
            slugParts.push(pdfState.selectedOps.has("venta") ? "Venta" : "Alquiler");
        }
        slugParts.push(today);
        return `${slugParts.join("-")}.pdf`;
    }

    function renderChipsAndPreview() {
        const available = getAvailableProperties();

        // Actualizar chips de operación
        document.querySelectorAll("#pdf-op-chips .pdf-chip").forEach((btn) => {
            const op = btn.dataset.pdfOp;
            const count = available.filter((p) => getOperationKey(p) === op).length;
            const baseLabel = op === "venta" ? "En Venta" : "En Alquiler";
            btn.textContent = `${baseLabel} (${count})`;
            btn.classList.toggle("active", pdfState.selectedOps.has(op));
        });

        // Renderizar chips de categorías con conteo en vivo (respetando filtro de operación)
        const typeWrap = document.getElementById("pdf-type-chips");
        if (typeWrap) {
            const opFiltered = pdfState.selectedOps.size > 0
                ? available.filter((p) => pdfState.selectedOps.has(getOperationKey(p)))
                : available;

            typeWrap.innerHTML = CATEGORY_OPTIONS.map((opt) => {
                const count = opFiltered.filter((p) => matchesType(p, opt.id)).length;
                const active = pdfState.selectedTypes.has(opt.id);
                return `
                    <button type="button" class="pdf-chip ${active ? "active" : ""} ${count === 0 ? "is-empty" : ""}" data-pdf-type="${opt.id}">
                        ${opt.label} <span class="pdf-chip-count">(${count})</span>
                    </button>
                `;
            }).join("");
        }

        // Vista previa de propiedades filtradas
        const filtered = getFilteredProperties();
        const countEl = document.getElementById("pdf-preview-count");
        const summaryEl = document.getElementById("pdf-preview-summary");
        const listEl = document.getElementById("pdf-preview-list");
        const genBtn = document.getElementById("btn-generate-pdf-catalog");

        if (countEl) {
            countEl.textContent = `${filtered.length} propiedad${filtered.length === 1 ? "" : "es"} disponible${filtered.length === 1 ? "" : "s"}`;
        }
        if (summaryEl) {
            summaryEl.textContent = buildFilterSummaryText();
        }
        if (genBtn && !pdfState.isGenerating) {
            genBtn.disabled = filtered.length === 0;
            genBtn.textContent = filtered.length > 0
                ? `Descargar PDF (${filtered.length})`
                : "Sin propiedades para exportar";
        }
        if (listEl) {
            if (filtered.length === 0) {
                listEl.innerHTML = `<div class="pdf-preview-empty">No hay propiedades disponibles que coincidan con esta combinación de filtros.</div>`;
            } else {
                const maxShow = 12;
                const rowsHtml = filtered.slice(0, maxShow).map((p) => {
                    const opLabel = getOperationLabel(p);
                    const price = formatPricePdf(p.price, p.currency);
                    const safeTitle = String(p.title || "Propiedad").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `
                        <div class="pdf-preview-row">
                            <span class="pdf-preview-tag pdf-tag-${getOperationKey(p)}">${opLabel}</span>
                            <span class="pdf-preview-title">${safeTitle}</span>
                            <span class="pdf-preview-price">${price}</span>
                        </div>
                    `;
                }).join("");
                const moreHtml = filtered.length > maxShow
                    ? `<div class="pdf-preview-more">+ ${filtered.length - maxShow} propiedad(es) más incluidas en el PDF...</div>`
                    : "";
                listEl.innerHTML = rowsHtml + moreHtml;
            }
        }
    }

    function openPdfCatalogModal() {
        if (!isAuthorizedAdmin()) {
            alert("Esta función es exclusiva para administradores.");
            return;
        }
        const modal = document.getElementById("pdf-catalog-modal");
        if (!modal) return;

        // Cerrar drawer si está abierto
        const drawer = document.getElementById("admin-drawer");
        const overlay = document.getElementById("admin-drawer-overlay");
        if (drawer) drawer.classList.remove("active");
        if (overlay) overlay.classList.remove("active");

        const statusEl = document.getElementById("pdf-export-status");
        if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = "";
        }

        renderChipsAndPreview();
        modal.classList.add("active");
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function closePdfCatalogModal() {
        const modal = document.getElementById("pdf-catalog-modal");
        if (!modal) return;
        modal.classList.remove("active");
        modal.style.display = "none";
        document.body.style.overflow = "";
    }

    // ==================== IMAGE / LOGO CANVAS HELPERS ====================
    function loadImageAsDataUrl(url, options = {}) {
        const {
            width = 360,
            height = 250,
            cover = true,
            invertToWhite = false,
            timeoutMs = 3500
        } = options;

        return new Promise((resolve) => {
            if (!url) {
                resolve(null);
                return;
            }
            let settled = false;
            const done = (val) => {
                if (!settled) {
                    settled = true;
                    resolve(val);
                }
            };
            const timer = setTimeout(() => done(null), timeoutMs);

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const canvas = document.createElement("canvas");
                    const naturalW = img.naturalWidth || width;
                    const naturalH = img.naturalHeight || height;

                    if (cover) {
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        ctx.fillStyle = "#f4f3ef";
                        ctx.fillRect(0, 0, width, height);

                        const scale = Math.max(width / naturalW, height / naturalH);
                        const drawW = naturalW * scale;
                        const drawH = naturalH * scale;
                        const dx = (width - drawW) / 2;
                        const dy = (height - drawH) / 2;
                        ctx.drawImage(img, dx, dy, drawW, drawH);
                        done({ dataUrl: canvas.toDataURL("image/jpeg", 0.84), format: "JPEG", aspect: width / height });
                    } else {
                        const scale = Math.min(width / naturalW, height / naturalH);
                        const drawW = Math.max(1, Math.round(naturalW * scale));
                        const drawH = Math.max(1, Math.round(naturalH * scale));
                        canvas.width = drawW;
                        canvas.height = drawH;
                        const ctx = canvas.getContext("2d");
                        if (invertToWhite) {
                            ctx.filter = "brightness(0) invert(1)";
                        }
                        ctx.drawImage(img, 0, 0, drawW, drawH);
                        done({ dataUrl: canvas.toDataURL("image/png"), format: "PNG", aspect: drawW / drawH });
                    }
                } catch (_) {
                    done(null);
                }
            };
            img.onerror = () => {
                clearTimeout(timer);
                done(null);
            };
            img.src = url;
        });
    }

    function getMainPropertyImageUrl(prop) {
        if (Array.isArray(prop.images) && prop.images.length > 0) {
            const first = prop.images[0];
            if (typeof first === "string" && first.trim()) return first.trim();
            if (first && typeof first.url === "string" && first.url.trim()) return first.url.trim();
        }
        if (typeof prop.image === "string" && prop.image.trim()) return prop.image.trim();
        return "";
    }

    function buildSpecsLine(prop) {
        const specs = [];
        const beds = Number(prop.bedrooms || prop.rooms || 0);
        const baths = Number(prop.bathrooms || 0);
        const areaCov = Number(prop.areaCovered || 0);
        const areaTot = Number(prop.areaTotal || prop.area || 0);

        if (beds > 0) specs.push(`${beds} dorm.`);
        if (baths > 0) specs.push(`${baths} baño${baths === 1 ? "" : "s"}`);
        if (areaCov > 0) specs.push(`${areaCov} m2 cub.`);
        if (areaTot > 0 && areaTot !== areaCov) specs.push(`${areaTot} m2 tot.`);
        else if (areaTot > 0 && areaCov === 0) specs.push(`${areaTot} m2`);

        if (Array.isArray(prop.customFeatures) && prop.customFeatures.length > 0) {
            const extras = prop.customFeatures
                .slice(0, 3)
                .map((f) => (typeof f === "string" ? f : (f && f.name ? (f.qty ? `${f.name}: ${f.qty}` : f.name) : "")))
                .filter(Boolean);
            extras.forEach((ex) => {
                if (specs.length < 5) specs.push(ex);
            });
        }

        return sanitizePdfText(specs.join("  ·  "));
    }

    function getPropertyLocation(prop) {
        const parts = [prop.barrio || prop.zone || prop.neighborhood || "", prop.city || ""].filter(Boolean);
        if (parts.length > 0) return sanitizePdfText(parts.join(", "));
        if (prop.location) return sanitizePdfText(prop.location);
        return "";
    }

    function getPropertyWebUrl(prop) {
        const base = (window.location.origin && window.location.origin.startsWith("http"))
            ? window.location.origin
            : "https://davalospropiedades.com.ar";
        const id = encodeURIComponent(prop.docId || prop.id || "");
        return `${base}/details.html?id=${id}`;
    }

    // ==================== PDF GENERATION ====================
    async function generatePdfCatalog() {
        if (pdfState.isGenerating) return;
        const filtered = getFilteredProperties();
        if (filtered.length === 0) return;

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("No se pudo cargar el generador de PDF. Recargá la página e intentá nuevamente.");
            return;
        }

        const btn = document.getElementById("btn-generate-pdf-catalog");
        const statusEl = document.getElementById("pdf-export-status");
        pdfState.isGenerating = true;
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Generando PDF...";
        }
        if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent = "Preparando logo y portada corporativa...";
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

            const pageW = 210;
            const pageH = 297;
            const marginX = 14;
            const contentW = pageW - marginX * 2;
            const footerY = pageH - 12;

            // Paleta oficial Dávalos Propiedades
            const NAVY = [5, 14, 54];       // #050e36
            const NAVY_SOFT = [24, 43, 107]; // #182b6b
            const IVORY = [244, 243, 239];  // #f4f3ef
            const BORDER = [224, 221, 213]; // #e0ddd5
            const TEXT_DARK = [17, 24, 39];
            const TEXT_MUTED = [100, 116, 139];
            const ACCENT_RENT = [30, 64, 175];

            const cfg = window.SITE_CONFIG || {};
            const brandName = sanitizePdfText(cfg.brand?.upperName || "DÁVALOS PROPIEDADES");
            const logoUrl = cfg.assets?.logoHeader || "assets/images/logo-horizontal.svg";
            const contactLine = sanitizePdfText(
                `${brandName} · MP N° 96 · Del Milagro 635, Salta · davalospropiedades.com.ar`
            );
            const whatsappDisplay = sanitizePdfText(cfg.contact?.whatsappDisplay || "+54 9 387 415-5902");
            const dateStr = new Date().toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });

            // 1. Cargar logo en blanco para header azul marino
            const logoImg = await loadImageAsDataUrl(logoUrl, {
                width: 480,
                height: 120,
                cover: false,
                invertToWhite: true,
                timeoutMs: 3000
            });

            // 2. Precargar fotos en lotes si el usuario lo solicitó
            const photoMap = new Map();
            if (pdfState.includePhotos) {
                const batchSize = 6;
                for (let i = 0; i < filtered.length; i += batchSize) {
                    if (statusEl) {
                        statusEl.textContent = `Procesando imágenes (${Math.min(i + batchSize, filtered.length)}/${filtered.length})...`;
                    }
                    const slice = filtered.slice(i, i + batchSize);
                    await Promise.all(
                        slice.map(async (prop) => {
                            const url = getMainPropertyImageUrl(prop);
                            if (!url) return;
                            const imgData = await loadImageAsDataUrl(url, {
                                width: 320,
                                height: 225,
                                cover: true,
                                timeoutMs: 3500
                            });
                            if (imgData) photoMap.set(prop.docId || prop.id, imgData);
                        })
                    );
                }
            }

            if (statusEl) {
                statusEl.textContent = "Maquetando documento PDF...";
            }

            // Helper para header de página 1 (completo) y páginas siguientes (compacto)
            const drawFirstPageHeader = () => {
                // Banda azul marino superior
                doc.setFillColor(...NAVY);
                doc.rect(0, 0, pageW, 34, "F");

                if (logoImg) {
                    const maxLogoH = 14;
                    const logoW = Math.min(68, maxLogoH * logoImg.aspect);
                    const logoH = logoW / logoImg.aspect;
                    doc.addImage(logoImg.dataUrl, logoImg.format, marginX, 10 + (14 - logoH) / 2, logoW, logoH);
                } else {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(16);
                    doc.setTextColor(244, 243, 239);
                    doc.text(brandName, marginX, 19);
                }

                // Datos institucionales a la derecha
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.2);
                doc.setTextColor(215, 222, 240);
                doc.text("MP N° 96 · Del Milagro 635, Salta", pageW - marginX, 12.5, { align: "right" });
                doc.text(`WhatsApp: ${whatsappDisplay}`, pageW - marginX, 18, { align: "right" });
                doc.text(`Emitido el ${sanitizePdfText(dateStr)}`, pageW - marginX, 23.5, { align: "right" });

                // Banda marfil de título y filtros
                doc.setFillColor(...IVORY);
                doc.rect(0, 34, pageW, 22, "F");
                doc.setDrawColor(...BORDER);
                doc.setLineWidth(0.35);
                doc.line(0, 56, pageW, 56);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(13.5);
                doc.setTextColor(...NAVY);
                doc.text("CATÁLOGO DE PROPIEDADES DISPONIBLES", marginX, 43.5);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.8);
                doc.setTextColor(...TEXT_MUTED);
                const summaryLine = sanitizePdfText(`${buildFilterSummaryText()}  ·  ${filtered.length} propiedad${filtered.length === 1 ? "" : "es"}`);
                const wrappedSummary = doc.splitTextToSize(summaryLine, contentW);
                doc.text(wrappedSummary[0] || summaryLine, marginX, 50.5);

                return 63; // y inicial para tarjetas
            };

            const drawContinuationHeader = () => {
                doc.setFillColor(...NAVY);
                doc.rect(0, 0, pageW, 18, "F");

                if (logoImg) {
                    const maxLogoH = 8.5;
                    const logoW = Math.min(42, maxLogoH * logoImg.aspect);
                    const logoH = logoW / logoImg.aspect;
                    doc.addImage(logoImg.dataUrl, logoImg.format, marginX, (18 - logoH) / 2, logoW, logoH);
                } else {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(11);
                    doc.setTextColor(244, 243, 239);
                    doc.text(brandName, marginX, 11.5);
                }

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(215, 222, 240);
                doc.text("CATÁLOGO DE PROPIEDADES DISPONIBLES", pageW - marginX, 11.2, { align: "right" });
                return 25;
            };

            let y = drawFirstPageHeader();
            const cardH = pdfState.includePhotos ? 38 : 30;
            const cardGap = 4.5;

            filtered.forEach((prop) => {
                if (y + cardH > footerY - 6) {
                    doc.addPage();
                    y = drawContinuationHeader();
                }

                // Contenedor de tarjeta
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...BORDER);
                doc.setLineWidth(0.35);
                doc.roundedRect(marginX, y, contentW, cardH, 2.5, 2.5, "FD");

                // Barra de acento vertical izquierda
                const isRent = getOperationKey(prop) === "alquiler";
                doc.setFillColor(...(isRent ? ACCENT_RENT : NAVY));
                doc.rect(marginX, y + 0.3, 1.8, cardH - 0.6, "F");

                let textX = marginX + 5.5;
                const rightColW = 42;

                // Foto principal
                if (pdfState.includePhotos) {
                    const photoW = 42;
                    const photoH = cardH - 6;
                    const photoX = marginX + 4.5;
                    const photoY = y + 3;
                    const imgData = photoMap.get(prop.docId || prop.id);

                    if (imgData) {
                        doc.addImage(imgData.dataUrl, imgData.format, photoX, photoY, photoW, photoH);
                    } else {
                        doc.setFillColor(...IVORY);
                        doc.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, "F");
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(10);
                        doc.setTextColor(148, 163, 184);
                        doc.text("DP", photoX + photoW / 2, photoY + photoH / 2 + 1.5, { align: "center" });
                    }
                    textX = photoX + photoW + 4.5;
                }

                const centerW = pageW - marginX - rightColW - textX - 4;
                let curY = y + 6.5;

                // Pill operación + tipo de propiedad
                const opLabel = getOperationLabel(prop);
                const catLabel = sanitizePdfText(getCategoryLabel(prop)).toUpperCase();
                doc.setFillColor(...(isRent ? ACCENT_RENT : NAVY));
                const badgeW = isRent ? 18 : 14;
                doc.roundedRect(textX, curY - 3.3, badgeW, 4.6, 1, 1, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.6);
                doc.setTextColor(255, 255, 255);
                doc.text(opLabel, textX + badgeW / 2, curY, { align: "center" });

                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(...TEXT_MUTED);
                doc.text(catLabel, textX + badgeW + 2.5, curY);

                // Título
                curY += 5.2;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...TEXT_DARK);
                const titleLines = doc.splitTextToSize(sanitizePdfText(prop.title || "Propiedad"), centerW).slice(0, 2);
                doc.text(titleLines, textX, curY);
                curY += titleLines.length * 4.2 + 0.8;

                // Ubicación
                const loc = getPropertyLocation(prop);
                if (loc) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.8);
                    doc.setTextColor(...TEXT_MUTED);
                    const locLine = doc.splitTextToSize(loc, centerW)[0];
                    doc.text(locLine, textX, curY);
                    curY += 4;
                }

                // Características clave
                const specs = buildSpecsLine(prop);
                if (specs) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.6);
                    doc.setTextColor(...NAVY_SOFT);
                    const specsLine = doc.splitTextToSize(specs, centerW)[0];
                    doc.text(specsLine, textX, curY);
                    curY += 4;
                }

                // Breve extracto de descripción si queda espacio
                const remainingBottom = y + cardH - 3.5;
                if (prop.description && curY + 2 <= remainingBottom) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.3);
                    doc.setTextColor(100, 116, 139);
                    const descLines = doc.splitTextToSize(sanitizePdfText(prop.description), centerW);
                    const single = descLines[0] || "";
                    doc.text(descLines.length > 1 ? `${single.slice(0, Math.max(0, single.length - 3))}...` : single, textX, curY);
                }

                // Columna derecha: Precio + Expensas + Enlace online
                const rightEdgeX = pageW - marginX - 4;
                doc.setDrawColor(235, 233, 227);
                doc.setLineWidth(0.25);
                doc.line(pageW - marginX - rightColW - 1.5, y + 4, pageW - marginX - rightColW - 1.5, y + cardH - 4);

                const priceStr = formatPricePdf(prop.price, prop.currency);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11.5);
                doc.setTextColor(...NAVY);
                doc.text(priceStr, rightEdgeX, y + 12, { align: "right" });

                if (Number(prop.expensasAmount) > 0) {
                    const expStr = `+ ${formatPricePdf(prop.expensasAmount, prop.expensasCurrency || "ARS")} exp.`;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.2);
                    doc.setTextColor(...TEXT_MUTED);
                    doc.text(expStr, rightEdgeX, y + 17, { align: "right" });
                }

                if (pdfState.includeLinks) {
                    const linkLabel = "Ver ficha online ->";
                    const linkY = y + cardH - 6.5;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.8);
                    doc.setTextColor(...ACCENT_RENT);
                    doc.text(linkLabel, rightEdgeX, linkY, { align: "right" });
                    const linkW = doc.getTextWidth(linkLabel);
                    doc.link(rightEdgeX - linkW, linkY - 3.5, linkW, 5, { url: getPropertyWebUrl(prop) });
                }

                y += cardH + cardGap;
            });

            // 3. Pie de página numerado en todas las páginas
            const totalPages = doc.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setDrawColor(...BORDER);
                doc.setLineWidth(0.3);
                doc.line(marginX, footerY - 4, pageW - marginX, footerY - 4);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(...TEXT_MUTED);
                doc.text(contactLine, marginX, footerY);
                doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, footerY, { align: "right" });
            }

            doc.save(buildFileName());
            if (statusEl) {
                statusEl.textContent = `¡Listo! Se descargó el PDF con ${filtered.length} propiedad${filtered.length === 1 ? "" : "es"}.`;
            }
        } catch (err) {
            console.error("[PDF Catalog] Error generando PDF:", err);
            alert("Ocurrió un error al generar el PDF. Intentá nuevamente.");
        } finally {
            pdfState.isGenerating = false;
            renderChipsAndPreview();
        }
    }

    // ==================== EVENT BINDING ====================
    function initPdfCatalogUI() {
        const openBtn = document.getElementById("btn-export-pdf-catalog");
        const modal = document.getElementById("pdf-catalog-modal");
        if (!openBtn || !modal) return;

        openBtn.addEventListener("click", openPdfCatalogModal);

        const closeBtn = document.getElementById("btn-close-pdf-modal");
        const cancelBtn = document.getElementById("btn-cancel-pdf-modal");
        if (closeBtn) closeBtn.addEventListener("click", closePdfCatalogModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closePdfCatalogModal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) closePdfCatalogModal();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("active")) {
                closePdfCatalogModal();
            }
        });

        // Presets rápidos
        document.querySelectorAll("[data-pdf-preset]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const preset = btn.dataset.pdfPreset;
                pdfState.selectedOps.clear();
                pdfState.selectedTypes.clear();
                pdfState.currency = "todas";
                pdfState.searchText = "";
                const curSel = document.getElementById("pdf-filter-currency");
                const txtInp = document.getElementById("pdf-filter-text");
                if (curSel) curSel.value = "todas";
                if (txtInp) txtInp.value = "";

                if (preset === "venta") pdfState.selectedOps.add("venta");
                else if (preset === "alquiler") pdfState.selectedOps.add("alquiler");

                renderChipsAndPreview();
            });
        });

        // Chips de operación (acumulables)
        document.querySelectorAll("#pdf-op-chips .pdf-chip").forEach((btn) => {
            btn.addEventListener("click", () => {
                const op = btn.dataset.pdfOp;
                if (pdfState.selectedOps.has(op)) pdfState.selectedOps.delete(op);
                else pdfState.selectedOps.add(op);
                renderChipsAndPreview();
            });
        });

        // Chips de categorías (delegado, acumulables)
        const typeWrap = document.getElementById("pdf-type-chips");
        if (typeWrap) {
            typeWrap.addEventListener("click", (e) => {
                const chip = e.target.closest("[data-pdf-type]");
                if (!chip) return;
                const tId = chip.dataset.pdfType;
                if (pdfState.selectedTypes.has(tId)) pdfState.selectedTypes.delete(tId);
                else pdfState.selectedTypes.add(tId);
                renderChipsAndPreview();
            });
        }

        // Selects e inputs
        const curSel = document.getElementById("pdf-filter-currency");
        if (curSel) {
            curSel.addEventListener("change", (e) => {
                pdfState.currency = e.target.value;
                renderChipsAndPreview();
            });
        }
        const sortSel = document.getElementById("pdf-filter-sort");
        if (sortSel) {
            sortSel.addEventListener("change", (e) => {
                pdfState.sort = e.target.value;
                renderChipsAndPreview();
            });
        }
        const textInp = document.getElementById("pdf-filter-text");
        if (textInp) {
            textInp.addEventListener("input", (e) => {
                pdfState.searchText = e.target.value || "";
                renderChipsAndPreview();
            });
        }
        const optPhotos = document.getElementById("pdf-opt-photos");
        if (optPhotos) {
            optPhotos.addEventListener("change", (e) => {
                pdfState.includePhotos = e.target.checked;
            });
        }
        const optLinks = document.getElementById("pdf-opt-links");
        if (optLinks) {
            optLinks.addEventListener("change", (e) => {
                pdfState.includeLinks = e.target.checked;
            });
        }

        const genBtn = document.getElementById("btn-generate-pdf-catalog");
        if (genBtn) genBtn.addEventListener("click", generatePdfCatalog);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPdfCatalogUI);
    } else {
        initPdfCatalogUI();
    }

    window.openPdfCatalogModal = openPdfCatalogModal;
})();
