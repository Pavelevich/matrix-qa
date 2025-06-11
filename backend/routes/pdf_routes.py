from fastapi import APIRouter, Depends, HTTPException, Response
from datetime import datetime
from typing import Optional
import io
import re
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate
from pydantic import BaseModel

try:
    from mongo_routes.auth_routes import get_current_user
except ImportError:
    def get_current_user():
        return {"user": "anonymous"}

router = APIRouter(tags=["pdf"])


class PDFReportRequest(BaseModel):
    title: str
    content: str
    model: Optional[str] = None
    instructions: Optional[str] = None
    timestamp: Optional[str] = None


def create_clean_styles():
    styles = getSampleStyleSheet()

    primary_dark = HexColor('#2c3e50')
    secondary_blue = HexColor('#3498db')
    success_green = HexColor('#27ae60')
    light_gray = HexColor('#ecf0f1')
    medium_gray = HexColor('#7f8c8d')
    text_dark = HexColor('#34495e')
    border_color = HexColor('#bdc3c7')

    title_style = ParagraphStyle(
        'CleanTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=primary_dark,
        alignment=TA_CENTER,
        spaceAfter=10,
        spaceBefore=0,
        fontName='Helvetica-Bold',
        leading=28,
        letterSpace=1
    )

    subtitle_style = ParagraphStyle(
        'CleanSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=medium_gray,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica',
        leading=18
    )

    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=text_dark,
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold',
        leading=20
    )

    meta_label = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontSize=11,
        textColor=primary_dark,
        fontName='Helvetica-Bold',
        leading=16
    )

    meta_text = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=primary_dark,
        fontName='Helvetica',
        leading=16
    )

    body_text = ParagraphStyle(
        'CleanBody',
        parent=styles['Normal'],
        fontSize=11,
        textColor=text_dark,
        spaceAfter=8,
        fontName='Helvetica',
        leading=16,
        alignment=TA_LEFT
    )

    instructions_text = ParagraphStyle(
        'InstructionsText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=text_dark,
        spaceAfter=8,
        fontName='Helvetica',
        leading=16,
        leftIndent=0
    )

    result_title = ParagraphStyle(
        'ResultTitle',
        parent=styles['Normal'],
        fontSize=16,
        textColor=success_green,
        fontName='Helvetica-Bold',
        spaceAfter=10,
        leading=20
    )

    result_text = ParagraphStyle(
        'ResultText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=text_dark,
        fontName='Helvetica',
        spaceAfter=8,
        leading=16
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=text_dark,
        fontName='Courier',
        backColor=HexColor('#f1f1f1'),
        spaceAfter=5,
        leading=14
    )

    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=medium_gray,
        alignment=TA_CENTER,
        fontName='Helvetica',
        leading=14
    )

    return {
        'title': title_style,
        'subtitle': subtitle_style,
        'section_title': section_title,
        'meta_label': meta_label,
        'meta_text': meta_text,
        'body': body_text,
        'instructions': instructions_text,
        'result_title': result_title,
        'result_text': result_text,
        'code': code_style,
        'footer': footer_style,
        'colors': {
            'primary_dark': primary_dark,
            'secondary_blue': secondary_blue,
            'success_green': success_green,
            'light_gray': light_gray,
            'medium_gray': medium_gray,
            'text_dark': text_dark,
            'border_color': border_color
        }
    }


def parse_matrix_qa_content(content):
    parsed_data = {
        'date': None,
        'instructions': None,
        'model': None,
        'target_url': None,
        'security_test': None,
        'test_instructions': None,
        'results': None
    }

    if '============================================' in content:
        header_part, results_part = content.split('============================================', 1)
    else:
        header_part = content
        results_part = ""

    date_match = re.search(r'Date:\s*([^\n]+)', header_part)
    if date_match:
        parsed_data['date'] = date_match.group(1).strip()

    model_match = re.search(r'Model:\s*([^\n]+)', header_part)
    if model_match:
        parsed_data['model'] = model_match.group(1).strip()

    instructions_match = re.search(r'Instructions:\s*(.+)', header_part, re.DOTALL)
    if instructions_match:
        full_instructions = instructions_match.group(1).strip()
        parsed_data['instructions'] = full_instructions

        if 'TARGET URL:' in full_instructions:
            target_match = re.search(r'TARGET URL:\s*([^\s\n]+)', full_instructions)
            if target_match:
                parsed_data['target_url'] = target_match.group(1)

            security_match = re.search(r'SECURITY TEST:\s*([^\n]+)', full_instructions)
            if security_match:
                parsed_data['security_test'] = security_match.group(1).strip()

            detailed_instructions_match = re.search(r'INSTRUCTIONS:\s*(.+)', full_instructions, re.DOTALL)
            if detailed_instructions_match:
                parsed_data['test_instructions'] = detailed_instructions_match.group(1).strip()

        else:
            url_patterns = [
                r'\[([^\|]+)\|([^\]]+)\]',
                r'\[([^\]]+)\]',
                r'https?://[^\s\]]+',
            ]

            for pattern in url_patterns:
                match = re.search(pattern, full_instructions)
                if match:
                    if len(match.groups()) > 1:
                        parsed_data['target_url'] = match.group(2)
                    else:
                        parsed_data['target_url'] = match.group(1)
                    break

            parsed_data['test_instructions'] = full_instructions

    if results_part:
        parsed_data['results'] = results_part.strip()

    return parsed_data


def create_header_section():
    styles = create_clean_styles()
    story = []

    story.append(Paragraph("MATRIX QA TEST RUNNER", styles['title']))
    story.append(Paragraph("EXECUTION RESULT", styles['subtitle']))

    separator_table = Table([['']], colWidths=[6.5 * inch])
    separator_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 3, styles['colors']['primary_dark']),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(separator_table)
    story.append(Spacer(1, 20))

    return story


def create_meta_info_box(parsed_data, report_data):
    styles = create_clean_styles()

    timestamp = parsed_data.get('date') or report_data.timestamp or datetime.now().isoformat()

    try:
        if 'T' in timestamp and ('Z' in timestamp or '+' in timestamp):
            if timestamp.endswith('Z'):
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            else:
                dt = datetime.fromisoformat(timestamp)
            formatted_date = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
        else:
            formatted_date = timestamp
    except:
        formatted_date = timestamp

    target_url = parsed_data.get('target_url') or 'Not specified'
    security_test = parsed_data.get('security_test') or 'General Security Assessment'
    model = parsed_data.get('model') or report_data.model or 'Unknown'

    meta_data = [
        ['Date:', formatted_date],
        ['Target URL:', target_url],
        ['Security Test:', security_test],
        ['Model:', model]
    ]

    meta_table = Table(meta_data, colWidths=[1.2 * inch, 5 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), styles['colors']['light_gray']),
        ('TEXTCOLOR', (0, 0), (0, -1), styles['colors']['primary_dark']),
        ('TEXTCOLOR', (1, 0), (1, -1), styles['colors']['primary_dark']),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0, white),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
    ]))

    return meta_table


def create_separator():
    styles = create_clean_styles()

    separator_table = Table([['']], colWidths=[6.5 * inch])
    separator_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 2, styles['colors']['secondary_blue']),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))

    return separator_table


def create_instructions_box(instructions_text):
    styles = create_clean_styles()

    if not instructions_text:
        return []

    story = []
    story.append(Paragraph("Test Instructions", styles['section_title']))

    sentences = re.split(r'(?<=[.!?])\s+(?=\d+\)|[A-Z])', instructions_text)

    if len(sentences) > 1:
        formatted_instructions = []
        for i, sentence in enumerate(sentences, 1):
            sentence = sentence.strip()
            if sentence:
                sentence = re.sub(r'^\d+\)\s*', '', sentence)
                formatted_instructions.append(f"{i}. {sentence}")

        instructions_content = '\n'.join(formatted_instructions)
    else:
        instructions_content = f"1. {instructions_text.strip()}"

    instructions_para = Paragraph(instructions_content.replace('\n', '<br/>'), styles['instructions'])

    instructions_table = Table([[instructions_para]], colWidths=[6 * inch])
    instructions_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f8f9fa')),
        ('TEXTCOLOR', (0, 0), (-1, -1), styles['colors']['text_dark']),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('LINEBEFORE', (0, 0), (-1, -1), 4, HexColor('#e74c3c')),
    ]))
    story.append(instructions_table)

    return story


def create_result_box(results_content, target_url):
    styles = create_clean_styles()

    if not results_content:
        results_content = "Test completed successfully."

    clean_content = re.sub(r'<[^>]+>', ' ', results_content)
    clean_content = clean_content.replace('&lt;', '<').replace('&gt;', '>')
    clean_content = ' '.join(clean_content.split())

    content_lower = clean_content.lower()

    positive_indicators = [
        'valid', 'secure', 'properly', 'good', 'strong', 'a+', 'available',
        'completed', 'successful', 'no issues', 'no vulnerabilities',
        'deployed', 'working'
    ]

    negative_indicators = [
        'vulnerability', 'missing', 'weak', 'exposed', 'error', 'warning',
        'failed', 'insecure', 'expired', 'invalid', 'not found'
    ]

    has_positive = any(indicator in content_lower for indicator in positive_indicators)
    has_negative = any(indicator in content_lower for indicator in negative_indicators)

    if has_positive and not has_negative:
        result_title = "🛡️ Test Result: SECURE"
        bg_color = HexColor('#d5f4e6')
        border_color = styles['colors']['success_green']
    elif has_negative:
        result_title = "⚠️ Test Result: ISSUES FOUND"
        bg_color = HexColor('#fff3cd')
        border_color = HexColor('#fd7e14')
    else:
        result_title = "ℹ️ Test Result: COMPLETED"
        bg_color = HexColor('#e8f4fd')
        border_color = styles['colors']['secondary_blue']

    story_elements = []

    title_para = Paragraph(result_title, styles['result_title'])
    story_elements.append([title_para])

    if target_url:
        url_para = Paragraph(f"Target URL: {target_url}", styles['code'])
        story_elements.append([url_para])

    max_chars_per_para = 800
    if len(clean_content) > max_chars_per_para:
        sentences = re.split(r'(?<=[.!?])\s+', clean_content)
        current_para = ""

        for sentence in sentences:
            if len(current_para + sentence) > max_chars_per_para and current_para:
                para = Paragraph(current_para.strip(), styles['result_text'])
                story_elements.append([para])
                current_para = sentence + " "
            else:
                current_para += sentence + " "

        if current_para.strip():
            para = Paragraph(current_para.strip(), styles['result_text'])
            story_elements.append([para])
    else:
        content_para = Paragraph(clean_content, styles['result_text'])
        story_elements.append([content_para])

    result_table = Table(story_elements, colWidths=[6 * inch])
    result_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('GRID', (0, 0), (-1, -1), 1, border_color),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
    ]))

    return result_table


def generate_pdf_report(report_data: PDFReportRequest) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )

    styles = create_clean_styles()
    story = []

    parsed_data = parse_matrix_qa_content(report_data.content)

    story.extend(create_header_section())

    meta_box = create_meta_info_box(parsed_data, report_data)
    story.append(meta_box)
    story.append(Spacer(1, 30))

    story.append(create_separator())
    story.append(Spacer(1, 20))

    test_instructions = parsed_data.get('test_instructions') or report_data.instructions
    if test_instructions:
        instructions_elements = create_instructions_box(test_instructions)
        story.extend(instructions_elements)
        story.append(Spacer(1, 30))

        story.append(create_separator())
        story.append(Spacer(1, 20))

    results_content = parsed_data.get('results') or report_data.content
    result_box = create_result_box(results_content, parsed_data.get('target_url'))
    story.append(result_box)

    story.append(Spacer(1, 40))
    footer_text = f"Report generated on: {datetime.now().strftime('%m/%d/%Y, %I:%M:%S %p')}"
    story.append(Paragraph(footer_text, styles['footer']))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


@router.post("/generate")
async def generate_pdf_report_endpoint(
        report_request: PDFReportRequest,
        current_user: dict = Depends(get_current_user)
):
    try:
        pdf_content = generate_pdf_report(report_request)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"matrix_qa_report_{timestamp}.pdf"

        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


@router.post("/generate-from-history")
async def generate_pdf_from_history(
        history_data: dict,
        current_user: dict = Depends(get_current_user)
):
    try:
        report_request = PDFReportRequest(
            title=history_data.get('title', 'MATRIX QA Test Report'),
            content=history_data.get('content', ''),
            model=history_data.get('model'),
            instructions=history_data.get('instructions'),
            timestamp=history_data.get('timestamp')
        )

        pdf_content = generate_pdf_report(report_request)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        title_clean = re.sub(r'[^a-zA-Z0-9\-_]', '_', history_data.get('title', 'report'))[:20]
        filename = f"matrix_qa_report_{title_clean}_{timestamp}.pdf"

        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF from history: {str(e)}")