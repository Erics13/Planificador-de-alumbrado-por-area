
import { Luminaria, Street, Tablero, ConnectionPath, PoleType } from "../types";
import { PHASE_COLORS, POLE_TYPE_COLORS } from "../constants";

export interface BoardExportData {
  tablero: Tablero;
  phaseMapCanvas: HTMLCanvasElement;
  powerMapCanvas: HTMLCanvasElement;
  poleTypeMapCanvas: HTMLCanvasElement;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export const exportToExcel = (luminarias: Luminaria[], tableros: Tablero[]) => {
    const XLSX = window.XLSX;
    if (!XLSX) {
        // No usar alert en un entorno de producción sin UI de usuario
        console.error("Error: La librería de exportación a Excel (xlsx.js) no se ha cargado.");
        return;
    }

    if (luminarias.length === 0) {
        console.warn("No hay luminarias para exportar.");
        return;
    }
    const luminariasData = luminarias.map((lum, index) => ({
        ID: index + 1,
        "ID Tablero": lum.tableroId || 1,
        Latitud: lum.position.lat,
        Longitud: lum.position.lng,
        Potencia_W: lum.potenciaW,
        "Tipo de Columna": lum.tipoColumna,
        Fase: lum.fase || "N/A",
    }));

    const tableroData = tableros.map(tablero => ({
        "ID Tablero": tablero.id,
        Tipo: "Tablero",
        Latitud: tablero.position.lat,
        Longitud: tablero.position.lng,
    }));

    const wsLuminarias = XLSX.utils.json_to_sheet(luminariasData);
    const wsTablero = XLSX.utils.json_to_sheet(tableroData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLuminarias, "Luminarias");
    if(tableros.length > 0) XLSX.utils.book_append_sheet(wb, wsTablero, "Tableros");

    XLSX.writeFile(wb, "Plan_de_Alumbrado.xlsx");
};


const addImageWithTitle = (
    pdf: any, // jsPDF instance
    canvas: HTMLCanvasElement, 
    title: string, 
    legendType: 'phase' | 'power' | 'poleType' | 'none',
    luminariasForLegend: Luminaria[]
) => {
    const PAGE_MARGIN = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (2 * PAGE_MARGIN);

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 0, 0);
    const titleY = PAGE_MARGIN;
    pdf.text(title, pageWidth / 2, titleY, { align: 'center' });

    const mapStartY = titleY + 25;
    
    const legendSpaceReservation = legendType !== 'none' ? 60 : 0; 
    const mapAvailableHeight = pageHeight - mapStartY - PAGE_MARGIN - legendSpaceReservation;
    
    const canvasAspectRatio = canvas.width / canvas.height;
    
    let finalImgWidth = contentWidth;
    let finalImgHeight = finalImgWidth / canvasAspectRatio;

    if (finalImgHeight > mapAvailableHeight) {
        finalImgHeight = mapAvailableHeight;
        finalImgWidth = finalImgHeight * canvasAspectRatio;
    }
    
    const imgX = (pageWidth - finalImgWidth) / 2;
    const imgY = mapStartY;
    
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', imgX, imgY, finalImgWidth, finalImgHeight, undefined, 'FAST');

    const legendStartX = PAGE_MARGIN;
    const legendStartY = imgY + finalImgHeight + 25;

    if (legendStartY > pageHeight - PAGE_MARGIN - 15) { // Check if legend has enough space
        return;
    }
    
    if (legendType === 'phase') {
        const phaseSummary: { [key in (1|2|3)]: { count: number, power: number } } = {
            1: { count: 0, power: 0 }, 2: { count: 0, power: 0 }, 3: { count: 0, power: 0 },
        };
        luminariasForLegend.forEach(lum => {
            if (lum.fase) {
                phaseSummary[lum.fase as 1|2|3].count++;
                phaseSummary[lum.fase as 1|2|3].power += lum.potenciaW;
            }
        });

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(12);
        pdf.text("Resumen de fases", legendStartX, legendStartY);
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        
        let currentLegendX = legendStartX;
        const phases: (1|2|3)[] = [1, 2, 3];
        const itemBaseY = legendStartY + 18;

        phases.forEach(phase => {
            const rgb = hexToRgb(PHASE_COLORS[phase]);
            const summary = phaseSummary[phase];
            if (rgb && summary.count > 0) {
                pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                pdf.circle(currentLegendX + 5, itemBaseY - 3, 5, 'F');
                const text = `Fase ${phase}: ${summary.count} lums, ${summary.power.toLocaleString('de-DE')} W`;
                pdf.text(text, currentLegendX + 15, itemBaseY);
                currentLegendX += pdf.getTextWidth(text) + 30;
            }
        });
    } else if (legendType === 'power') {
        const powerByType = luminariasForLegend.reduce((acc, lum) => {
            const key = `${lum.potenciaW} W`;
            acc.set(key, (acc.get(key) || 0) + 1);
            return acc;
        }, new Map<string, number>());
        
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(12);
        pdf.text("Resumen por tipo de potencia", legendStartX, legendStartY);
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        
        let currentLegendX = legendStartX;
        const powerEntries = Array.from(powerByType.entries());
        const itemY = legendStartY + 18;

        powerEntries.forEach(([potencia, count]) => {
            const text = `• ${potencia}: ${count} lums`;
            pdf.text(text, currentLegendX, itemY);
            currentLegendX += pdf.getTextWidth(text) + 20;
        });
    } else if (legendType === 'poleType') {
        const poleTypeCounts = luminariasForLegend.reduce((acc, lum) => {
            acc.set(lum.tipoColumna, (acc.get(lum.tipoColumna) || 0) + 1);
            return acc;
        }, new Map<PoleType, number>());

        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(12);
        pdf.text("Resumen por Tipo de Columna", legendStartX, legendStartY);
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        
        let currentLegendX = legendStartX;
        const itemBaseY = legendStartY + 18;
        const poleTypes = Object.values(PoleType);

        poleTypes.forEach(type => {
            const count = poleTypeCounts.get(type);
            if (count && count > 0) {
                const colorHex = POLE_TYPE_COLORS[type];
                const rgb = hexToRgb(colorHex);
                if (rgb) {
                    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                    pdf.rect(currentLegendX, itemBaseY - 8, 10, 10, 'F');
                    const text = `${type}: ${count}`;
                    pdf.text(text, currentLegendX + 15, itemBaseY);
                    currentLegendX += pdf.getTextWidth(text) + 30;
                    if (currentLegendX > contentWidth) { // Wrap line if needed
                        currentLegendX = legendStartX;
                    }
                }
            }
        });
    }
}


export const exportToPdf = async (
    perBoardExportData: BoardExportData[],
    allLuminarias: Luminaria[],
    allTableros: Tablero[],
    streets: Street[],
    tableroAddresses: Map<number, string>,
    calculationParams: { voltage: number; cableType: string; powerFactor: number },
    voltageDropResults: Map<number, { [phase: number]: number }>,
    allConnectionPaths: ConnectionPath[]
) => {
    const jspdf = window.jspdf;
    if (!jspdf) {
        console.error("Error: La librería jspdf no se ha cargado.");
        return;
    }

    const { jsPDF } = jspdf;
    
    const pdf = new jsPDF({
        orientation: 'p', // Default, will be changed per page
        unit: 'pt',
        format: 'a4'
    });
    pdf.deletePage(1); // Remove the initial blank page

    const PAGE_MARGIN = 40;

    // --- MAP PAGES PER TABLERO ---
    perBoardExportData.forEach(({ tablero, phaseMapCanvas, powerMapCanvas, poleTypeMapCanvas }) => {
        const luminariasForThisBoard = allLuminarias.filter(l => l.tableroId === tablero.id);
        
        const getMapOrientation = (canvas: HTMLCanvasElement) => {
            const aspectRatio = canvas.width / canvas.height;
            return aspectRatio > 1.2 ? 'landscape' : 'portrait';
        };

        // Page 1 for this board: PHASES MAP
        pdf.addPage(undefined, getMapOrientation(phaseMapCanvas));
        addImageWithTitle(pdf, phaseMapCanvas, `Mapa de Fases - Tablero ${tablero.id}`, 'phase', luminariasForThisBoard);

        // Page 2 for this board: POWER MAP
        pdf.addPage(undefined, getMapOrientation(powerMapCanvas));
        addImageWithTitle(pdf, powerMapCanvas, `Mapa de Potencia - Tablero ${tablero.id}`, 'power', luminariasForThisBoard);
        
        // Page 3 for this board: POLE TYPE MAP
        pdf.addPage(undefined, getMapOrientation(poleTypeMapCanvas));
        addImageWithTitle(pdf, poleTypeMapCanvas, `Mapa de Tipo de Columna - Tablero ${tablero.id}`, 'poleType', luminariasForThisBoard);
    });

    // --- SUMMARY PAGES ---
    pdf.addPage('a4', 'p');
    let currentY = PAGE_MARGIN;
    const summaryPageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(22);
    pdf.text("Resumen del Proyecto de Alumbrado", summaryPageWidth / 2, currentY, { align: 'center' });
    currentY += 40;

    const totalLineLength = streets.reduce((sum, street) => {
        if (street.path.length < 2 || !window.google) return sum;
        return sum + google.maps.geometry.spherical.computeLength(street.path);
    }, 0);
    
    const totalPower = allLuminarias.reduce((sum, lum) => sum + lum.potenciaW, 0);

    pdf.setFontSize(16);
    pdf.text("Resumen General del Proyecto", PAGE_MARGIN, currentY);
    currentY += 20;

    const summaryData = [
        ['Total de Luminarias:', `${allLuminarias.length}`],
        ['Potencia Total General:', `${totalPower.toLocaleString('de-DE')} W`],
        ['Cantidad de Tableros:', `${allTableros.length}`],
        ['Longitud de Calles Aprox.:', `${(totalLineLength / 1000).toFixed(2)} km`],
    ];

    (pdf as any).autoTable({
        body: summaryData,
        startY: currentY,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });
    currentY = (pdf as any).lastAutoTable.finalY + 20;

    allTableros.forEach(tablero => {
        const lumsForTablero = allLuminarias.filter(l => l.tableroId === tablero.id);
        const powerForTablero = lumsForTablero.reduce((sum, lum) => sum + lum.potenciaW, 0);

        const phaseSummary: { [key in (1|2|3)]: { count: number, power: number } } = {
            1: { count: 0, power: 0 }, 2: { count: 0, power: 0 }, 3: { count: 0, power: 0 },
        };
        lumsForTablero.forEach(lum => {
            if (lum.fase) {
                phaseSummary[lum.fase as 1|2|3].count++;
                phaseSummary[lum.fase as 1|2|3].power += lum.potenciaW;
            }
        });

        let totalLengthForTablero = 0;
        if (allConnectionPaths && window.google) {
            const pathsForTablero = allConnectionPaths.filter(p => p.tableroId === tablero.id);
            totalLengthForTablero = pathsForTablero.reduce((sum, p) => {
                if (p.path.length < 2) return sum;
                return sum + google.maps.geometry.spherical.computeLength(p.path);
            }, 0);
        }

        if (currentY > pdf.internal.pageSize.getHeight() - 250) {
            pdf.addPage('a4', 'p');
            currentY = PAGE_MARGIN;
        }

        pdf.setFontSize(14);
        pdf.text(`Resumen Tablero ${tablero.id}`, PAGE_MARGIN, currentY);
        currentY += 15;
        
        const tableroSummaryData = [
          ['Nº Luminarias:', `${lumsForTablero.length}`],
          ['Potencia Total Tablero:', `${powerForTablero.toLocaleString('de-DE')} W`],
          ['Longitud Tendido Aprox.:', `${(totalLengthForTablero / 1000).toFixed(2)} km`],
          ['Ubicación Aprox.:', tableroAddresses.get(tablero.id) || 'No definida'],
        ];

        (pdf as any).autoTable({
          body: tableroSummaryData,
          startY: currentY,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 }, 1: { cellWidth: 'auto'} },
        });
        currentY = (pdf as any).lastAutoTable.finalY + 15;

        const phaseTableData = [
            ['Fase 1 (Verde)', phaseSummary[1].count, `${phaseSummary[1].power.toLocaleString('de-DE')} W`],
            ['Fase 2 (Naranja)', phaseSummary[2].count, `${phaseSummary[2].power.toLocaleString('de-DE')} W`],
            ['Fase 3 (Azul)', phaseSummary[3].count, `${phaseSummary[3].power.toLocaleString('de-DE')} W`],
        ];

        (pdf as any).autoTable({
            head: [['Fase', 'Nº Luminarias', 'Potencia']],
            body: phaseTableData,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10 },
        });
        currentY = (pdf as any).lastAutoTable.finalY + 15;

        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(`Análisis de Caída de Tensión (Cable: ${calculationParams.cableType})`, PAGE_MARGIN, currentY);
        currentY += 15;

        const voltageDropHead = [['Fase', 'Distancia Máx. (m)', 'V (%)', 'V (Volt)', 'Tensión Final (V)', 'Estado']];
        const voltageDropBody = [];

        for (const phase of [1, 2, 3] as const) {
            const distance = tablero.maxPhaseInfo?.[phase]?.distance ?? 0;
            const dropPercent = voltageDropResults.get(tablero.id)?.[phase] ?? 0;
            const dropVolts = (dropPercent / 100) * calculationParams.voltage;
            const finalVoltage = calculationParams.voltage - dropVolts;

            let statusText = 'N/A';
            if (distance > 0) {
                if (dropPercent > 5) {
                    statusText = 'CRÍTICO';
                } else if (dropPercent > 3) {
                    statusText = 'ADVERTENCIA';
                } else {
                    statusText = 'OK';
                }
            }
            
            voltageDropBody.push([
                `Fase ${phase}`,
                distance.toFixed(0),
                dropPercent.toFixed(2) + ' %',
                dropVolts.toFixed(2),
                finalVoltage.toFixed(2),
                statusText
            ]);
        }

        (pdf as any).autoTable({
            head: voltageDropHead,
            body: voltageDropBody,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 9, halign: 'center' },
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 10, halign: 'center' },
            didParseCell: (data: any) => {
                if (data.column.index === 5 && data.row.section === 'body') {
                    const text = data.cell.text[0];
                    if (text === 'CRÍTICO') {
                        data.cell.styles.textColor = [220, 38, 38]; // Red
                        data.cell.styles.fontStyle = 'bold';
                    } else if (text === 'ADVERTENCIA') {
                        data.cell.styles.textColor = [202, 138, 4]; // Darker Yellow
                    } else if (text === 'OK') {
                        data.cell.styles.textColor = [22, 163, 74]; // Green
                    }
                }
            }
        });
        currentY = (pdf as any).lastAutoTable.finalY + 25;
    });

    pdf.save("Resumen_Plan_Alumbrado.pdf");
};
