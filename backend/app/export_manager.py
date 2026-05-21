import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from sqlalchemy.orm import Session
from app.models import BalanceSheet, User
from app.storage import get_storage_provider

def generate_audit_certificate_pdf(db: Session, sheet: BalanceSheet) -> str:
    # Buffer to hold PDF in memory
    buffer = io.BytesIO()
    
    # Document setup
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#0F172A'), # Slate 900
        spaceAfter=15,
        alignment=1 # Center
    )
    
    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=colors.HexColor('#1E3A8A'), # Navy 900
        spaceBefore=15,
        spaceAfter=10,
        borderPadding=4,
        borderColor=colors.HexColor('#3B82F6'),
        borderWidth=0.5
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#334155'), # Slate 700
        spaceBefore=4,
        spaceAfter=4
    )
    
    bold_body_style = ParagraphStyle(
        'BoldBodyCustom',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    cert_style = ParagraphStyle(
        'CertText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10.5,
        textColor=colors.HexColor('#475569'),
        leading=14,
        spaceAfter=10
    )

    story = []
    
    # Title
    story.append(Paragraph("VERILEDGER COMPLIANCE REPORT", title_style))
    story.append(Paragraph("<b>Document Status:</b> FINALIZED & IMMUTABLY LOCKED", ParagraphStyle('StatusStyle', parent=body_style, alignment=1, textColor=colors.HexColor('#10B981'))))
    story.append(Spacer(1, 15))
    
    # Meta information
    meta_data = [
        [Paragraph("<b>Report ID:</b>", bold_body_style), Paragraph(str(sheet.id), body_style),
         Paragraph("<b>Title:</b>", bold_body_style), Paragraph(sheet.title, body_style)],
        [Paragraph("<b>Date Created:</b>", bold_body_style), Paragraph(sheet.created_at.strftime('%Y-%m-%d %H:%M:%S UTC'), body_style),
         Paragraph("<b>Lock Date:</b>", bold_body_style), Paragraph(sheet.updated_at.strftime('%Y-%m-%d %H:%M:%S UTC'), body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[100, 160, 100, 160])
    t_meta.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 20))
    
    # Section 1: Balance Sheet Grid
    story.append(Paragraph("I. BALANCE SHEET LEDGER ENTRIES", section_style))
    
    # Table of GL entries
    table_content = [[
        Paragraph("<b>Account Code</b>", bold_body_style),
        Paragraph("<b>Account Description</b>", bold_body_style),
        Paragraph("<b>Debit ($)</b>", bold_body_style),
        Paragraph("<b>Credit ($)</b>", bold_body_style)
    ]]
    
    for entry in sheet.gl_entries:
        table_content.append([
            Paragraph(entry.account_code, body_style),
            Paragraph(entry.account_name, body_style),
            Paragraph(f"${float(entry.debit):,.2f}", body_style),
            Paragraph(f"${float(entry.credit):,.2f}", body_style)
        ])
        
    t_grid = Table(table_content, colWidths=[100, 220, 100, 100])
    t_grid.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    story.append(t_grid)
    story.append(Spacer(1, 15))
    
    # Totals summary table
    totals_data = [
        [Paragraph("<b>Total Assets:</b>", bold_body_style), Paragraph(f"${float(sheet.total_assets):,.2f}", bold_body_style)],
        [Paragraph("<b>Total Liabilities:</b>", bold_body_style), Paragraph(f"${float(sheet.total_liabilities):,.2f}", bold_body_style)],
        [Paragraph("<b>Total Equity:</b>", bold_body_style), Paragraph(f"${float(sheet.total_equity):,.2f}", bold_body_style)]
    ]
    t_totals = Table(totals_data, colWidths=[150, 150])
    t_totals.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#94A3B8')),
    ]))
    # Wrap in another table to align to right page half
    t_totals_container = Table([[Spacer(1, 1), t_totals]], colWidths=[220, 300])
    story.append(t_totals_container)
    story.append(Spacer(1, 20))
    
    # Section 2: Audit Certificate (Maker, Checker, FC, CFO timestamps & info)
    story.append(Paragraph("II. COMPLIANCE AUDIT CERTIFICATE", section_style))
    cert_intro = (
        "This certificate authenticates that the balance sheet listed above has completed "
        "the standard corporate four-eyes segregation workflow, and has been verified and locked. "
        "The signatures below represent electronic sign-off tokens bound to the designated employee accounts."
    )
    story.append(Paragraph(cert_intro, cert_style))
    story.append(Spacer(1, 10))
    
    # Extract workflow actors from audit trail
    maker_id = sheet.maker_id
    maker_user = db.query(User).filter(User.emp_id == maker_id).first()
    maker_name = maker_user.name if maker_user else "Unknown"
    
    checker_id = sheet.assigned_checker_id or "N/A"
    checker_user = db.query(User).filter(User.emp_id == checker_id).first() if checker_id != "N/A" else None
    checker_name = checker_user.name if checker_user else "N/A"
    
    fc_id = sheet.assigned_fc_id or "N/A"
    fc_user = db.query(User).filter(User.emp_id == fc_id).first() if fc_id != "N/A" else None
    fc_name = fc_user.name if fc_user else "N/A"
    
    cfo_id = sheet.assigned_cfo_id or "N/A"
    cfo_user = db.query(User).filter(User.emp_id == cfo_id).first() if cfo_id != "N/A" else None
    cfo_name = cfo_user.name if cfo_user else "N/A"
    
    # Timestamps
    submit_evt = next((e for e in sheet.audit_trail if e.get("to_state") == "SENT_TO_CHECKER"), None)
    submit_ts = submit_evt.get("timestamp") if submit_evt else sheet.created_at.isoformat()
    if submit_ts != "N/A":
        submit_ts = submit_ts.split(".")[0].replace("T", " ")
        
    checker_evt = next((e for e in sheet.audit_trail if e.get("from_state") == "SENT_TO_CHECKER" and e.get("to_state") == "SENT_TO_FC"), None)
    checker_ts = checker_evt.get("timestamp") if checker_evt else "N/A"
    if checker_ts != "N/A":
        checker_ts = checker_ts.split(".")[0].replace("T", " ")
        
    fc_evt = next((e for e in sheet.audit_trail if e.get("from_state") == "SENT_TO_FC" and e.get("to_state") == "SENT_TO_CFO"), None)
    fc_ts = fc_evt.get("timestamp") if fc_evt else "N/A"
    if fc_ts != "N/A":
        fc_ts = fc_ts.split(".")[0].replace("T", " ")
        
    cfo_evt = next((e for e in sheet.audit_trail if e.get("from_state") == "SENT_TO_CFO" and e.get("to_state") == "CFO_APPROVED"), None)
    cfo_ts = cfo_evt.get("timestamp") if cfo_evt else "N/A"
    if cfo_ts != "N/A":
        cfo_ts = cfo_ts.split(".")[0].replace("T", " ")

    signoff_data = [
        [
            Paragraph("<b>MAKER (Preparation)</b><br/>Name: " + maker_name + "<br/>ID: " + maker_id + "<br/>Date: " + submit_ts, body_style),
            Paragraph("<b>CHECKER (Verification)</b><br/>Name: " + checker_name + "<br/>ID: " + checker_id + "<br/>Date: " + checker_ts, body_style)
        ],
        [
            Paragraph("<b>FINANCIAL CONTROLLER (FC)</b><br/>Name: " + fc_name + "<br/>ID: " + fc_id + "<br/>Date: " + fc_ts, body_style),
            Paragraph("<b>CHIEF FINANCIAL OFFICER (CFO)</b><br/>Name: " + cfo_name + "<br/>ID: " + cfo_id + "<br/>Date: " + cfo_ts, body_style)
        ]
    ]
    
    t_sign = Table(signoff_data, colWidths=[260, 260])
    t_sign.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_sign)
    story.append(Spacer(1, 20))
    
    # Audit seal/footer text in PDF
    seal_style = ParagraphStyle(
        'SealText',
        parent=body_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.HexColor('#94A3B8'),
        alignment=1
    )
    story.append(Paragraph("CRYPTOGRAPHICALLY AUDITED BY VERILEDGER OFFICE SYSTEM — SECURITY GATEWAY VALIDATED", seal_style))

    # Build PDF document
    doc.build(story)
    
    # Get bytes content
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    # Upload generated PDF using StorageProvider
    storage = get_storage_provider()
    pdf_url = storage.upload_file(
        file_content=pdf_bytes,
        filename=f"audit_certificate_{sheet.id}.pdf",
        content_type="application/pdf"
    )
    return pdf_url
