/**
 * The files the contacts demo imports (demos/samples): a workbook as Excel
 * writes one — its words in a table of shared strings, one in two runs of
 * rich text, its days as numbers in a day's format, yes or no as booleans, a
 * second sheet of notes, every file squeezed with deflate — and a CSV file as
 * Excel saves one where a decimal comma is written: semicolons between its
 * values, UTF-8 with its mark, days day first. Each holds a few rows a person
 * gets wrong, which the import names with why — among them an owner two of
 * the demo's users are called, as two people of one name are. Written by
 * `node tools/import-samples.mjs`; the demo serves what it wrote.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'demos/samples');

// ---- the contacts --------------------------------------------------------------------------------------------------

/** Full name, company, e-mail, country, status, owner, last order (a day, or words as typed), newsletter, notes. */
const WORKBOOK_ROWS = [
  ['Amira Hassan', 'Delta Foods', 'amira.hassan@deltafoods.example', 'Egypt', 'Customer', 'Sara Haddad', '2026-09-14', true, 'Orders every month'],
  ['Omar Farouk', 'Nile Traders', 'omar.farouk@niletraders.example', 'Egypt', 'Lead', 'Lina Khalil', null, false, ''],
  ['Leila Mansour', 'Petra Tours', 'leila.mansour@petratours.example', 'Jordan', 'Customer', 'Sara Haddad', '2026-07-02', true, ''],
  ['Faisal Al-Harbi', 'Red Sea Divers', 'faisal.alharbi@redseadivers.example', 'Saudi Arabia', 'Customer', 'Lina Khalil', '2026-05-20', false, 'Prefers WhatsApp'],
  ['Hannah Becker', 'Cedar Logistics', 'hannah.becker@cedarlogistics.example', 'Egypt', 'Lead', 'Sara Haddad', null, true, ''],
  ['Lucas Moreau', 'Atlas Builders', 'lucas.moreau@atlasbuilders.example', 'Jordan', 'Inactive', 'Karim Nasser', '2025-11-03', false, ''],
  ['Priya Raman', 'Lotus Spa', 'priya.raman@lotusspa.example', 'Saudi Arabia', 'Lead', 'Sara Haddad', null, true, 'Met at the Riyadh fair'],
  ['Kenji Watanabe', 'Harbour Freight', 'kenji.watanabe@harbourfreight.example', 'Egypt', 'Customer', 'Lina Khalil', '2026-08-29', false, ''],
  ['Sofia Rossi', 'Saffron Kitchens', 'sofia.rossi@saffronkitchens.example', 'Jordan', 'Customer', 'Omar Said', '2026-06-11', true, 'Two users are called Omar Said'],
  ['', 'Oasis Water', 'info@oasiswater.example', 'Egypt', 'Lead', 'Sara Haddad', null, false, 'Name to ask for'],
  ['Youssef Nabil', 'Giza Plaza', 'youssef.nabil@gizaplaza.example', 'Egypt', 'Prospect', 'Karim Nasser', null, true, ''],
  ['Daniel Okafor', 'Falcon Air Cargo', 'daniel.okafor@falconair.example', 'Atlantis', 'Lead', 'Lina Khalil', null, false, ''],
  ['Nour El-Sayed', 'Zamalek Studio', 'nour.elsayed@zamalekstudio.example', 'Egypt', 'Customer', 'Mona', '2026-04-18', true, ''],
  ['Mariam Khoury', 'Bayt Interiors', 'mariam.khoury@baytinteriors.example', 'Jordan', 'Customer', 'Sara Haddad', '31/02/2026', true, 'Date as typed'],
  ['Tomás García', 'Sphinx Security', 'tomas.garcia@sphinxsecurity.example', 'Egypt', 'Lead', 'Karim Nasser', null, 'maybe', ''],
  ['Aisha Bello', 'Indigo Print', 'aisha.bello@indigoprint.example', 'Saudi Arabia', 'Customer', 'Lina Khalil', '2026-03-07', false, ''],
  ['Elena Petrova', 'Jasmine Florists', 'elena.petrova@jasmineflorists.example', 'Egypt', 'Lead', 'Sara Haddad', null, true, ''],
];
const HEADERS = ['Full name', 'Company', 'E-mail', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter', 'Notes'];

/** Name, company, email, country, status, owner, last order (day first), newsletter: the page's own words over the columns. */
const CSV_ROWS = [
  ['Salma Al-Otaibi', 'Desert Rose Hotels', 'salma.alotaibi@desertrose.example', 'Saudi Arabia', 'Customer', 'Lina Khalil', '22/09/2026', 'Yes'],
  ['سلمى العتيبي', 'فنادق وردة الصحراء', 'salma.ar@desertrose.example', 'Saudi Arabia', 'Lead', 'Lina Khalil', '', 'نعم'],
  ['Jonas Weber', 'Maadi Labs', 'jonas.weber@maadilabs.example', 'Egypt', 'Lead', 'Karim Nasser', '', 'No'],
  ['Chloé Martin', 'Tahrir Books', 'chloe.martin@tahrirbooks.example', 'Egypt', 'Customer', 'Sara Haddad', '05/10/2026', 'Yes'],
  ['Ravi Sharma', 'Palm Court Dental', 'ravi.sharma@palmcourt.example', 'Jordan', 'Customer', 'Sara Haddad', '17/08/2026', 'No'],
  ['Inès Haddad', 'Olive Grove Farms', 'ines.haddad@olivegrove.example', 'Jordan', 'Inactive', 'Sara Haddad', '30/12/2025', 'No'],
  ['Ahmed Saleh', 'Sahel Resorts', 'ahmed.saleh@sahelresorts.example', 'Egypt', 'Customr', 'Lina Khalil', '', 'Yes'],
  ['Anna Novak', 'Amira Clinics', 'anna.novak@amiraclinics.example', 'Egypte', 'Lead', 'Karim Nasser', '', 'No'],
  ['Marco Bianchi', 'Nour Pharmacies', 'marco.bianchi@nourpharmacies.example', 'Egypt', 'Customer', 'Lina Khalil', '09/31/2026', 'Yes'],
  ['Wei Chen', 'Cedar Logistics', 'wei.chen@cedarlogistics.example', 'Egypt', 'Lead', 'Sara Haddad', '', 'sometimes'],
];
const CSV_HEADERS = ['Name', 'Company', 'Email', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter'];

// ---- a workbook, as Excel writes one ----------------------------------------------------------------------------

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const escaped = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const letter = (i) => String.fromCharCode(65 + i);
/** A day as a spreadsheet counts it: days since 30 December 1899. */
const serial = (day) => (Date.UTC(...day.split('-').map((part, i) => Number(part) - (i === 1 ? 1 : 0))) - Date.UTC(1899, 11, 30)) / 86400000;

function workbook() {
  const strings = [];
  const index = new Map();
  const shared = (text) => {
    if (!index.has(text)) {
      index.set(text, strings.length);
      strings.push(text);
    }
    return index.get(text);
  };
  const cell = (value, ref) => {
    if (value === null || value === '') return '';
    if (value === true || value === false) return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    // A day: a number in the day's format (built-in 14), as Excel keeps one typed as a day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `<c r="${ref}" s="1"><v>${serial(value)}</v></c>`;
    return `<c r="${ref}" t="s"><v>${shared(value)}</v></c>`;
  };
  // The header in bold (style 2); a blank row left where a person deleted one, which the import skips.
  const rows = [`<row r="1" spans="1:9">${HEADERS.map((header, i) => `<c r="${letter(i)}1" t="s" s="2"><v>${shared(header)}</v></c>`).join('')}</row>`];
  let r = 2;
  WORKBOOK_ROWS.forEach((row, i) => {
    if (i === 8) r++;
    rows.push(`<row r="${r}" spans="1:9">${row.map((value, c) => cell(value, `${letter(c)}${r}`)).join('')}</row>`);
    r++;
  });
  // One company written in two runs of rich text, as a person bolding part of a cell leaves it.
  const items = strings.map((text) =>
    text === 'Nile Traders' ? '<si><r><rPr><b/><sz val="11"/><rFont val="Calibri"/></rPr><t>Nile</t></r><r><rPr><sz val="11"/><rFont val="Calibri"/></rPr><t xml:space="preserve"> Traders</t></r></si>' : `<si><t>${escaped(text)}</t></si>`
  );
  const sheet = `${XML}<worksheet xmlns="${MAIN}" xmlns:r="${DOC}"><dimension ref="A1:I${r - 1}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="3" width="28" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
  const notes = `${XML}<worksheet xmlns="${MAIN}" xmlns:r="${DOC}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Contacts from the spring fairs, to bring into the CRM.</t></is></c></row></sheetData></worksheet>`;
  const files = {
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    '_rels/.rels': `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${XML}<workbook xmlns="${MAIN}" xmlns:r="${DOC}"><workbookPr defaultThemeVersion="166925"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="12300"/></bookViews><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId3" Type="${DOC}/styles" Target="styles.xml"/><Relationship Id="rId4" Type="${DOC}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${DOC}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    'xl/styles.xml': `${XML}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/sharedStrings.xml': `${XML}<sst xmlns="${MAIN}" count="${strings.length}" uniqueCount="${strings.length}">${items.join('')}</sst>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/worksheets/sheet2.xml': notes,
  };
  return zip(Object.entries(files));
}

/** A zip of these files, each squeezed with deflate, dated 16 October 2026 so the bytes are the same each time. */
function zip(files) {
  const time = (9 << 11) | (30 << 5);
  const date = ((2026 - 1980) << 9) | (10 << 5) | 16;
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const [path, text] of files) {
    const name = Buffer.from(path, 'utf8');
    const plain = Buffer.from(text, 'utf8');
    const body = deflateRawSync(plain, { level: 9 });
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc32(plain), 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(plain.length, 22);
    head.writeUInt16LE(name.length, 26);
    const listed = Buffer.alloc(46);
    listed.writeUInt32LE(0x02014b50, 0);
    listed.writeUInt16LE(20, 4);
    listed.writeUInt16LE(20, 6);
    listed.writeUInt16LE(0x0800, 8);
    listed.writeUInt16LE(8, 10);
    listed.writeUInt16LE(time, 12);
    listed.writeUInt16LE(date, 14);
    listed.writeUInt32LE(crc32(plain), 16);
    listed.writeUInt32LE(body.length, 20);
    listed.writeUInt32LE(plain.length, 24);
    listed.writeUInt16LE(name.length, 28);
    listed.writeUInt32LE(offset, 42);
    parts.push(head, name, body);
    directory.push(listed, name);
    offset += 30 + name.length + body.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}

// ---- a CSV file, as Excel saves one where a decimal comma is written ----------------------------------------------

function csv() {
  const value = (text) => (/[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  return `\ufeff${[CSV_HEADERS, ...CSV_ROWS].map((row) => row.map(value).join(';')).join('\r\n')}\r\n`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'contacts-to-import.xlsx'), workbook());
writeFileSync(join(OUT, 'contacts-to-import.csv'), csv(), 'utf8');
console.log(`samples: ${join('demos/samples', 'contacts-to-import.xlsx')}, ${join('demos/samples', 'contacts-to-import.csv')}`);
