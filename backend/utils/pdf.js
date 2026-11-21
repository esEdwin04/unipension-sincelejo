// =============================================================
// Generación del comprobante de pago en PDF (HU-08 → RF-10)
// Responsable: Desarrollador Backend
// =============================================================
const PDFDocument = require('pdfkit');

const cop = (v) => '$' + Number(v).toLocaleString('es-CO');

function generarComprobantePDF(d, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(stream);

  // Encabezado
  doc.rect(0, 0, doc.page.width, 90).fill('#1b4965');
  doc.fill('#ffffff').fontSize(22).font('Helvetica-Bold')
     .text('UniPensión Sincelejo', 50, 28);
  doc.fontSize(11).font('Helvetica')
     .text('Comprobante de pago de reserva', 50, 56);

  doc.fill('#000000').moveDown(3);
  doc.fontSize(12).font('Helvetica-Bold').text(`Comprobante N.º ${d.consecutivo}`, 50, 120);
  if (d.estado_pago === 'Revertido')
    doc.fill('#b00020').text('*** PAGO REVERTIDO — NOTA DE REVERSIÓN ***').fill('#000000');
  doc.font('Helvetica').fontSize(10).fill('#555555')
     .text(`Fecha de pago: ${d.fecha_pago}   ·   Medio: ${d.medio}`).fill('#000000');

  const fila = (etq, val) => {
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(11).text(etq + ': ', { continued: true })
       .font('Helvetica').text(String(val));
  };
  doc.moveDown(1);
  fila('Estudiante', `${d.estudiante} (${d.correo})`);
  fila('Pensión', `${d.pension} — ${d.direccion}, barrio ${d.barrio}`);
  fila('Propietario', d.propietario);
  fila('Fecha de ingreso', d.fecha_ingreso);
  fila('Duración', `${d.meses} mes(es)`);

  doc.moveDown(1.5);
  doc.rect(50, doc.y, 495, 36).fill('#eef4f8');
  doc.fill('#1b4965').font('Helvetica-Bold').fontSize(14)
     .text(`VALOR PAGADO: ${cop(d.valor_total)} COP`, 60, doc.y - 28);

  doc.fill('#888888').fontSize(8).font('Helvetica')
     .text('Documento generado automáticamente por la plataforma UniPensión Sincelejo. ' +
           'Este comprobante formaliza la reserva del cupo; no constituye contrato de arrendamiento.',
           50, 760, { width: 495, align: 'center' });
  doc.end();
}

module.exports = { generarComprobantePDF };
