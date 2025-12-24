import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.registerHelpers();
    this.loadTemplates();
  }

  private registerHelpers() {
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    });

    Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-IN', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    });

    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      if (!amount && amount !== 0) return '0.00';
      return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    Handlebars.registerHelper('formatNumber', (num: number) => {
      if (!num && num !== 0) return '0';
      return num.toLocaleString('en-IN');
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('lowercase', (str: string) => (str || '').toLowerCase());
    
    Handlebars.registerHelper('statusText', (status: string) => {
      const texts: Record<string, string> = {
        'ACTIVE': 'In Progress', 'COMPLETED': 'Completed', 'REJECTED': 'Rejected', 'CANCELLED': 'Cancelled'
      };
      return texts[status] || status;
    });
  }

  private loadTemplates() {
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
      return;
    }
    const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.hbs'));
    templateFiles.forEach(file => {
      const templateName = file.replace('.hbs', '');
      const templatePath = path.join(templatesDir, file);
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      this.templates.set(templateName, Handlebars.compile(templateContent));
    });
  }

  async generatePdf(templateName: string, data: any): Promise<Buffer> {
    const processedData = this.processTransactionData(templateName, data);
    let html: string;
    
    const template = this.templates.get(templateName);
    if (template) {
      html = template(processedData);
    } else {
      html = this.getInlineTemplate(templateName, processedData);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private processTransactionData(templateName: string, data: any): any {
    if (templateName !== 'grn') return data;

    const stepData = data.stepData || {};
    const weighbridgeData = data.weighbridgeData || {};
    const inspectionData = data.inspectionData || {};
    
    // Extract data from steps
    const gateEntryData = stepData[1]?.data || stepData['1']?.data || {};
    const grossWeightData = stepData[2]?.data || stepData['2']?.data || {};
    const inspectionStepData = stepData[3]?.data || stepData['3']?.data || {};
    const tareWeightData = stepData[4]?.data || stepData['4']?.data || {};

    const netWeight = weighbridgeData.netWeight || 0;
    const rate = data.rate || data.purchaseOrder?.rate || 45.50;
    const subtotal = netWeight * rate;
    const gstAmount = subtotal * 0.18;
    const grandTotal = subtotal + gstAmount;

    // Build steps array with data and evidence
    const steps = this.buildStepsArray(stepData, data.currentLevel || 1);

    return {
      ...data,
      companyName: data.companyName || 'XYZ Metal Recyclers',
      companyAddress: data.companyAddress || '123 Industrial Area, Phase 2',
      companyCity: data.companyCity || 'Mumbai, Maharashtra - 400001',
      gstin: data.gstin || '27AABCU9603R1ZM',
      vendorName: data.vendorName || data.vendor?.vendorName || 'Unknown Vendor',
      vehicleNumber: data.vehicleNumber || gateEntryData.truck_number || gateEntryData.vehicleNumber || 'N/A',
      driverName: gateEntryData.driver_name || gateEntryData.driverName || 'N/A',
      driverMobile: gateEntryData.driver_mobile || gateEntryData.driverMobile || 'N/A',
      poNumber: data.poNumber || data.purchaseOrder?.poNumber || 'N/A',
      materialType: data.materialType || data.purchaseOrder?.materialType || 'Mixed Scrap',
      grade: inspectionData.grade || inspectionStepData.quality_grade || 'Standard',
      grossWeight: weighbridgeData.grossWeight || parseFloat(grossWeightData.gross_weight) || 0,
      tareWeight: weighbridgeData.tareWeight || parseFloat(tareWeightData.tare_weight) || 0,
      netWeight,
      rate,
      subtotal,
      gstAmount,
      grandTotal,
      steps,
      hasQCData: !!(inspectionData.grade || inspectionStepData.quality_grade),
      qcGrade: inspectionData.grade || inspectionStepData.quality_grade || 'N/A',
      qcContamination: inspectionData.contaminationLevel || inspectionStepData.contamination || 0,
      qcMoisture: inspectionData.moistureLevel || inspectionStepData.moisture || 0,
      qcPassed: (inspectionData.grade || inspectionStepData.quality_grade || '').toUpperCase() !== 'REJECTED',
      generatedAt: new Date(),
    };
  }


  private buildStepsArray(stepData: Record<string, any>, currentLevel: number): any[] {
    const stepConfigs = [
      { num: 1, name: 'PO Selection', desc: 'Purchase order and vendor selection' },
      { num: 2, name: 'Gate Entry', desc: 'Vehicle entry and driver verification' },
      { num: 3, name: 'Weighbridge (Gross)', desc: 'Initial vehicle weight measurement' },
      { num: 4, name: 'Material Inspection', desc: 'Quality assessment and grading' },
      { num: 5, name: 'Weighbridge (Tare)', desc: 'Empty vehicle weight measurement' },
      { num: 6, name: 'GRN Generation', desc: 'Goods receipt note creation' },
      { num: 7, name: 'Gate Pass / Exit', desc: 'Vehicle exit authorization' },
    ];

    return stepConfigs.map((config, index) => {
      // Try multiple key formats: 0, '0', 1, '1', etc.
      const step = stepData[index] || stepData[String(index)] || 
                   stepData[index + 1] || stepData[String(index + 1)] || {};
      
      const isCompleted = index < currentLevel - 1;
      const isActive = index === currentLevel - 1;

      // Extract data items for display
      const dataItems = this.extractDataItems(step.data || {}, config.num);
      
      // Extract evidence/files
      const evidence = this.extractEvidence(step.files || step.evidence || {});

      return {
        stepNumber: config.num,
        name: config.name,
        description: config.desc,
        status: isCompleted ? 'completed' : isActive ? 'active' : 'pending',
        completedAt: step.timestamp,
        hasData: dataItems.length > 0,
        dataItems,
        hasEvidence: evidence.length > 0,
        evidence,
      };
    });
  }

  private extractDataItems(data: Record<string, any>, stepNum: number): { label: string; value: string }[] {
    const items: { label: string; value: string }[] = [];
    const labelMap: Record<string, string> = {
      // PO Selection
      po_number: 'PO Number', vendor_name: 'Vendor', material_type: 'Material Type', rate: 'Rate (₹/KG)',
      // Gate Entry
      truck_number: 'Vehicle Number', driver_name: 'Driver Name', driver_mobile: 'Driver Mobile',
      license_number: 'License No.', vehicleNumber: 'Vehicle Number', driverName: 'Driver Name',
      // Weighbridge
      gross_weight: 'Gross Weight', tare_weight: 'Tare Weight', net_weight: 'Net Weight',
      weighbridge_id: 'Weighbridge ID', operator: 'Operator',
      // Inspection
      quality_grade: 'Quality Grade', contamination: 'Contamination', moisture: 'Moisture',
      inspection_notes: 'Notes', grade: 'Grade',
      // GRN
      grn_number: 'GRN Number', approved_by: 'Approved By',
      // Gate Pass
      gate_pass_number: 'Gate Pass No.', exit_time: 'Exit Time',
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && !key.startsWith('_') && typeof value !== 'object') {
        const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let displayValue = String(value);
        
        // Add units based on field type
        if (key.includes('weight') && !displayValue.includes('KG')) displayValue += ' KG';
        if ((key.includes('contamination') || key.includes('moisture')) && !displayValue.includes('%')) displayValue += '%';
        if (key === 'rate' && !displayValue.includes('₹')) displayValue = '₹' + displayValue;
        
        items.push({ label, value: displayValue });
      }
    }
    return items.slice(0, 8); // Show up to 8 items per step
  }

  private extractEvidence(files: Record<string, any[]>): { name: string; url: string }[] {
    const evidence: { name: string; url: string }[] = [];
    for (const [fieldName, fileList] of Object.entries(files)) {
      if (Array.isArray(fileList)) {
        fileList.forEach((file, idx) => {
          if (file.url) {
            evidence.push({ name: file.name || `${fieldName} ${idx + 1}`, url: file.url });
          }
        });
      }
    }
    return evidence.slice(0, 6); // Limit to 6 images
  }

  private getInlineTemplate(templateName: string, data: any): string {
    switch (templateName) {
      case 'grn': return this.getGrnInlineTemplate(data);
      case 'purchase-order': return this.getPurchaseOrderTemplate(data);
      case 'gate-pass': return this.getGatePassTemplate(data);
      default: return this.getGrnInlineTemplate(data);
    }
  }


  private getGrnInlineTemplate(data: any): string {
    const stepsHtml = (data.steps || []).map((step: any) => `
      <div class="step-item ${step.status}">
        <div class="step-indicator">
          <div class="step-number">${step.status === 'completed' ? '✓' : step.stepNumber}</div>
          ${step.stepNumber < 7 ? '<div class="step-line"></div>' : ''}
        </div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-name">${step.name}</span>
            ${step.completedAt ? `<span class="step-time">${new Date(step.completedAt).toLocaleString('en-IN')}</span>` : ''}
          </div>
          <p class="step-desc">${step.description}</p>
          ${step.hasData ? `<div class="step-data"><div class="step-data-grid">
            ${step.dataItems.map((item: any) => `<div class="data-item"><span class="data-label">${item.label}</span><span class="data-value">${item.value}</span></div>`).join('')}
          </div></div>` : ''}
          ${step.hasEvidence ? `<div class="evidence-section"><div class="evidence-title">📷 Evidence</div><div class="evidence-grid">
            ${step.evidence.map((e: any) => `<div class="evidence-item"><img src="${e.url}" alt="${e.name}"/><div class="caption">${e.name}</div></div>`).join('')}
          </div></div>` : ''}
        </div>
      </div>
    `).join('');

    const formatNum = (n: number) => (n || 0).toLocaleString('en-IN');
    const formatCur = (n: number) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>GRN - ${data.transactionNumber}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1a1f36; }
  .page { padding: 8mm; }
  .header { display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 3px solid #6366f1; margin-bottom: 16px; }
  .company-info h1 { font-size: 18pt; font-weight: 700; color: #6366f1; margin-bottom: 4px; }
  .company-info p { font-size: 9pt; color: #64748b; }
  .doc-badge { text-align: right; }
  .doc-badge h2 { font-size: 11pt; color: #1a1f36; margin-bottom: 4px; }
  .doc-number { font-size: 14pt; font-weight: 700; color: #6366f1; font-family: monospace; }
  .date { font-size: 9pt; color: #64748b; margin-top: 4px; }
  .status-tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; text-transform: uppercase; margin-top: 6px; }
  .status-active { background: #fef3c7; color: #b45309; }
  .status-completed { background: #d1fae5; color: #059669; }
  .status-rejected { background: #fee2e2; color: #dc2626; }
  .info-grid { display: flex; gap: 16px; margin-bottom: 16px; }
  .info-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 12px; border-left: 3px solid #6366f1; }
  .info-box h3 { font-size: 9pt; color: #6366f1; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
  .info-box p { font-size: 9pt; color: #475569; margin-bottom: 4px; }
  .info-box p strong { color: #1a1f36; }
  .section-title { font-size: 11pt; font-weight: 600; color: #1a1f36; margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  .weight-section { background: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
  .weight-grid { display: flex; gap: 12px; text-align: center; }
  .weight-item { flex: 1; padding: 8px; }
  .weight-item h4 { font-size: 8pt; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
  .weight-item .value { font-size: 16pt; font-weight: 700; color: #1a1f36; }
  .weight-item.highlight { background: #eef2ff; border-radius: 8px; }
  .weight-item.highlight .value { color: #6366f1; }
  .step-item { display: flex; gap: 12px; margin-bottom: 12px; }
  .step-indicator { display: flex; flex-direction: column; align-items: center; width: 32px; }
  .step-number { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 600; }
  .step-item.completed .step-number { background: #10b981; color: white; }
  .step-item.active .step-number { background: #6366f1; color: white; }
  .step-item.pending .step-number { background: #e2e8f0; color: #64748b; }
  .step-line { width: 2px; flex: 1; min-height: 20px; background: #e2e8f0; margin: 4px 0; }
  .step-item.completed .step-line { background: #10b981; }
  .step-content { flex: 1; padding-bottom: 8px; }
  .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .step-name { font-size: 10pt; font-weight: 600; color: #1a1f36; }
  .step-time { font-size: 8pt; color: #10b981; }
  .step-desc { font-size: 9pt; color: #64748b; margin-bottom: 8px; }
  .step-data { background: #f8fafc; border-radius: 6px; padding: 10px; margin-top: 8px; }
  .step-data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .data-item { display: flex; flex-direction: column; gap: 2px; }
  .data-label { font-size: 8pt; color: #64748b; text-transform: uppercase; }
  .data-value { font-size: 9pt; font-weight: 500; color: #1a1f36; }
  .evidence-section { margin-top: 10px; }
  .evidence-title { font-size: 9pt; font-weight: 600; color: #6366f1; margin-bottom: 8px; }
  .evidence-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .evidence-item { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .evidence-item img { width: 100%; height: 60px; object-fit: cover; }
  .evidence-item .caption { font-size: 7pt; color: #64748b; padding: 4px; text-align: center; background: #f8fafc; }
  .summary-section { display: flex; justify-content: flex-end; margin: 16px 0; }
  .summary-box { width: 220px; background: #f8fafc; border-radius: 8px; padding: 12px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 9pt; }
  .summary-row.total { border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 10px; font-size: 11pt; font-weight: 700; }
  .summary-row.total .amount { color: #6366f1; }
  .signatures { display: flex; gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  .signature-box { flex: 1; text-align: center; }
  .signature-line { border-top: 1px solid #1a1f36; margin-bottom: 6px; width: 100px; margin-left: auto; margin-right: auto; }
  .signature-box p { font-size: 9pt; color: #64748b; }
  .footer { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body><div class="page">
<div class="header">
  <div class="company-info"><h1>${data.companyName}</h1><p>${data.companyAddress}</p><p>${data.companyCity}</p><p>GSTIN: ${data.gstin}</p></div>
  <div class="doc-badge"><h2>GOODS RECEIPT NOTE</h2><div class="doc-number">${data.transactionNumber}</div><div class="date">Date: ${new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div><span class="status-tag status-${(data.status || 'active').toLowerCase()}">${data.status === 'COMPLETED' ? 'Completed' : data.status === 'ACTIVE' ? 'In Progress' : data.status}</span></div>
</div>
<div class="info-grid">
  <div class="info-box"><h3>Vendor Details</h3><p><strong>${data.vendorName}</strong></p><p>Vehicle: ${data.vehicleNumber}</p><p>Driver: ${data.driverName}</p><p>Contact: ${data.driverMobile}</p></div>
  <div class="info-box"><h3>Order Details</h3><p>PO: <strong>${data.poNumber}</strong></p><p>Material: ${data.materialType}</p><p>Grade: ${data.grade}</p><p>Rate: ₹${formatNum(data.rate)}/KG</p></div>
</div>
<h3 class="section-title">Weight Information</h3>
<div class="weight-section"><div class="weight-grid">
  <div class="weight-item"><h4>Gross Weight</h4><div class="value">${formatNum(data.grossWeight)} KG</div></div>
  <div class="weight-item"><h4>Tare Weight</h4><div class="value">${formatNum(data.tareWeight)} KG</div></div>
  <div class="weight-item highlight"><h4>Net Weight</h4><div class="value">${formatNum(data.netWeight)} KG</div></div>
</div></div>
<h3 class="section-title">Process Steps</h3>
<div class="steps-container">${stepsHtml}</div>
<div class="summary-section"><div class="summary-box">
  <div class="summary-row"><span>Net Weight</span><span>${formatNum(data.netWeight)} KG</span></div>
  <div class="summary-row"><span>Rate</span><span>₹${formatNum(data.rate)}/KG</span></div>
  <div class="summary-row"><span>Subtotal</span><span>₹${formatCur(data.subtotal)}</span></div>
  <div class="summary-row"><span>GST (18%)</span><span>₹${formatCur(data.gstAmount)}</span></div>
  <div class="summary-row total"><span>Grand Total</span><span class="amount">₹${formatCur(data.grandTotal)}</span></div>
</div></div>
<div class="signatures">
  <div class="signature-box"><div class="signature-line"></div><p>Gate Operator</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>QC Inspector</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Weighbridge</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Authorized</p></div>
</div>
<div class="footer"><p>Computer-generated document. Contact: operations@xyzmetals.com | +91 22 1234 5678</p></div>
</div></body></html>`;
  }


  private getPurchaseOrderTemplate(data: any): string {
    const formatCur = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const totalAmount = (data.orderedQuantity || 0) * (data.rate || 0);
    const gst = totalAmount * 0.18;
    const total = totalAmount + gst;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PO - ${data.poNumber}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1a1f36; }
  .page { padding: 10mm; }
  .header { display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 3px solid #6366f1; margin-bottom: 20px; }
  .company-info h1 { font-size: 18pt; font-weight: 700; color: #6366f1; margin-bottom: 4px; }
  .company-info p { font-size: 9pt; color: #64748b; }
  .doc-badge { text-align: right; }
  .doc-badge h2 { font-size: 11pt; color: #1a1f36; margin-bottom: 4px; }
  .doc-number { font-size: 14pt; font-weight: 700; color: #6366f1; font-family: monospace; }
  .date { font-size: 9pt; color: #64748b; margin-top: 4px; }
  .status-tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; text-transform: uppercase; margin-top: 6px; }
  .status-pending { background: #fef3c7; color: #b45309; }
  .status-partial { background: #e0e7ff; color: #4338ca; }
  .status-completed { background: #d1fae5; color: #059669; }
  .info-grid { display: flex; gap: 20px; margin-bottom: 20px; }
  .info-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 14px; border-left: 3px solid #6366f1; }
  .info-box h3 { font-size: 9pt; color: #6366f1; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
  .info-box p { font-size: 9pt; color: #475569; margin-bottom: 4px; }
  .info-box p strong { color: #1a1f36; }
  .section-title { font-size: 11pt; font-weight: 600; color: #1a1f36; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 10px; text-align: left; font-size: 9pt; }
  td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  .text-right { text-align: right; }
  .summary-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .summary-box { width: 240px; background: #f8fafc; border-radius: 8px; padding: 14px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 9pt; }
  .summary-row.total { border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 10px; font-size: 11pt; font-weight: 700; }
  .summary-row.total .amount { color: #6366f1; }
  .signatures { display: flex; gap: 40px; margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0; }
  .signature-box { flex: 1; text-align: center; }
  .signature-line { border-top: 1px solid #1a1f36; margin-bottom: 6px; width: 120px; margin-left: auto; margin-right: auto; }
  .signature-box p { font-size: 9pt; color: #64748b; }
  .footer { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 25px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
</style></head><body><div class="page">
<div class="header">
  <div class="company-info"><h1>XYZ Metal Recyclers</h1><p>123 Industrial Area, Phase 2</p><p>Mumbai, Maharashtra - 400001</p><p>GSTIN: 27AABCU9603R1ZM</p></div>
  <div class="doc-badge"><h2>PURCHASE ORDER</h2><div class="doc-number">${data.poNumber}</div><div class="date">Date: ${formatDate(data.createdAt)}</div><span class="status-tag status-${(data.status || 'pending').toLowerCase()}">${data.status || 'Pending'}</span></div>
</div>
<div class="info-grid">
  <div class="info-box"><h3>Vendor Details</h3><p><strong>${data.vendorName || data.vendor?.vendorName || 'N/A'}</strong></p><p>Contact: ${data.vendor?.contactPersonName || 'N/A'}</p><p>Phone: ${data.vendor?.contactPhone || 'N/A'}</p></div>
  <div class="info-box"><h3>Delivery Details</h3><p>Expected: <strong>${formatDate(data.deliveryDate)}</strong></p><p>Terms: ${data.deliveryTerms || 'Ex-Works'}</p><p>Payment: ${data.paymentTerms || 'Net 30 Days'}</p></div>
</div>
<h3 class="section-title">Order Items</h3>
<table><thead><tr><th>Material</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody><tr><td><strong>${data.materialType || 'N/A'}</strong></td><td>${data.materialDescription || 'Standard quality'}</td><td class="text-right">${(data.orderedQuantity || 0).toLocaleString('en-IN')} ${data.unit || 'KG'}</td><td class="text-right">${formatCur(data.rate)}</td><td class="text-right">${formatCur(totalAmount)}</td></tr></tbody></table>
<div class="summary-section"><div class="summary-box">
  <div class="summary-row"><span>Subtotal</span><span>${formatCur(totalAmount)}</span></div>
  <div class="summary-row"><span>GST (18%)</span><span>${formatCur(gst)}</span></div>
  <div class="summary-row total"><span>Total</span><span class="amount">${formatCur(total)}</span></div>
</div></div>
<div class="signatures">
  <div class="signature-box"><div class="signature-line"></div><p>Prepared By</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Approved By</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Vendor Acceptance</p></div>
</div>
<div class="footer"><p>Computer-generated document. Contact: procurement@xyzmetals.com | +91 22 1234 5678</p></div>
</div></body></html>`;
  }

  private getGatePassTemplate(data: any): string {
    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const formatTime = (d: any) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const gateEntryData = data.stepData?.[1]?.data || {};

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gate Pass - ${data.transactionNumber}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1a1f36; }
  .page { padding: 10mm; }
  .header { display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 3px solid #6366f1; margin-bottom: 20px; }
  .company-info h1 { font-size: 18pt; font-weight: 700; color: #6366f1; margin-bottom: 4px; }
  .company-info p { font-size: 9pt; color: #64748b; }
  .doc-badge { text-align: right; }
  .doc-badge h2 { font-size: 11pt; color: #1a1f36; margin-bottom: 4px; }
  .doc-number { font-size: 14pt; font-weight: 700; color: #6366f1; font-family: monospace; }
  .date { font-size: 9pt; color: #64748b; margin-top: 4px; }
  .status-tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; text-transform: uppercase; margin-top: 6px; }
  .status-active { background: #fef3c7; color: #b45309; }
  .status-completed { background: #d1fae5; color: #059669; }
  .gate-info { display: flex; gap: 20px; margin-bottom: 20px; }
  .gate-box { flex: 1; background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%); border-radius: 10px; padding: 16px; text-align: center; }
  .gate-box h4 { font-size: 9pt; color: #6366f1; margin-bottom: 6px; text-transform: uppercase; }
  .gate-box .time { font-size: 20pt; font-weight: 700; color: #1a1f36; }
  .gate-box .date { font-size: 10pt; color: #64748b; margin-top: 4px; }
  .vehicle-info { background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; gap: 20px; }
  .vehicle-item { flex: 1; }
  .vehicle-item h4 { font-size: 9pt; color: #64748b; margin-bottom: 4px; }
  .vehicle-item p { font-size: 12pt; font-weight: 600; color: #1a1f36; }
  .info-grid { display: flex; gap: 20px; margin-bottom: 20px; }
  .info-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 14px; border-left: 3px solid #6366f1; }
  .info-box h3 { font-size: 9pt; color: #6366f1; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
  .info-box p { font-size: 9pt; color: #475569; margin-bottom: 4px; }
  .info-box p strong { color: #1a1f36; }
  .signatures { display: flex; gap: 30px; margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0; }
  .signature-box { flex: 1; text-align: center; }
  .signature-line { border-top: 1px solid #1a1f36; margin-bottom: 6px; width: 100px; margin-left: auto; margin-right: auto; }
  .signature-box p { font-size: 9pt; color: #64748b; }
  .footer { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 25px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
</style></head><body><div class="page">
<div class="header">
  <div class="company-info"><h1>XYZ Metal Recyclers</h1><p>123 Industrial Area, Phase 2</p><p>Mumbai, Maharashtra - 400001</p></div>
  <div class="doc-badge"><h2>GATE PASS</h2><div class="doc-number">${data.transactionNumber}</div><div class="date">Date: ${formatDate(data.createdAt)}</div><span class="status-tag status-${data.status === 'COMPLETED' ? 'completed' : 'active'}">${data.status === 'COMPLETED' ? 'Exited' : 'Inside'}</span></div>
</div>
<div class="gate-info">
  <div class="gate-box"><h4>Entry Time</h4><div class="time">${formatTime(data.createdAt)}</div><div class="date">${formatDate(data.createdAt)}</div></div>
  <div class="gate-box"><h4>Exit Time</h4><div class="time">${data.completedAt ? formatTime(data.completedAt) : '--:--'}</div><div class="date">${data.completedAt ? formatDate(data.completedAt) : 'Pending'}</div></div>
</div>
<div class="vehicle-info">
  <div class="vehicle-item"><h4>Vehicle Number</h4><p>${gateEntryData.truck_number || data.vehicleNumber || 'N/A'}</p></div>
  <div class="vehicle-item"><h4>Driver Name</h4><p>${gateEntryData.driver_name || 'N/A'}</p></div>
  <div class="vehicle-item"><h4>Driver Contact</h4><p>${gateEntryData.driver_mobile || 'N/A'}</p></div>
</div>
<div class="info-grid">
  <div class="info-box"><h3>Vendor Details</h3><p><strong>${data.vendorName || data.vendor?.vendorName || 'N/A'}</strong></p><p>PO: ${data.poNumber || data.purchaseOrder?.poNumber || 'N/A'}</p><p>GRN: ${data.transactionNumber}</p></div>
  <div class="info-box"><h3>Material Details</h3><p><strong>${data.materialType || data.purchaseOrder?.materialType || 'Mixed Scrap'}</strong></p><p>Net Weight: ${(data.weighbridgeData?.netWeight || 0).toLocaleString('en-IN')} KG</p><p>Purpose: Material Delivery</p></div>
</div>
<div class="signatures">
  <div class="signature-box"><div class="signature-line"></div><p>Security (Entry)</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Authorized By</p></div>
  <div class="signature-box"><div class="signature-line"></div><p>Security (Exit)</p></div>
</div>
<div class="footer"><p>Valid only for the date mentioned. Contact: security@xyzmetals.com | +91 22 1234 5678</p></div>
</div></body></html>`;
  }
}
