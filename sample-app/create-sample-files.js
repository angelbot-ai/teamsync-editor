/**
 * Script to create sample files for testing all three TeamSync Editor products
 *
 * Run: npm install docx exceljs pptxgenjs && node create-sample-files.js
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = require('docx');
const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

// ============================================================================
// TeamSync Document - Sample Word Document
// ============================================================================

async function createSampleDocument() {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        text: "Welcome to TeamSync Document",
                        heading: HeadingLevel.TITLE,
                        spacing: { after: 400 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This is a sample document to demonstrate the collaborative document editing capabilities of TeamSync Document. ",
                            }),
                            new TextRun({
                                text: "You can edit this document in real-time with multiple users!",
                                bold: true,
                            }),
                        ],
                        spacing: { after: 200 },
                    }),

                    new Paragraph({
                        text: "Key Features",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }),

                    new Paragraph({
                        text: "Real-time Collaboration",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200 },
                    }),
                    new Paragraph({
                        text: "Multiple users can edit the same document simultaneously. Changes are synced instantly across all connected users.",
                        spacing: { after: 200 },
                    }),

                    new Paragraph({
                        text: "Full Office Compatibility",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200 },
                    }),
                    new Paragraph({
                        text: "TeamSync Document supports Microsoft Word formats (.docx, .doc) as well as OpenDocument formats (.odt, .rtf, .txt).",
                        spacing: { after: 200 },
                    }),

                    new Paragraph({
                        text: "Secure & Private",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200 },
                    }),
                    new Paragraph({
                        text: "Your documents are stored securely and never leave your infrastructure. Enterprise-grade security with OAuth2/OIDC authentication.",
                        spacing: { after: 200 },
                    }),

                    new Paragraph({
                        text: "Supported File Types",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                tableHeader: true,
                                children: [
                                    new TableCell({
                                        children: [new Paragraph({ text: "Format" })],
                                        shading: { fill: "2563eb" },
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Extension" })],
                                        shading: { fill: "2563eb" },
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Support" })],
                                        shading: { fill: "2563eb" },
                                    }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("Word Document")] }),
                                    new TableCell({ children: [new Paragraph(".docx, .doc")] }),
                                    new TableCell({ children: [new Paragraph("Full Edit")] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("OpenDocument Text")] }),
                                    new TableCell({ children: [new Paragraph(".odt")] }),
                                    new TableCell({ children: [new Paragraph("Full Edit")] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("Rich Text Format")] }),
                                    new TableCell({ children: [new Paragraph(".rtf")] }),
                                    new TableCell({ children: [new Paragraph("Full Edit")] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("Plain Text")] }),
                                    new TableCell({ children: [new Paragraph(".txt")] }),
                                    new TableCell({ children: [new Paragraph("Full Edit")] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({
                        text: "Try It Now!",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }),

                    new Paragraph({
                        text: "Go ahead and make some changes to this document:",
                        spacing: { after: 100 },
                    }),

                    new Paragraph({ text: "- Add your name below", bullet: { level: 0 } }),
                    new Paragraph({ text: "- Change the formatting of this text", bullet: { level: 0 } }),
                    new Paragraph({ text: "- Insert an image or table", bullet: { level: 0 } }),
                    new Paragraph({ text: "- Try the spell checker", bullet: { level: 0 } }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),

                    new Paragraph({
                        children: [
                            new TextRun({ text: "Your name: ", bold: true }),
                            new TextRun({ text: "_______________________" }),
                        ],
                    }),

                    new Paragraph({ text: "", spacing: { before: 800 } }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Created with TeamSync Document",
                                italics: true,
                                color: "666666",
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'sample-document.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Document] Created: ${outputPath} (${buffer.length} bytes)`);
}

// ============================================================================
// TeamSync Sheets - Sample Excel Spreadsheet
// ============================================================================

async function createSampleSpreadsheet() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TeamSync Sheets';
    workbook.created = new Date();

    // --- Sheet 1: Sales Dashboard ---
    const dashboardSheet = workbook.addWorksheet('Sales Dashboard', {
        properties: { tabColor: { argb: '16A34A' } }
    });

    // Title
    dashboardSheet.mergeCells('A1:G1');
    const titleCell = dashboardSheet.getCell('A1');
    titleCell.value = 'TeamSync Sheets - Sales Dashboard Demo';
    titleCell.font = { size: 20, bold: true, color: { argb: '2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dashboardSheet.getRow(1).height = 40;

    // Subtitle
    dashboardSheet.mergeCells('A2:G2');
    const subtitleCell = dashboardSheet.getCell('A2');
    subtitleCell.value = 'Quarterly Sales Report - Sample Data for Testing';
    subtitleCell.font = { size: 12, italic: true, color: { argb: '666666' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // Headers for sales data
    const headers = ['Product', 'Q1 Sales', 'Q2 Sales', 'Q3 Sales', 'Q4 Sales', 'Total', 'Growth'];
    dashboardSheet.getRow(4).values = headers;
    dashboardSheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFF' } };
    dashboardSheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '16A34A' }
    };
    dashboardSheet.getRow(4).alignment = { horizontal: 'center' };

    // Sample sales data
    const salesData = [
        ['Laptop Pro', 45000, 52000, 48000, 61000],
        ['Desktop Plus', 32000, 35000, 38000, 42000],
        ['Tablet Lite', 28000, 31000, 29000, 35000],
        ['Monitor 4K', 15000, 18000, 22000, 25000],
        ['Keyboard Elite', 8000, 9500, 11000, 12500],
        ['Mouse Pro', 5000, 6000, 7500, 8000],
        ['Webcam HD', 12000, 14000, 16000, 19000],
        ['Headset Pro', 9000, 10500, 12000, 14500],
    ];

    salesData.forEach((row, index) => {
        const rowNum = index + 5;
        const excelRow = dashboardSheet.getRow(rowNum);
        excelRow.values = [
            row[0],
            row[1],
            row[2],
            row[3],
            row[4],
            { formula: `SUM(B${rowNum}:E${rowNum})` },
            { formula: `IF(B${rowNum}=0,0,ROUND((E${rowNum}-B${rowNum})/B${rowNum}*100,1))` }
        ];

        // Alternate row colors
        if (index % 2 === 0) {
            excelRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F0FDF4' }
            };
        }
    });

    // Totals row
    const totalRow = dashboardSheet.getRow(13);
    totalRow.values = [
        'TOTAL',
        { formula: 'SUM(B5:B12)' },
        { formula: 'SUM(C5:C12)' },
        { formula: 'SUM(D5:D12)' },
        { formula: 'SUM(E5:E12)' },
        { formula: 'SUM(F5:F12)' },
        { formula: 'AVERAGE(G5:G12)' }
    ];
    totalRow.font = { bold: true };
    totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'DCFCE7' }
    };

    // Format currency columns
    for (let row = 5; row <= 13; row++) {
        for (let col = 2; col <= 6; col++) {
            dashboardSheet.getCell(row, col).numFmt = '$#,##0';
        }
        dashboardSheet.getCell(row, 7).numFmt = '0.0"%"';
    }

    // Column widths
    dashboardSheet.columns = [
        { width: 18 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 14 },
        { width: 10 },
    ];

    // --- Sheet 2: Formulas Demo ---
    const formulasSheet = workbook.addWorksheet('Formulas Demo', {
        properties: { tabColor: { argb: '2563EB' } }
    });

    formulasSheet.mergeCells('A1:D1');
    formulasSheet.getCell('A1').value = 'Common Excel Formulas - Test These!';
    formulasSheet.getCell('A1').font = { size: 16, bold: true };

    const formulaExamples = [
        ['', '', '', ''],
        ['Formula Type', 'Formula', 'Input', 'Result'],
        ['SUM', '=SUM(C4:C6)', '10, 20, 30', { formula: 'SUM(10,20,30)' }],
        ['AVERAGE', '=AVERAGE(C4:C6)', '10, 20, 30', { formula: 'AVERAGE(10,20,30)' }],
        ['MAX', '=MAX(C4:C6)', '10, 20, 30', { formula: 'MAX(10,20,30)' }],
        ['MIN', '=MIN(C4:C6)', '10, 20, 30', { formula: 'MIN(10,20,30)' }],
        ['COUNT', '=COUNT(C4:C6)', '10, 20, 30', { formula: 'COUNT(10,20,30)' }],
        ['IF', '=IF(D4>15,"High","Low")', 'Value: 20', { formula: 'IF(20>15,"High","Low")' }],
        ['CONCATENATE', '=A&" "&B', 'Team, Sync', { formula: 'CONCATENATE("Team"," ","Sync")' }],
        ['TODAY', '=TODAY()', 'Current Date', { formula: 'TODAY()' }],
        ['NOW', '=NOW()', 'Current DateTime', { formula: 'NOW()' }],
        ['ROUND', '=ROUND(3.14159,2)', '3.14159', { formula: 'ROUND(3.14159,2)' }],
    ];

    formulaExamples.forEach((row, index) => {
        formulasSheet.getRow(index + 1).values = row;
        if (index === 2) {
            formulasSheet.getRow(index + 1).font = { bold: true };
            formulasSheet.getRow(index + 1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'DBEAFE' }
            };
        }
    });

    formulasSheet.columns = [
        { width: 15 },
        { width: 25 },
        { width: 20 },
        { width: 15 },
    ];

    // --- Sheet 3: Data Entry ---
    const dataSheet = workbook.addWorksheet('Data Entry', {
        properties: { tabColor: { argb: 'F59E0B' } }
    });

    dataSheet.mergeCells('A1:E1');
    dataSheet.getCell('A1').value = 'Try Editing This Data!';
    dataSheet.getCell('A1').font = { size: 16, bold: true };

    dataSheet.getRow(3).values = ['Name', 'Department', 'Salary', 'Start Date', 'Status'];
    dataSheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFF' } };
    dataSheet.getRow(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F59E0B' }
    };

    const employees = [
        ['John Smith', 'Engineering', 85000, new Date('2020-03-15'), 'Active'],
        ['Sarah Johnson', 'Marketing', 72000, new Date('2019-06-01'), 'Active'],
        ['Mike Williams', 'Sales', 68000, new Date('2021-01-10'), 'Active'],
        ['Emily Brown', 'HR', 65000, new Date('2018-09-20'), 'Active'],
        ['Your Name Here', 'Your Department', 0, new Date(), 'Edit Me!'],
    ];

    employees.forEach((emp, index) => {
        dataSheet.getRow(index + 4).values = emp;
    });

    // Format salary column
    for (let row = 4; row <= 8; row++) {
        dataSheet.getCell(row, 3).numFmt = '$#,##0';
        dataSheet.getCell(row, 4).numFmt = 'yyyy-mm-dd';
    }

    dataSheet.columns = [
        { width: 20 },
        { width: 15 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
    ];

    // Save workbook
    const outputPath = path.join(__dirname, 'sample-spreadsheet.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    const stats = fs.statSync(outputPath);
    console.log(`[Sheets] Created: ${outputPath} (${stats.size} bytes)`);
}

// ============================================================================
// TeamSync Presentation - Sample PowerPoint Presentation
// ============================================================================

async function createSamplePresentation() {
    const pptx = new PptxGenJS();
    pptx.author = 'TeamSync Presentation';
    pptx.title = 'TeamSync Presentation Demo';
    pptx.subject = 'Sample Presentation for Testing';
    pptx.company = 'TeamSync';

    // Define theme colors
    const primaryColor = '2563EB';
    const secondaryColor = 'DC2626';
    const accentColor = '10B981';
    const darkColor = '1E293B';
    const lightColor = 'F8FAFC';

    // --- Slide 1: Title Slide ---
    const slide1 = pptx.addSlide();
    slide1.background = { color: primaryColor };

    slide1.addText('TeamSync Presentation', {
        x: 0.5, y: 2.0, w: '90%', h: 1.5,
        fontSize: 44, bold: true, color: 'FFFFFF',
        align: 'center', fontFace: 'Arial'
    });

    slide1.addText('Collaborative Presentations Made Easy', {
        x: 0.5, y: 3.5, w: '90%', h: 0.8,
        fontSize: 24, color: 'FFFFFF',
        align: 'center', fontFace: 'Arial'
    });

    slide1.addText('Sample Presentation for Testing', {
        x: 0.5, y: 4.5, w: '90%', h: 0.5,
        fontSize: 16, italic: true, color: 'B3D4FC',
        align: 'center', fontFace: 'Arial'
    });

    // --- Slide 2: Features Overview ---
    const slide2 = pptx.addSlide();
    slide2.background = { color: lightColor };

    slide2.addText('Key Features', {
        x: 0.5, y: 0.4, w: '90%', h: 0.8,
        fontSize: 32, bold: true, color: darkColor,
        fontFace: 'Arial'
    });

    const features = [
        { icon: '🎨', title: 'Beautiful Templates', desc: 'Professional designs for any occasion' },
        { icon: '👥', title: 'Real-time Collaboration', desc: 'Work together with your team simultaneously' },
        { icon: '📱', title: 'Cross-Platform', desc: 'Access from any device, anywhere' },
        { icon: '🔒', title: 'Enterprise Security', desc: 'Your data stays on your servers' }
    ];

    features.forEach((feature, index) => {
        const yPos = 1.5 + (index * 1.2);

        slide2.addText(feature.icon, {
            x: 0.5, y: yPos, w: 0.8, h: 0.8,
            fontSize: 28, align: 'center'
        });

        slide2.addText(feature.title, {
            x: 1.5, y: yPos, w: 4, h: 0.5,
            fontSize: 20, bold: true, color: darkColor,
            fontFace: 'Arial'
        });

        slide2.addText(feature.desc, {
            x: 1.5, y: yPos + 0.4, w: 7, h: 0.4,
            fontSize: 14, color: '64748B',
            fontFace: 'Arial'
        });
    });

    // --- Slide 3: Chart Demo ---
    const slide3 = pptx.addSlide();
    slide3.background = { color: 'FFFFFF' };

    slide3.addText('Sales Performance', {
        x: 0.5, y: 0.4, w: '90%', h: 0.8,
        fontSize: 32, bold: true, color: darkColor,
        fontFace: 'Arial'
    });

    slide3.addChart(pptx.ChartType.bar, [
        {
            name: 'Q1',
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            values: [45, 32, 28, 15]
        },
        {
            name: 'Q2',
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            values: [52, 35, 31, 18]
        },
        {
            name: 'Q3',
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            values: [48, 38, 29, 22]
        },
        {
            name: 'Q4',
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            values: [61, 42, 35, 25]
        }
    ], {
        x: 0.5, y: 1.5, w: 9, h: 4,
        chartColors: [primaryColor, accentColor, 'F59E0B', secondaryColor],
        showTitle: false,
        showLegend: true,
        legendPos: 'b'
    });

    // --- Slide 4: Table Demo ---
    const slide4 = pptx.addSlide();
    slide4.background = { color: 'FFFFFF' };

    slide4.addText('Team Overview', {
        x: 0.5, y: 0.4, w: '90%', h: 0.8,
        fontSize: 32, bold: true, color: darkColor,
        fontFace: 'Arial'
    });

    const tableData = [
        [
            { text: 'Name', options: { bold: true, fill: primaryColor, color: 'FFFFFF' } },
            { text: 'Role', options: { bold: true, fill: primaryColor, color: 'FFFFFF' } },
            { text: 'Department', options: { bold: true, fill: primaryColor, color: 'FFFFFF' } },
            { text: 'Status', options: { bold: true, fill: primaryColor, color: 'FFFFFF' } }
        ],
        ['Alice Chen', 'Product Manager', 'Product', 'Active'],
        ['Bob Smith', 'Lead Developer', 'Engineering', 'Active'],
        ['Carol Davis', 'UX Designer', 'Design', 'Active'],
        ['David Wilson', 'QA Engineer', 'Quality', 'Active'],
        ['Your Name', 'Your Role', 'Your Dept', 'Edit Me!']
    ];

    slide4.addTable(tableData, {
        x: 0.5, y: 1.5, w: 9, h: 3.5,
        fontFace: 'Arial',
        fontSize: 14,
        color: darkColor,
        border: { pt: 1, color: 'E2E8F0' },
        align: 'left',
        valign: 'middle'
    });

    // --- Slide 5: Bullet Points Demo ---
    const slide5 = pptx.addSlide();
    slide5.background = { color: 'FFFFFF' };

    slide5.addText('Getting Started', {
        x: 0.5, y: 0.4, w: '90%', h: 0.8,
        fontSize: 32, bold: true, color: darkColor,
        fontFace: 'Arial'
    });

    slide5.addText([
        { text: 'Upload your presentation files', options: { bullet: true, indentLevel: 0 } },
        { text: 'Supports .pptx, .ppt, and .odp formats', options: { bullet: true, indentLevel: 1, fontSize: 14, color: '64748B' } },
        { text: 'Invite your team members', options: { bullet: true, indentLevel: 0 } },
        { text: 'Share via link or email invitation', options: { bullet: true, indentLevel: 1, fontSize: 14, color: '64748B' } },
        { text: 'Edit together in real-time', options: { bullet: true, indentLevel: 0 } },
        { text: 'See changes instantly as they happen', options: { bullet: true, indentLevel: 1, fontSize: 14, color: '64748B' } },
        { text: 'Present directly from the browser', options: { bullet: true, indentLevel: 0 } },
        { text: 'Full-screen presentation mode available', options: { bullet: true, indentLevel: 1, fontSize: 14, color: '64748B' } },
        { text: 'Export to PDF or download as PPTX', options: { bullet: true, indentLevel: 0 } }
    ], {
        x: 0.5, y: 1.3, w: 9, h: 4,
        fontSize: 18, color: darkColor,
        fontFace: 'Arial',
        paraSpaceBefore: 8,
        paraSpaceAfter: 4
    });

    // --- Slide 6: Thank You Slide ---
    const slide6 = pptx.addSlide();
    slide6.background = { color: accentColor };

    slide6.addText('Thank You!', {
        x: 0.5, y: 2.0, w: '90%', h: 1.2,
        fontSize: 48, bold: true, color: 'FFFFFF',
        align: 'center', fontFace: 'Arial'
    });

    slide6.addText('Try editing this presentation!', {
        x: 0.5, y: 3.3, w: '90%', h: 0.8,
        fontSize: 24, color: 'FFFFFF',
        align: 'center', fontFace: 'Arial'
    });

    slide6.addText([
        { text: 'Add new slides', options: { bullet: true } },
        { text: 'Modify the charts', options: { bullet: true } },
        { text: 'Update the table data', options: { bullet: true } },
        { text: 'Change colors and fonts', options: { bullet: true } }
    ], {
        x: 2.5, y: 4.2, w: 5, h: 1.5,
        fontSize: 16, color: 'FFFFFF',
        fontFace: 'Arial', align: 'left'
    });

    // Save presentation
    const outputPath = path.join(__dirname, 'sample-presentation.pptx');
    await pptx.writeFile({ fileName: outputPath });
    const stats = fs.statSync(outputPath);
    console.log(`[Presentation] Created: ${outputPath} (${stats.size} bytes)`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function createAllSampleFiles() {
    console.log('\n=== Creating Sample Files for TeamSync Editor ===\n');

    try {
        await createSampleDocument();
    } catch (error) {
        console.error('[Document] Error:', error.message);
    }

    try {
        await createSampleSpreadsheet();
    } catch (error) {
        console.error('[Sheets] Error:', error.message);
    }

    try {
        await createSamplePresentation();
    } catch (error) {
        console.error('[Presentation] Error:', error.message);
    }

    console.log('\n=== All sample files created! ===\n');
    console.log('Files created:');
    console.log('  - sample-document.docx    -> Open with TeamSync Document (port 9980)');
    console.log('  - sample-spreadsheet.xlsx -> Open with TeamSync Sheets (port 9981)');
    console.log('  - sample-presentation.pptx -> Open with TeamSync Presentation (port 9982)');
    console.log('\nRun the multi-variant Docker Compose:');
    console.log('  docker-compose -f docker-compose.multi.yml up -d\n');
}

createAllSampleFiles().catch(console.error);
