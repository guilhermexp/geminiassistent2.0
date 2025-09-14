/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebWorker-based file processing utilities used by file analysis.
 */
export function createHtmlPreview(text: string, title: string): string {
  const sanitizedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview: ${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            color: #e0e0e0;
            background-color: #121212;
            margin: 0;
            padding: 1.5em;
          }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.6;
          }
        </style>
      </head>
      <body><pre>${sanitizedText}</pre></body>
      </html>
    `;
  const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
  return `data:text/html;base64,${base64}`;
}

function createWorker(): Worker {
  const workerCode = `
      importScripts(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
        "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js"
      );

      self.onmessage = async (event) => {
        const { file } = event.data;
        const fileName = file.name.toLowerCase();
        const mimeType = file.type;

        try {
          let result;

          if (
            fileName.endsWith('.csv') || mimeType === 'text/csv' ||
            fileName.endsWith('.xlsx') || mimeType.includes('spreadsheet') || fileName.endsWith('.xls')
          ) {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = self.XLSX.read(arrayBuffer, { type: 'array' });
            const sheetNames = workbook.SheetNames;
            let fullCsvContent = '';
            for (const sheetName of sheetNames) {
              const worksheet = workbook.Sheets[sheetName];
              const csv = self.XLSX.utils.sheet_to_csv(worksheet);
              fullCsvContent += \`--- INÍCIO DA PLANILHA: \${sheetName} ---\\n\\n\${csv}\\n\\n--- FIM DA PLANILHA: \${sheetName} ---\\n\\n\`;
            }
            result = { type: 'csv', content: fullCsvContent, mimeType };
          } else if (
            fileName.endsWith('.doc') || fileName.endsWith('.docx') || mimeType.includes('wordprocessingml')
          ) {
            const arrayBuffer = await file.arrayBuffer();
            const { value: textContent } = await self.mammoth.extractRawText({ arrayBuffer });
            result = { type: 'text', content: textContent, mimeType };
          } else if (
            fileName.endsWith('.md') || mimeType === 'text/markdown' ||
            fileName.endsWith('.xlm') || mimeType === 'application/xml' || mimeType === 'text/xml'
          ) {
            const textContent = await file.text();
            result = { type: 'text', content: textContent, mimeType };
          } else {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve((reader.result).split(',')[1]);
              reader.onerror = (error) => reject(error);
            });
            result = { type: 'base64', content: base64, mimeType };
          }

          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `;
  const blob = new Blob([workerCode], {type: 'application/javascript'});
  return new Worker(URL.createObjectURL(blob));
}

export function processFileInWorker(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error('O processamento do arquivo demorou muito e foi cancelado.'),
      );
    }, 30000);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data.success) {
        resolve(event.data.result);
      } else {
        reject(new Error(event.data.error));
      }
      worker.terminate();
    };
    worker.onerror = (error) => {
      clearTimeout(timeout);
      reject(new Error(`Erro no worker de processamento: ${error.message}`));
      worker.terminate();
    };
    worker.postMessage({file});
  });
}
