import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFExportOptions {
  filename?: string;
  title?: string;
  subtitle?: string;
  elementId?: string;
  element?: HTMLElement | null;
  orientation?: 'portrait' | 'landscape';
}

let tempCanvas: HTMLCanvasElement | null = null;
let tempCtx: CanvasRenderingContext2D | null = null;

function getTempCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!tempCanvas) {
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  }
  return tempCtx;
}

/**
 * Direct mathematical conversion from oklab(L a b [/ alpha]) to sRGB {r, g, b, a}
 */
function parseOklabToRgb(colorStr: string): { r: number; g: number; b: number; a: number } | null {
  const match = colorStr.match(/oklab\(\s*([\d.%]+)[\s,]+([-\d.%]+)[\s,]+([-\d.%]+)(?:\s*[/,]\s*([\d.%]+))?\s*\)/i);
  if (!match) return null;

  let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  let a = parseFloat(match[2]);
  let b = parseFloat(match[3]);
  let alpha = match[4] !== undefined ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  if (isNaN(L) || isNaN(a) || isNaN(b)) return null;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLinear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const toSrgb = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };

  return {
    r: toSrgb(rLinear),
    g: toSrgb(gLinear),
    b: toSrgb(bLinear),
    a: Math.max(0, Math.min(1, isNaN(alpha) ? 1 : alpha)),
  };
}

/**
 * Direct mathematical conversion from oklch(L C h [/ alpha]) to sRGB {r, g, b, a}
 */
function parseOklchToRgb(colorStr: string): { r: number; g: number; b: number; a: number } | null {
  const match = colorStr.match(/oklch\(\s*([\d.%]+)[\s,]+([\d.%]+)[\s,]+([-\d.%]+(?:deg|rad|turn)?)(?:\s*[/,]\s*([\d.%]+))?\s*\)/i);
  if (!match) return null;

  let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  let C = parseFloat(match[2]);
  let hStr = match[3];
  let alpha = match[4] !== undefined ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  let h = parseFloat(hStr);
  if (hStr.endsWith('rad')) {
    h = (h * 180) / Math.PI;
  } else if (hStr.endsWith('turn')) {
    h = h * 360;
  }

  if (isNaN(L) || isNaN(C) || isNaN(h)) return null;

  const hRad = (h * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  return parseOklabToRgb(`oklab(${L} ${a} ${b} / ${alpha})`);
}

/**
 * Convert any CSS color string (including oklch, oklab, lab, lch, etc.) to standard rgb/rgba
 */
export function parseCssColorToRgb(colorStr: string): string {
  if (!colorStr) return 'rgb(100, 116, 139)';

  // 1. Try mathematical conversion for oklab
  if (/oklab/i.test(colorStr)) {
    const oklabRes = parseOklabToRgb(colorStr);
    if (oklabRes) {
      return oklabRes.a >= 0.99
        ? `rgb(${oklabRes.r}, ${oklabRes.g}, ${oklabRes.b})`
        : `rgba(${oklabRes.r}, ${oklabRes.g}, ${oklabRes.b}, ${oklabRes.a})`;
    }
  }

  // 2. Try mathematical conversion for oklch
  if (/oklch/i.test(colorStr)) {
    const oklchRes = parseOklchToRgb(colorStr);
    if (oklchRes) {
      return oklchRes.a >= 0.99
        ? `rgb(${oklchRes.r}, ${oklchRes.g}, ${oklchRes.b})`
        : `rgba(${oklchRes.r}, ${oklchRes.g}, ${oklchRes.b}, ${oklchRes.a})`;
    }
  }

  // 3. Canvas 2D fallback for other color expressions
  const ctx = getTempCtx();
  if (!ctx) return 'rgb(100, 116, 139)';
  try {
    let cleanColor = colorStr.replace(/var\([^,)]+,\s*([^)]+)\)/g, '$1');
    cleanColor = cleanColor.replace(/var\([^)]+\)/g, '1');

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = cleanColor;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = Math.round((data[3] / 255) * 100) / 100;

    if (a >= 0.99) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch {
    return 'rgb(100, 116, 139)';
  }
}

/**
 * Replace all modern color function occurrences (oklch, oklab, lab, lch, color-mix, color, light-dark)
 * and keywords in a string with computed rgb/rgba equivalents.
 */
export function convertModernColorsInString(text: string): string {
  if (!text || typeof text !== 'string') return text;
  if (!/(oklch|oklab|lab|lch|color-mix|color|light-dark)/i.test(text)) return text;

  let result = text;

  // 1. Replace light-dark(a, b) with first argument a
  result = result.replace(/light-dark\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '$1');

  // 2. Replace "in oklab", "in oklch", "in lab", "in lch" keywords used in gradients / color-mix
  result = result.replace(/\bin\s+(oklab|oklch|lab|lch)\b/gi, 'in srgb');

  // 3. Extract and replace function calls using balanced parenthesis matching
  const fnStartRegex = /(oklch|oklab|lab|lch|color-mix|color)\s*\(/gi;
  let match: RegExpExecArray | null;
  let iterations = 0;

  while (iterations < 25 && (match = fnStartRegex.exec(result)) !== null) {
    iterations++;
    const startIndex = match.index;
    const openParenIndex = startIndex + match[0].length - 1;

    let depth = 1;
    let endIndex = -1;
    for (let i = openParenIndex + 1; i < result.length; i++) {
      const char = result[i];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      const fullFnCall = result.substring(startIndex, endIndex + 1);
      const convertedRgb = parseCssColorToRgb(fullFnCall);

      result = result.substring(0, startIndex) + convertedRgb + result.substring(endIndex + 1);
      fnStartRegex.lastIndex = 0;
    }
  }

  // 4. Fallback cleanup: if any standalone oklab/oklch/lab/lch keywords remain, replace them to prevent html2canvas errors
  if (/(oklch|oklab|lab|lch)/i.test(result)) {
    result = result.replace(/\b(oklch|oklab|lab|lch)\b/gi, 'srgb');
  }

  return result;
}

// Backward compatibility export
export const convertOklchString = convertModernColorsInString;

function sanitizeStyleValue(val: string): string {
  if (!val || typeof val !== 'string') return val;
  if (/(oklch|oklab|lab|lch|color-mix|color|light-dark)/i.test(val)) {
    return convertModernColorsInString(val);
  }
  return val;
}

/**
 * Creates a Proxy wrapping a CSSStyleDeclaration to sanitize any oklab/oklch values returned
 * via getPropertyValue(...) or direct property access (e.g. style.color, style.backgroundColor).
 */
function createSanitizedStyleProxy(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (propertyName: string) => {
          const val = target.getPropertyValue(propertyName);
          return sanitizeStyleValue(val);
        };
      }
      if (prop === 'getPropertyPriority') {
        return (propertyName: string) => target.getPropertyPriority(propertyName);
      }
      if (prop === 'item') {
        return (index: number) => target.item(index);
      }

      let val: any;
      try {
        val = (target as any)[prop];
      } catch {
        val = undefined;
      }

      if (typeof val === 'string') {
        return sanitizeStyleValue(val);
      }

      if (typeof val === 'function') {
        return val.bind(target);
      }

      return val;
    },
  });
}

/**
 * Sanitize cloned DOM document before html2canvas rendering to remove oklch/oklab/lab/lch modern color functions.
 */
export function sanitizeOklchInDoc(clonedDoc: Document): void {
  const colorPattern = /(oklch|oklab|lab|lch|color-mix|color|light-dark)/i;

  // 1. Convert all document stylesheets into inline sanitized <style> blocks and remove <link rel="stylesheet"> in clonedDoc
  const linkElements = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));

  let aggregatedCss = '';
  try {
    if (typeof document !== 'undefined' && document.styleSheets) {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (let i = 0; i < rules.length; i++) {
              const ruleText = rules[i].cssText;
              if (ruleText) {
                if (colorPattern.test(ruleText)) {
                  aggregatedCss += '\n' + convertModernColorsInString(ruleText);
                } else {
                  aggregatedCss += '\n' + ruleText;
                }
              }
            }
          }
        } catch {
          // Cross-origin stylesheet rules might throw, ignore safely
        }
      });
    }
  } catch {
    // Ignore errors reading document styleSheets
  }

  if (aggregatedCss) {
    const masterStyle = clonedDoc.createElement('style');
    masterStyle.type = 'text/css';
    masterStyle.textContent = convertModernColorsInString(aggregatedCss);
    if (clonedDoc.head) {
      clonedDoc.head.appendChild(masterStyle);
    } else {
      clonedDoc.appendChild(masterStyle);
    }
  }

  // Remove <link rel="stylesheet"> elements from clonedDoc so html2canvas will not fetch un-sanitized external CSS files
  linkElements.forEach((linkEl) => {
    if (linkEl.parentNode) {
      linkEl.parentNode.removeChild(linkEl);
    }
  });

  // 2. Process all <style> elements in clonedDoc
  const styleElements = clonedDoc.querySelectorAll('style');
  styleElements.forEach((styleEl) => {
    if (styleEl.textContent && colorPattern.test(styleEl.textContent)) {
      styleEl.textContent = convertModernColorsInString(styleEl.textContent);
    }
  });

  // 3. Process all element attributes in clonedDoc
  const allElements = clonedDoc.querySelectorAll('*');
  allElements.forEach((node) => {
    const el = node as HTMLElement;

    const styleAttr = el.getAttribute('style');
    if (styleAttr && colorPattern.test(styleAttr)) {
      el.setAttribute('style', convertModernColorsInString(styleAttr));
    }

    ['fill', 'stroke', 'stop-color', 'color', 'background-color', 'border-color'].forEach((attr) => {
      const val = el.getAttribute(attr);
      if (val && colorPattern.test(val)) {
        el.setAttribute(attr, convertModernColorsInString(val));
      }
    });
  });
}

/**
 * Capture an HTML element and render it into a high-quality multi-page A4 PDF file.
 */
export async function exportElementToPDF(options: PDFExportOptions): Promise<void> {
  const {
    filename = `Bao_cao_TTHC_${new Date().toISOString().split('T')[0]}.pdf`,
    subtitle = 'Trung tâm Phục vụ Hành chính công xã Chân Mây - Lăng Cô',
    elementId,
    element: targetElProp,
    orientation = 'portrait',
  } = options;

  let element = targetElProp;
  if (!element && elementId) {
    element = document.getElementById(elementId);
  }
  if (!element) {
    element = document.querySelector('main') || document.body;
  }

  if (!element) {
    throw new Error('Không tìm thấy vùng nội dung báo cáo để xuất PDF.');
  }

  // Create loading overlay
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'pdf-export-loading-overlay';
  loadingDiv.className = 'fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white font-sans';
  loadingDiv.innerHTML = `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-sm text-center">
      <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h3 class="text-base font-bold text-white mb-1">Đang khởi tạo tệp PDF...</h3>
      <p class="text-xs text-slate-300">Hệ thống đang chụp giao diện và chuyển đổi biểu đồ sang định dạng PDF A4 chất lượng cao.</p>
    </div>
  `;
  document.body.appendChild(loadingDiv);

  // Globally patch window.getComputedStyle during html2canvas capture
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const style = originalGetComputedStyle.call(window, el, pseudoElt);
    return createSanitizedStyleProxy(style);
  };

  try {
    // Capture element with high resolution & oklch color conversion
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        // Patch getComputedStyle on cloned document view if different from window
        if (clonedDoc.defaultView && clonedDoc.defaultView !== window) {
          const origClonedGetComputedStyle = clonedDoc.defaultView.getComputedStyle;
          clonedDoc.defaultView.getComputedStyle = function (el: Element, pseudoElt?: string | null): CSSStyleDeclaration {
            const style = origClonedGetComputedStyle.call(clonedDoc.defaultView, el, pseudoElt);
            return createSanitizedStyleProxy(style);
          };
        }

        // 1. Sanitize oklch/oklab colors for html2canvas compatibility
        sanitizeOklchInDoc(clonedDoc);

        // 2. Hide elements with data-pdf-ignore or no-print classes
        const ignoreElements = clonedDoc.querySelectorAll('[data-pdf-ignore="true"], .no-print');
        ignoreElements.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const isLandscape = orientation === 'landscape';
    const pdf = new jsPDF({
      orientation: isLandscape ? 'l' : 'p',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth - 20; // 10mm margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 15; // Top margin for page 1

    // Page 1 Header title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);

    // Add Image to Page 1
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);

      // Add page footer
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `Trang ${pdf.getNumberOfPages()} - ${subtitle}`,
        pdfWidth / 2,
        pdfHeight - 5,
        { align: 'center' }
      );

      heightLeft -= pdfHeight - 20;
    }

    pdf.save(filename);
  } finally {
    // Restore window.getComputedStyle
    window.getComputedStyle = originalGetComputedStyle;

    const overlay = document.getElementById('pdf-export-loading-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}

/**
 * Open standard browser print view configured for A4 paper print / PDF generation.
 */
export function triggerBrowserPrint(): void {
  window.print();
}
