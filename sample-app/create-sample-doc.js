/**
 * Script to create a sample Word document for testing
 *
 * Run: npm install docx && node create-sample-doc.js
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } = require('docx');
const fs = require('fs');
const path = require('path');

async function createSampleDocument() {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Title
                    new Paragraph({
                        text: "Welcome to TeamSync Editor",
                        heading: HeadingLevel.TITLE,
                        spacing: { after: 400 },
                    }),

                    // Introduction
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This is a sample document to demonstrate the collaborative document editing capabilities of TeamSync Editor. ",
                            }),
                            new TextRun({
                                text: "You can edit this document in real-time with multiple users!",
                                bold: true,
                            }),
                        ],
                        spacing: { after: 200 },
                    }),

                    // Features Section
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
                        text: "TeamSync Editor supports Microsoft Office formats (.docx, .xlsx, .pptx) as well as OpenDocument formats (.odt, .ods, .odp).",
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

                    // Sample Table
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
                                        children: [new Paragraph({ text: "Format", bold: true })],
                                        shading: { fill: "2563eb" },
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Extension", bold: true })],
                                        shading: { fill: "2563eb" },
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Support", bold: true })],
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
                                    new TableCell({ children: [new Paragraph("Excel Spreadsheet")] }),
                                    new TableCell({ children: [new Paragraph(".xlsx, .xls")] }),
                                    new TableCell({ children: [new Paragraph("Full Edit")] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph("PowerPoint")] }),
                                    new TableCell({ children: [new Paragraph(".pptx, .ppt")] }),
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
                        ],
                    }),

                    // Try It Section
                    new Paragraph({
                        text: "Try It Now!",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }),

                    new Paragraph({
                        text: "Go ahead and make some changes to this document. Try the following:",
                        spacing: { after: 100 },
                    }),

                    new Paragraph({
                        text: "• Add your name below",
                        bullet: { level: 0 },
                    }),
                    new Paragraph({
                        text: "• Change the formatting of this text",
                        bullet: { level: 0 },
                    }),
                    new Paragraph({
                        text: "• Insert an image or table",
                        bullet: { level: 0 },
                    }),
                    new Paragraph({
                        text: "• Try the spell checker",
                        bullet: { level: 0 },
                    }),

                    new Paragraph({
                        text: "",
                        spacing: { before: 400 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Your name: ",
                                bold: true,
                            }),
                            new TextRun({
                                text: "_______________________",
                            }),
                        ],
                    }),

                    // Footer
                    new Paragraph({
                        text: "",
                        spacing: { before: 800 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Created with TeamSync Editor",
                                italics: true,
                                color: "666666",
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    // Generate the document
    const buffer = await Packer.toBuffer(doc);

    // Save to file
    const outputPath = path.join(__dirname, 'sample-document.docx');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Sample document created: ${outputPath}`);
    console.log(`Size: ${buffer.length} bytes`);
}

createSampleDocument().catch(console.error);
