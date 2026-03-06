import { getData } from "./electron-storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface Project {
    id: string;
    name: string;
    articleNumber?: string;
    status: string;
    customer?: string;
    createdAt: string;
    updatedAt: string;
    timeline: any[];
    currentRecipe?: any;
    latestResult?: any;
    processFlow?: string;
    isNewProcess?: boolean;
    riskAnalysis?: string;
    fmeaData?: any;
    sensory?: {
        appearance?: string;
        odor?: string;
        taste?: string;
        texture?: string;
        dimensions?: {
            length?: string;
            diameter?: string;
            weight?: string;
        };
        preparation?: string;
    };
    processSettings?: any;
    checklist?: any;
    productIdea?: string;
    productImage?: string;
    customerAgreements?: string;
    notes?: string;
}

// ─── Color Palette ───
const C = {
    primary:  [30, 64, 110] as [number, number, number],   // Dark blue
    accent:   [41, 128, 185] as [number, number, number],   // Medium blue
    light:    [235, 243, 250] as [number, number, number],  // Very light blue
    success:  [39, 174, 96] as [number, number, number],    // Green
    warning:  [243, 156, 18] as [number, number, number],   // Amber
    danger:   [231, 76, 60] as [number, number, number],    // Red
    gray:     [120, 120, 120] as [number, number, number],
    grayLight:[240, 240, 240] as [number, number, number],
    white:    [255, 255, 255] as [number, number, number],
    black:    [33, 33, 33] as [number, number, number],
};

export const generateProjectPDF = (project: Project) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - 2 * margin;

    // ─── Helper: Remaining space on page ───
    const remainingSpace = (y: number) => pageH - y - 20; // 20 = footer reserve

    // ─── Helper: Ensure enough space, add page if not ───
    const ensureSpace = (y: number, needed: number, title?: string): number => {
        if (remainingSpace(y) < needed) {
            doc.addPage();
            return addHeader(title || "");
        }
        return y;
    };

    // ─── Page Header ───
    const addHeader = (pageTitle: string): number => {
        // Thin colored bar
        doc.setFillColor(C.primary[0], C.primary[1], C.primary[2]);
        doc.rect(0, 0, pageW, 14, 'F');

        // Title in bar
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(pageTitle, margin, 9.5);

        // Right: project name + date
        const maxLen = 45;
        let shortName = project.name.length > maxLen ? project.name.substring(0, maxLen) + "…" : project.name;
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`${shortName}  |  ${format(new Date(), "dd.MM.yyyy")}`, pageW - margin, 9.5, { align: "right" });

        doc.setTextColor(C.black[0], C.black[1], C.black[2]);
        return 22; // content start Y
    };

    // ─── Section title ───
    const sectionTitle = (y: number, text: string, color?: [number, number, number]): number => {
        const c = color || C.primary;
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(margin, y, 3, 6, 'F'); // accent bar
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(c[0], c[1], c[2]);
        doc.text(text, margin + 6, y + 5);
        doc.setTextColor(C.black[0], C.black[1], C.black[2]);
        doc.setFont("helvetica", "normal");
        return y + 10;
    };

    // ═══════════════════════════════════════════════
    // PAGE 1: STAMMDATEN
    // ═══════════════════════════════════════════════
    let yPos = addHeader("Projektzusammenfassung");

    // Title
    doc.setFontSize(16);
    doc.setTextColor(C.primary[0], C.primary[1], C.primary[2]);
    doc.setFont("helvetica", "bold");
    const splitTitle = doc.splitTextToSize(project.name, 120);
    doc.text(splitTitle, margin, yPos + 4);
    yPos += splitTitle.length * 7 + 6;
    doc.setTextColor(C.black[0], C.black[1], C.black[2]);

    // Image (right side)
    const imgX = 148, imgY = 24, imgW = 46, imgH = 46;
    let displayImage = project.productImage;
    if (!displayImage && project.timeline) {
        const imgs = project.timeline.filter((e: any) =>
            e.type === 'file' && e.attachmentContent &&
            ((e.attachmentType && e.attachmentType.startsWith('image/')) ||
             (e.attachment && /\.(jpg|jpeg|png|webp)$/i.test(e.attachment)))
        );
        if (imgs.length > 0) displayImage = imgs.sort((a: any, b: any) => b.id - a.id)[0].attachmentContent;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    if (displayImage) {
        try {
            let fmt = 'JPEG';
            if (displayImage.startsWith('data:image/png')) fmt = 'PNG';
            const props = doc.getImageProperties(displayImage);
            const ratio = props.width / props.height;
            let w = imgW, h = w / ratio;
            if (h > imgH) { h = imgH; w = h * ratio; }
            doc.addImage(displayImage, fmt, imgX + (imgW - w) / 2, imgY + (imgH - h) / 2, w, h);
            doc.rect(imgX, imgY, imgW, imgH);
        } catch {
            doc.rect(imgX, imgY, imgW, imgH);
            doc.setFontSize(7); doc.setTextColor(150, 150, 150);
            doc.text("Bild-Fehler", imgX + imgW / 2, imgY + imgH / 2, { align: 'center', baseline: 'middle' });
            doc.setTextColor(C.black[0], C.black[1], C.black[2]);
        }
    } else {
        doc.rect(imgX, imgY, imgW, imgH);
        doc.setFontSize(7); doc.setTextColor(180, 180, 180);
        doc.text("Kein Bild", imgX + imgW / 2, imgY + imgH / 2, { align: 'center', baseline: 'middle' });
        doc.setTextColor(C.black[0], C.black[1], C.black[2]);
    }

    // Metadata table (left of image)
    const statusLabel = project.status === 'development' ? 'In Entwicklung' : project.status === 'production' ? 'In Produktion' : project.status;
    autoTable(doc, {
        startY: yPos,
        body: [
            ['Artikelnummer', project.articleNumber || "–"],
            ['Kunde', project.customer || "Allgemein"],
            ['Status', statusLabel],
            ['Erstellt', format(new Date(project.createdAt), "dd.MM.yyyy")],
            ['Letzte Änderung', format(new Date(project.updatedAt), "dd.MM.yyyy")],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32, textColor: C.gray }, 1: { cellWidth: 85 } },
        margin: { left: margin, right: 65 },
    });
    // @ts-ignore
    yPos = Math.max(doc.lastAutoTable.finalY, imgY + imgH) + 8;

    // Produktbeschreibung + Kundenabsprachen
    if (project.productIdea || project.customerAgreements) {
        yPos = sectionTitle(yPos, "Produktbeschreibung");
        doc.setFontSize(9);
        if (project.productIdea) {
            const lines = doc.splitTextToSize(project.productIdea, contentW);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 4 + 3;
        }
        if (project.customerAgreements) {
            doc.setFont("helvetica", "bold");
            doc.text("Kundenabsprachen:", margin, yPos);
            doc.setFont("helvetica", "normal");
            yPos += 4;
            const lines = doc.splitTextToSize(project.customerAgreements, contentW);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 4 + 3;
        }
        yPos += 4;
    }

    // Sensorik (same page if space allows)
    if (project.sensory) {
        const sensoryRows: any[] = [];
        if (project.sensory.appearance) sensoryRows.push(["Aussehen", project.sensory.appearance]);
        if (project.sensory.odor) sensoryRows.push(["Geruch", project.sensory.odor]);
        if (project.sensory.taste) sensoryRows.push(["Geschmack", project.sensory.taste]);
        if (project.sensory.texture) sensoryRows.push(["Konsistenz", project.sensory.texture]);
        if (project.sensory.dimensions) {
            const d = project.sensory.dimensions;
            const parts = [];
            if (d.length) parts.push(`Länge: ${d.length}`);
            if (d.diameter) parts.push(`Kaliber: ${d.diameter}`);
            if (d.weight) parts.push(`Gewicht: ${d.weight}`);
            if (parts.length) sensoryRows.push(["Abmessungen", parts.join("  |  ")]);
        }
        if (project.sensory.preparation) sensoryRows.push(["Zubereitung", project.sensory.preparation]);

        if (sensoryRows.length > 0) {
            const needed = sensoryRows.length * 10 + 20;
            yPos = ensureSpace(yPos, needed, "Sensorik & Eigenschaften");
            yPos = sectionTitle(yPos, "Sensorik & Eigenschaften", C.warning);

            autoTable(doc, {
                startY: yPos,
                body: sensoryRows,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
                columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold', textColor: C.gray } },
                rowPageBreak: 'avoid',
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 6;
        }
    }

    // Checkliste (compact, same page if possible)
    if (project.checklist) {
        yPos = ensureSpace(yPos, 60, "Projektzusammenfassung");
        yPos = sectionTitle(yPos, "Projekt-Checkliste");
        const items = [
            ['Artikelanlage', project.checklist.articleCreated],
            ['Rezeptur', project.checklist.recipeCreated],
            ['Etikett', project.checklist.labelCreated],
            ['Nährwerte', project.checklist.nutritionCreated],
            ['Spezifikation', project.checklist.specCreated],
            ['Prozessparameter', project.checklist.processCreated],
            ['Navision', project.checklist.navisionCreated],
        ];
        const checkRows = items.map(([name, done]) => [name, done ? '✓' : '–']);
        autoTable(doc, {
            startY: yPos,
            body: checkRows,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1.5 },
            columnStyles: {
                0: { cellWidth: 35, textColor: C.gray },
                1: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data: any) => {
                if (data.column.index === 1 && data.section === 'body') {
                    data.cell.styles.textColor = data.cell.raw === '✓' ? C.success : [180, 180, 180];
                }
            },
            margin: { left: margin },
            tableWidth: 50,
            rowPageBreak: 'avoid',
        });
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 6;
    }

    // ═══════════════════════════════════════════════
    // REZEPTUR
    // ═══════════════════════════════════════════════
    if (project.currentRecipe?.ingredients?.length > 0) {
        doc.addPage();
        yPos = addHeader("Rezeptur");

        const rows = project.currentRecipe.ingredients.map((ing: any) => [
            ing.name,
            ing.articleNumber || "–",
            `${ing.rawWeight.toFixed(3)} kg`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Zutat', 'Art.Nr.', 'Menge']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: C.primary, fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 95 }, 2: { halign: 'right', cellWidth: 25 } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            rowPageBreak: 'avoid',
        });
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 6;

        if (project.latestResult) {
            doc.setFontSize(8); doc.setFont("helvetica", "bold");
            doc.text(`Rohmasse: ${project.latestResult.totalRawMass.toFixed(3)} kg    Endgewicht: ${project.latestResult.totalEndWeight.toFixed(3)} kg`, margin, yPos);
            if (project.currentRecipe.cookingLoss > 0) {
                doc.setTextColor(C.danger[0], C.danger[1], C.danger[2]);
                doc.text(`Garverlust: ${project.currentRecipe.cookingLoss}%`, margin + 110, yPos);
                doc.setTextColor(C.black[0], C.black[1], C.black[2]);
            }
            doc.setFont("helvetica", "normal");
            yPos += 8;
        }
    }

    // ═══════════════════════════════════════════════
    // DEKLARATION & NÄHRWERTE (auf einer Seite halten!)
    // ═══════════════════════════════════════════════
    if (project.latestResult) {
        // Estimate total height needed: label text + nutrition table
        const labelLines = project.latestResult.labelText ? doc.splitTextToSize(project.latestResult.labelText, 170).length : 0;
        const estimatedHeight = (labelLines * 4) + 90; // label box + nutrition table

        // Check if it fits on current page, otherwise new page
        if (remainingSpace(yPos) < estimatedHeight) {
            doc.addPage();
            yPos = addHeader("Deklaration & Nährwerte");
        } else {
            yPos = sectionTitle(yPos, "Deklaration & Nährwerte");
        }

        // Label text
        if (project.latestResult.labelText) {
            doc.setFontSize(8); doc.setFont("helvetica", "italic");
            const splitText = doc.splitTextToSize(project.latestResult.labelText, 168);
            const boxH = splitText.length * 3.8 + 8;

            doc.setFillColor(250, 250, 248);
            doc.setDrawColor(210, 210, 210);
            doc.rect(margin, yPos, contentW, boxH, 'FD');
            doc.text(splitText, margin + 4, yPos + 5);
            yPos += boxH + 6;
            doc.setFont("helvetica", "normal");
        }

        // Nährwerte - MUST NOT split across pages
        if (project.latestResult.nutritionPer100g) {
            const nutri = project.latestResult.nutritionPer100g;

            // Ensure the ENTIRE table fits
            yPos = ensureSpace(yPos, 85, "Nährwerte");
            if (yPos < 25) yPos = sectionTitle(yPos, "Nährwerte pro 100 g");
            else { yPos = sectionTitle(yPos, "Nährwerte pro 100 g"); }

            autoTable(doc, {
                startY: yPos,
                head: [['Parameter', 'Wert']],
                body: [
                    ['Energie', `${Math.round(nutri.energyKj)} kJ / ${Math.round(nutri.energyKcal)} kcal`],
                    ['Fett', `${nutri.fat.toFixed(1)} g`],
                    ['  davon ges. Fettsäuren', `${nutri.saturatedFat.toFixed(1)} g`],
                    ['Kohlenhydrate', `${nutri.carbohydrates.toFixed(1)} g`],
                    ['  davon Zucker', `${nutri.sugar.toFixed(1)} g`],
                    ['Eiweiß', `${nutri.protein.toFixed(1)} g`],
                    ['Salz', `${nutri.salt.toFixed(2)} g`],
                    [{ content: 'Technische Werte', colSpan: 2, styles: { fillColor: C.grayLight, fontStyle: 'italic', fontSize: 7 } }],
                    ['Wasser (kalk.)', `${(nutri.water || 0).toFixed(1)} g`],
                    ['Fleischanteil', `${(project.latestResult.meatPercentage || 0).toFixed(1)} %`],
                ],
                theme: 'grid',
                headStyles: { fillColor: C.primary, fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
                columnStyles: { 0: { cellWidth: 55 }, 1: { halign: 'right', cellWidth: 35 } },
                tableWidth: 95,
                rowPageBreak: 'avoid',
                // Force: do NOT break this table across pages
                pageBreak: 'avoid' as any,
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 6;
        }
    }

    // ═══════════════════════════════════════════════
    // PROZESS-PARAMETER
    // ═══════════════════════════════════════════════
    if (project.processSettings) {
        doc.addPage();
        yPos = addHeader("Prozess-Parameter");

        // Version + Flow Diagram in one line
        doc.setFontSize(8);
        doc.text(`Version: ${project.processSettings.version || "1.0"}`, margin, yPos);

        if (project.processFlow) {
            const FLOW_DIAGRAMS = [
                { id: "FD_001", label: "FD_001 Gewürze/Hilfsstoffe" }, { id: "FD_002", label: "FD_002 Auftauen" },
                { id: "FD_003", label: "FD_003 Fleischteilstücke" }, { id: "FD_004", label: "FD_004 Rohe Fleischprodukte" },
                { id: "FD_005", label: "FD_005 Gegarte Fleischprodukte" }, { id: "FD_006", label: "FD_006 Roh-/Kochpökelwaren" },
                { id: "FD_007", label: "FD_007 Brüh-/Kochwurst" }, { id: "FD_008", label: "FD_008 Geschnittene Wurst" },
                { id: "FD_009", label: "FD_009 Bratstraße natur" }, { id: "FD_010", label: "FD_010 Piccata" },
                { id: "FD_011", label: "FD_011 Bratstraße paniert" }, { id: "FD_012", label: "FD_012 Bratstraße mariniert" },
                { id: "FD_013", label: "FD_013 Bratstraße gefüllt" }, { id: "FD_014", label: "FD_014 Bratstraße gefüllt pan." },
                { id: "FD_015", label: "FD_015 Bratstraße belegt" }, { id: "FD_016", label: "FD_016 Kochwurst Kaliber" },
                { id: "FD_017", label: "FD_017 Handelsware" }, { id: "FD_018", label: "FD_018 Suppen/Saucen" },
                { id: "FD_019", label: "FD_019 Zollware" }, { id: "FD_020", label: "FD_020 Bratstraße Kruste" },
                { id: "FD_021", label: "FD_021 Gefüllte Paprika" }, { id: "FD_022", label: "FD_022 Brühwürstchen" },
                { id: "FD_023", label: "FD_023 Krautwickel TK" }, { id: "FD_024", label: "FD_024 Sous vide" },
                { id: "FD_025", label: "FD_025 Vegetarisch paniert roh" }, { id: "FD_026", label: "FD_026 Veg. Taler/Bällchen" },
                { id: "FD_027", label: "FD_027 Veg. Taler paniert" }, { id: "FD_028", label: "FD_028 Sülze" },
                { id: "FD_029", label: "FD_029 Gekochte Fleischartikel" }, { id: "FD_030", label: "FD_030 Veg. Topping" },
                { id: "FD_031", label: "FD_031 Veg. mariniert" }, { id: "FD_032", label: "FD_032 Kommissionierung" },
                { id: "FD_033", label: "FD_033 Fleischkäse" }, { id: "FD_034", label: "FD_034 Zukaufware Spieße" },
                { id: "FD_035", label: "FD_035 Veg. in Form gegart" }, { id: "FD_036", label: "FD_036 Brühwurst geschnitten" },
                { id: "FD_037", label: "FD_037 Rohe Wurst TK" }, { id: "FD_038", label: "FD_038 Brühwurst gewickelt" },
                { id: "FD_039", label: "FD_039 Sous vide gebräunt" }, { id: "FD_040", label: "FD_040 Gef. Paprika gegart" },
                { id: "FD_042", label: "FD_042 Rohpökelwaren" }, { id: "FD_043", label: "FD_043 Veg. gebraten" },
                { id: "FD_044", label: "FD_044 Rohwurst kaltgeräuchert" }, { id: "FD_045", label: "FD_045 Wareneingang" },
                { id: "FD_046", label: "FD_046 Bratstraße gewolft" }, { id: "FD_047", label: "FD_047 Sous vide gesiebt" },
                { id: "FD_048", label: "FD_048 Veg. geschnitten" }, { id: "FD_049", label: "FD_049 Nachpasteurisierung" },
            ];
            let allFlows = [...FLOW_DIAGRAMS];
            try { const cf = getData("quid-custom-flows"); if (cf) allFlows = [...allFlows, ...cf]; } catch {}
            const fd = allFlows.find(f => f.id === project.processFlow);
            doc.text(`Fließdiagramm: ${fd?.label || project.processFlow}`, margin + 50, yPos);
        }
        yPos += 6;

        if (project.processSettings.sections) {
            const processData: any[][] = [];
            project.processSettings.sections.forEach((section: any) => {
                const validFields = section.fields.filter((f: any) => f.value !== undefined && f.value !== null && String(f.value).trim() !== "");
                if (validFields.length > 0) {
                    processData.push([{ content: section.title, colSpan: 2, styles: { fillColor: C.light, fontStyle: 'bold', textColor: C.primary, fontSize: 7 } }]);
                    validFields.forEach((field: any) => processData.push([field.label, field.value]));
                }
            });

            if (processData.length > 0) {
                autoTable(doc, {
                    startY: yPos,
                    body: processData,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
                    columnStyles: { 0: { cellWidth: 60, textColor: C.gray } },
                    rowPageBreak: 'avoid',
                });
                // @ts-ignore
                yPos = doc.lastAutoTable.finalY + 6;
            }
        }
    }

    // ═══════════════════════════════════════════════
    // FMEA
    // ═══════════════════════════════════════════════
    if (project.isNewProcess && project.fmeaData?.hazards?.length > 0) {
        doc.addPage();
        yPos = addHeader("Risikoanalyse (FMEA)");

        // Gefahrenanalyse
        const hazardRows = project.fmeaData.hazards.map((h: any) => [
            h.hazard, h.category, h.severity, h.occurrence, h.severity * h.occurrence, h.measures
        ]);
        autoTable(doc, {
            startY: yPos,
            head: [['Gefährdung', 'Kat.', 'B', 'A', 'RPZ', 'Maßnahmen']],
            body: hazardRows,
            theme: 'grid',
            headStyles: { fillColor: C.warning, textColor: C.black, fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
            columnStyles: { 0: { cellWidth: 45 }, 5: { cellWidth: 50 } },
            rowPageBreak: 'avoid',
        });
        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 8;

        // CCP Tabelle
        if (project.fmeaData.ccps?.length > 0) {
            yPos = ensureSpace(yPos, 30, "FMEA – Entscheidungsbaum");
            yPos = sectionTitle(yPos, "Entscheidungsbaum (CCP/CP)", C.danger);

            autoTable(doc, {
                startY: yPos,
                head: [['Schritt', 'Gefahr', 'Ergebnis', 'Maßnahmen']],
                body: project.fmeaData.ccps.map((c: any) => [c.step, c.hazardType, c.result, c.controlMeasures]),
                theme: 'grid',
                headStyles: { fillColor: [254, 226, 226], textColor: C.black, fontSize: 7 },
                styles: { fontSize: 7, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
                rowPageBreak: 'avoid',
                didParseCell: (data: any) => {
                    if (data.column.index === 2 && data.section === 'body') {
                        if (data.cell.raw === 'CCP') data.cell.styles.textColor = C.danger;
                    }
                },
            });
            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 8;

            // Entscheidungsdetails
            const TREE: Record<string, string> = {
                q1: "Existieren Maßnahmen zur Beherrschung der Gefahr?",
                modification_check: "Ist eine Beherrschung an diesem Schritt für die Sicherheit notwendig?",
                q2: "Ist der Schritt dazu bestimmt, die Gefahr zu eliminieren/reduzieren?",
                q3: "Könnte eine Kontamination inakzeptable Werte erreichen?",
                q4: "Wird ein nachfolgender Schritt die Gefahr eliminieren/reduzieren?",
            };

            const ccpsWithInfo = project.fmeaData.ccps.filter((c: any) =>
                (c.decisionDetails?.length > 0) || c.q1 !== null || c.q2 !== null
            );

            if (ccpsWithInfo.length > 0) {
                yPos = ensureSpace(yPos, 30, "FMEA – Entscheidungsdetails");
                yPos = sectionTitle(yPos, "Entscheidungsdetails & Begründungen");

                ccpsWithInfo.forEach((ccp: any) => {
                    yPos = ensureSpace(yPos, 25, "FMEA – Fortsetzung");

                    doc.setFontSize(8); doc.setFont("helvetica", "bold");
                    doc.text(`${ccp.step || "?"} → ${ccp.result}`, margin, yPos);
                    doc.setFont("helvetica", "normal"); yPos += 4;

                    let rows: any[] = [];
                    if (ccp.decisionDetails?.length > 0) {
                        rows = ccp.decisionDetails.map((d: any) => [
                            d.questionKey.toUpperCase(), d.questionText, d.answer ? "JA" : "NEIN",
                            ccp.questionComments?.[d.questionKey] || ""
                        ]);
                    } else {
                        for (const qk of ["q1", "q2", "q3", "q4"]) {
                            if (ccp[qk] !== null && ccp[qk] !== undefined) {
                                rows.push([qk.toUpperCase(), TREE[qk] || qk, ccp[qk] ? "JA" : "NEIN", ccp.questionComments?.[qk] || ""]);
                            }
                        }
                    }

                    if (rows.length > 0) {
                        autoTable(doc, {
                            startY: yPos,
                            head: [['#', 'Frage', 'Antw.', 'Begründung']],
                            body: rows,
                            theme: 'grid',
                            headStyles: { fillColor: C.light, textColor: C.primary, fontSize: 6 },
                            styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.15 },
                            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 55 }, 2: { cellWidth: 10, halign: 'center' } },
                            rowPageBreak: 'avoid',
                            didParseCell: (data: any) => {
                                if (data.column.index === 2 && data.section === 'body') {
                                    data.cell.styles.textColor = data.cell.raw === 'JA' ? C.success : C.danger;
                                    data.cell.styles.fontStyle = 'bold';
                                }
                            },
                        });
                        // @ts-ignore
                        yPos = doc.lastAutoTable.finalY + 5;
                    }
                });
            }
        }
    }

    // ═══════════════════════════════════════════════
    // TIMELINE
    // ═══════════════════════════════════════════════
    doc.addPage();
    yPos = addHeader("Projekt-Verlauf");

    if (project.timeline.length > 0) {
        autoTable(doc, {
            startY: yPos,
            head: [['Datum', 'Typ', 'Ereignis', 'Benutzer']],
            body: project.timeline.map((e: any) => [e.date, e.type.toUpperCase(), e.title, e.user]),
            theme: 'striped',
            headStyles: { fillColor: C.primary, fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 1.5 },
            columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 3: { cellWidth: 20 } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            rowPageBreak: 'avoid',
        });
    }

    // ═══════════════════════════════════════════════
    // Footer: Seitenzahlen
    // ═══════════════════════════════════════════════
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(170, 170, 170);
        doc.text(`Seite ${i} / ${totalPages}`, pageW - margin, pageH - 8, { align: "right" });
        doc.text(project.name, margin, pageH - 8);
    }

    doc.save(`${project.name.replace(/[^a-z0-9äöüß]/gi, '_')}_Report.pdf`);
};