import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
console.log('Module keys:', Object.keys(pdfjs));
console.log('Has default:', !!pdfjs.default);
console.log('Has getDocument:', !!pdfjs.getDocument);
if (pdfjs.default) {
  console.log('Default keys:', Object.keys(pdfjs.default));
  console.log('Default has getDocument:', !!pdfjs.default.getDocument);
}
console.log('typeof getDocument:', typeof pdfjs.getDocument);
