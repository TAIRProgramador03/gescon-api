const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { promisify } = require("util");

const execAsync = promisify(exec);

const KEYNUA_MAX_BYTES = 4.5 * 1024 * 1024;
const GS_QUALITY_LEVELS = ["/printer", "/ebook", "/screen"];

// Detecta el binario correcto según el SO
// También permite sobreescribir con variable de entorno para mayor control
function getGsBinary() {
  if (process.env.GS_BINARY_PATH) {
    return `"${process.env.GS_BINARY_PATH}"`;
  }
  return process.platform === "win32" ? "gswin64c" : "gs";
}

async function compressWithGhostscript(inputBuffer, quality = "/ebook") {
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `gs_in_${ts}.pdf`);
  const outputPath = path.join(tmpDir, `gs_out_${ts}.pdf`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    const gsBin = getGsBinary();

    // Las rutas van entre comillas para manejar espacios en Windows
    // (ej: C:\Users\Admin\AppData\Local\Temp\gs_in_...)
    const gsCmd = [
      gsBin,
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      // Forzar downsampling explícito de imágenes
      "-dDownsampleColorImages=true",
      "-dDownsampleGrayImages=true",
      "-dDownsampleMonoImages=true",
      "-dColorImageDownsampleType=/Bicubic",
      "-dGrayImageDownsampleType=/Bicubic",
      "-dColorImageResolution=60",
      "-dGrayImageResolution=60",
      // JPEG quality agresivo (0-100)
      "-dAutoFilterColorImages=false",
      "-dAutoFilterGrayImages=false",
      "-dColorImageFilter=/DCTEncode",
      "-dGrayImageFilter=/DCTEncode",
      "-dJPEGQ=40",
      `-sOutputFile="${outputPath}"`,
      `"${inputPath}"`,
    ].join(" ");

    await execAsync(gsCmd);

    return fs.readFileSync(outputPath);
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}

async function fitForKeynua(pdfBuffer) {
  if (pdfBuffer.length <= KEYNUA_MAX_BYTES) {
    return { buffer: pdfBuffer, compressed: false, quality: null };
  }

  console.log(
    `[pdfCompressor] PDF pesa ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB, comprimiendo...`,
  );

  for (const quality of GS_QUALITY_LEVELS) {
    const compressed = await compressWithGhostscript(pdfBuffer, quality);
    console.log(
      `[pdfCompressor] ${quality}: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`,
    );

    if (compressed.length <= KEYNUA_MAX_BYTES) {
      console.log(`[pdfCompressor] OK con calidad ${quality}`);
      return { buffer: compressed, compressed: true, quality };
    }
  }

  throw new Error(
    `El PDF (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB) no pudo reducirse ` +
      `por debajo de 4.5 MB. Sube un archivo más liviano.`,
  );
}

module.exports = { fitForKeynua, KEYNUA_MAX_BYTES };
