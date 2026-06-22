const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const testDir = path.join(__dirname, 'test_output');
fs.ensureDirSync(testDir);

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const page1 = pdfDoc.addPage([600, 400]);
  page1.drawText('Hello PDF Page 1', {
    x: 100, y: 300, size: 36, font: helveticaFont, color: rgb(0.4, 0.49, 0.92)
  });
  page1.drawText('This is a test document for PDF to Image conversion', {
    x: 100, y: 250, size: 18, font: helveticaFont, color: rgb(0.2, 0.2, 0.2)
  });

  const page2 = pdfDoc.addPage([600, 400]);
  page2.drawText('Hello PDF Page 2', {
    x: 100, y: 300, size: 36, font: helveticaFont, color: rgb(0.96, 0.34, 0.42)
  });
  page2.drawText('Testing batch and multi-page conversion', {
    x: 100, y: 250, size: 18, font: helveticaFont, color: rgb(0.2, 0.2, 0.2)
  });

  const pdfBytes = await pdfDoc.save();
  const pdfPath = path.join(testDir, 'test.pdf');
  fs.writeFileSync(pdfPath, pdfBytes);
  console.log('Created test PDF:', pdfPath);
  return pdfPath;
}

function createTestImages() {
  const canvas1 = createCanvas(400, 300);
  const ctx1 = canvas1.getContext('2d');
  ctx1.fillStyle = '#667eea';
  ctx1.fillRect(0, 0, 400, 300);
  ctx1.fillStyle = 'white';
  ctx1.font = 'bold 32px sans-serif';
  ctx1.textAlign = 'center';
  ctx1.fillText('Image 1', 200, 160);
  const img1Path = path.join(testDir, 'image1.png');
  fs.writeFileSync(img1Path, canvas1.toBuffer('image/png'));

  const canvas2 = createCanvas(500, 400);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = '#f5576c';
  ctx2.fillRect(0, 0, 500, 400);
  ctx2.fillStyle = 'white';
  ctx2.font = 'bold 36px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('Image 2', 250, 200);
  const img2Path = path.join(testDir, 'image2.png');
  fs.writeFileSync(img2Path, canvas2.toBuffer('image/png'));

  console.log('Created test images:', img1Path, img2Path);
  return [img1Path, img2Path];
}

function makeRequest(options, form = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (form) {
      form.pipe(req);
    } else {
      req.end();
    }
  });
}

async function testPDFToImage(pdfPath) {
  console.log('\n=== Testing PDF to Image ===');
  const form = new FormData();
  form.append('pdfs', fs.createReadStream(pdfPath), { filename: 'test.pdf', contentType: 'application/pdf' });
  form.append('format', 'png');
  form.append('pageMode', 'all');
  form.append('dpi', '150');

  const options = {
    hostname: 'localhost',
    port: 5094,
    path: '/api/to-image',
    method: 'POST',
    headers: form.getHeaders()
  };

  const result = await makeRequest(options, form);
  console.log('Status:', result.statusCode);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  return result;
}

async function testImageToPDF_WithOrderBug(imgPaths) {
  console.log('\n=== Testing Image to PDF (order parameter - testing fix) ===');
  
  const form = new FormData();
  form.append('images', fs.createReadStream(imgPaths[0]), { filename: 'image1.png', contentType: 'image/png' });
  form.append('images', fs.createReadStream(imgPaths[1]), { filename: 'image2.png', contentType: 'image/png' });
  
  form.append('pageSize', 'A4');
  form.append('margin', '20');
  form.append('order', JSON.stringify([0, 1]));

  const options = {
    hostname: 'localhost',
    port: 5094,
    path: '/api/from-image',
    method: 'POST',
    headers: form.getHeaders()
  };

  const result = await makeRequest(options, form);
  console.log('Status:', result.statusCode);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  return result;
}

async function testImageToPDF_WithOrderBug_CommaString(imgPaths) {
  console.log('\n=== Testing Image to PDF (order as comma string - testing backend robustness) ===');
  
  const form = new FormData();
  form.append('images', fs.createReadStream(imgPaths[0]), { filename: 'image1.png', contentType: 'image/png' });
  form.append('images', fs.createReadStream(imgPaths[1]), { filename: 'image2.png', contentType: 'image/png' });
  
  form.append('pageSize', 'A4');
  form.append('margin', '20');
  form.append('order', '0,1');

  const options = {
    hostname: 'localhost',
    port: 5094,
    path: '/api/from-image',
    method: 'POST',
    headers: form.getHeaders()
  };

  const result = await makeRequest(options, form);
  console.log('Status:', result.statusCode);
  console.log('Response:', JSON.stringify(result.data, null, 2));
  return result;
}

async function main() {
  try {
    const pdfPath = await createTestPDF();
    const imgPaths = createTestImages();

    await testPDFToImage(pdfPath);
    await testImageToPDF_WithOrderBug(imgPaths);
    await testImageToPDF_WithOrderBug_CommaString(imgPaths);

    console.log('\n=== All tests completed ===');
    console.log('Test files saved in:', testDir);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

main();
