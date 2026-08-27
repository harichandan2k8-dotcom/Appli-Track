const BRANDS = ['Acer', 'AEG', 'Amana', 'Apple', 'Bajaj', 'Beko', 'Blue Star', 'Bosch', 'Carrier', 'Daikin', 'Dyson', 'Electrolux', 'Faber', 'Godrej', 'Haier', 'Havells', 'Hisense', 'Hitachi', 'Honeywell', 'IFB', 'Inalsa', 'Kenstar', 'KitchenAid', 'LG', 'Liebherr', 'Lloyd', 'Miele', 'Morphy Richards', 'O General', 'Onida', 'Panasonic', 'Philips', 'Samsung', 'Sharp', 'Siemens', 'Sony', 'TCL', 'Voltas', 'Whirlpool', 'White-Westinghouse', 'Xiaomi'];
const APPLIANCE_TYPES = ['Air Conditioner', 'Air Purifier', 'Ceiling Fan', 'Coffee Maker', 'Cooktop', 'Deep Freezer', 'Dishwasher', 'Dryer', 'Exhaust Fan', 'Freezer', 'Geyser / Water Heater', 'Induction Cooktop', 'Microwave Oven', 'Mixer Grinder', 'Oven', 'Refrigerator', 'Robot Vacuum', 'Room Heater', 'Television', 'Toaster', 'Vacuum Cleaner', 'Washing Machine', 'Water Purifier', 'Water Pump'];
const SUPPORT_URLS = {'LG':'https://www.lg.com/in/support','Samsung':'https://www.samsung.com/in/support/','Sony':'https://www.sony.co.in/electronics/support','Bosch':'https://www.bosch-home.in/service','Whirlpool':'https://www.whirlpoolindia.com/service-support','IFB':'https://www.ifbappliances.com/customer-care','Godrej':'https://www.godrej.com/godrej-appliances/customer-care','Haier':'https://www.haier.com/in/service-support/','Panasonic':'https://www.panasonic.com/in/support.html','Voltas':'https://www.voltas.com/support','Daikin':'https://www.daikinindia.com/support','Carrier':'https://www.carrier.com/residential/en/in/support/','Blue Star':'https://www.bluestarindia.com/customer-support','Philips':'https://www.usa.philips.com/c-w/support-home/support-contact-page.html','Bajaj':'https://www.bajajelectricals.com/customer-care','Havells':'https://www.havells.com/en/consumer/customer-care.html','Miele':'https://www.miele.in/support/','Siemens':'https://www.siemens-home.bsh-group.in/customer-service'};
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 5;
const MINIMUM_TEXT_LENGTH = 24;
const MONTHS = { january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12 };
const TYPE_ALIASES = [['air conditioner', 'Air Conditioner'], ['ac ', 'Air Conditioner'], ['refrigerator', 'Refrigerator'], ['fridge', 'Refrigerator'], ['washing machine', 'Washing Machine'], ['washer', 'Washing Machine'], ['television', 'Television'], ['smart tv', 'Television'], ['water purifier', 'Water Purifier'], ['dishwasher', 'Dishwasher'], ['microwave', 'Microwave Oven'], ['vacuum', 'Vacuum Cleaner'], ['water heater', 'Geyser / Water Heater'], ['geyser', 'Geyser / Water Heater'], ['mixer grinder', 'Mixer Grinder'], ['air purifier', 'Air Purifier']];

export const applianceTypes = APPLIANCE_TYPES;
export const brands = BRANDS;
export function supportUrlFor(brand) { const known = Object.entries(SUPPORT_URLS).find(([name]) => name.toLowerCase() === (brand || '').trim().toLowerCase()); return known ? known[1] : `https://www.google.com/search?q=${encodeURIComponent(`${brand} official support`)}`; }

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normaliseText(text) { return String(text || '').replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim(); }
function textValue(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/^[#:\-\s]+|[|,;.:\s]+$/g, '');
  }
  return '';
}
function toIsoDate(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  let day; let month; let year;
  const numeric = candidate.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
  if (numeric) {
    const [, first, second, third] = numeric;
    if (first.length === 4) [year, month, day] = [Number(first), Number(second), Number(third)];
    else [day, month, year] = [Number(first), Number(second), Number(third)];
  } else {
    const written = candidate.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]+)[,\s]+(\d{2,4})|([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{2,4})/i);
    if (!written) return '';
    day = Number(written[1] || written[5]);
    month = MONTHS[(written[2] || written[4]).toLowerCase()];
    year = Number(written[3] || written[6]);
  }
  if (year < 100) year += 2000;
  const date = new Date(year, (month || 0) - 1, day);
  if (!year || !month || !day || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function findApplianceType(lower) {
  const direct = APPLIANCE_TYPES.find(item => lower.includes(item.toLowerCase().replace(' / ', ' ')));
  if (direct) return direct;
  const alias = TYPE_ALIASES.find(([needle]) => lower.includes(needle));
  return alias ? alias[1] : '';
}

export function extractApplianceDetails(rawText) {
  const text = normaliseText(rawText);
  const lower = text.toLowerCase();
  const brand = BRANDS.find(item => new RegExp(`\\b${escapeRegExp(item)}\\b`, 'i').test(text)) || '';
  const applianceType = findApplianceType(lower);
  const model = textValue(text, [/(?:model(?:\s*(?:no\.?|number|#))?|model\s*#|m\/?n)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._/\- ]{2,30})/i]).replace(/\s+(?:serial|s\/n|date|warranty)\b.*$/i, '');
  const serialNumber = textValue(text, [/(?:serial(?:\s*(?:no\.?|number|#))?|s\/?n|serial\s*#)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9._/\-]{3,30})/i]);
  const warrantyMatch = text.match(/(?:warranty|guarantee)(?:\s+(?:period|validity))?\s*(?:is|of)?\s*[:\-]?\s*(\d{1,2})\s*(years?|yrs?|months?|mos?)/i);
  const warrantyMonths = warrantyMatch ? Number(warrantyMatch[1]) * (/year|yr/i.test(warrantyMatch[2]) ? 12 : 1) : '';
  const date = textValue(text, [/(?:date\s+of\s+purchase|purchase\s+date|invoice\s+date|dated)\s*[:\-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{1,4}|[0-9]{1,2}\s+[a-z]+[,]?\s+[0-9]{2,4}|[a-z]+\s+[0-9]{1,2}[,\s]+[0-9]{2,4})/i]);
  return { brand, applianceType, model, serialNumber, warrantyMonths, purchaseDate: toIsoDate(date), rawText: text };
}

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image format is not supported by this browser. Please use a JPG, PNG, or WebP image.')); };
    image.src = url;
  });
}
async function prepareImageForOcr(file) {
  const image = await imageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(2.25, 2200 / Math.max(longestSide, 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const enhanced = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
    pixels.data[index] = enhanced; pixels.data[index + 1] = enhanced; pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}
async function recogniseImage(source, onProgress) {
  if (!window.Tesseract) throw new Error('The text scanner is still loading. Please try again in a moment.');
  const result = await window.Tesseract.recognize(source, 'eng', {
    logger: message => {
      if (message.status === 'recognizing text') onProgress(`Reading text… ${Math.round((message.progress || 0) * 100)}%`);
      else if (message.status) onProgress('Preparing the document scan…');
    }
  });
  return normaliseText(result.data.text);
}
async function readPdf(file, onProgress) {
  if (!window.pdfjsLib) throw new Error('The PDF reader is still loading. Please try again in a moment.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  onProgress('Opening your PDF…');
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress(`Reading page ${pageNumber} of ${pageCount}…`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = normaliseText(content.items.map(item => item.str).join(' '));
    if (pageText.length < MINIMUM_TEXT_LENGTH) {
      onProgress(`Scanning page ${pageNumber} of ${pageCount}…`);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(Math.round(viewport.width), 2200);
      canvas.height = Math.min(Math.round(viewport.height), 3000);
      const scale = canvas.width / viewport.width;
      const renderViewport = scale === 1 ? viewport : page.getViewport({ scale: 2 * scale });
      await page.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport: renderViewport }).promise;
      pageText = await recogniseImage(canvas, onProgress);
    }
    pages.push(pageText);
  }
  const text = normaliseText(pages.join('\n'));
  if (!text) throw new Error('No readable text was found. Try a sharper, well-lit photo of the label or warranty card.');
  return text;
}

export async function readDocument(file, onProgress = () => {}) {
  if (!file) throw new Error('Choose a document first.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Choose a file smaller than 20 MB for a faster, more reliable scan.');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) return readPdf(file, onProgress);
  if (!file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, WebP image, or PDF document.');
  onProgress('Improving image clarity…');
  const preparedImage = await prepareImageForOcr(file);
  const text = await recogniseImage(preparedImage, onProgress);
  if (!text) throw new Error('No readable text was found. Try a close, well-lit photo without glare.');
  return text;
}
