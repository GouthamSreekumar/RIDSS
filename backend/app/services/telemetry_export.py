"""
Telemetry PDF and PNG export service using ReportLab & Matplotlib.
Generates print-quality engineering reports with speed/rpm/throttle/brake charts, track map, and lap notes.
"""
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for server rendering
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)


def generate_telemetry_chart_image(telemetry_points: List[Dict[str, Any]]) -> bytes:
    """
    Renders Speed, RPM, Throttle/Brake, Gear, and DRS telemetry channels
    against Distance using Matplotlib in dark F1 pit-wall aesthetic.
    Returns PNG bytes.
    """
    if not telemetry_points:
        fig, ax = plt.subplots(figsize=(10, 4), facecolor="#0f172a")
        ax.set_facecolor("#0f172a")
        ax.text(0.5, 0.5, "No Telemetry Data Points Available", color="#94a3b8", ha="center", va="center")
        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="#0f172a")
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    dist = [p.get("distance", 0) for p in telemetry_points]
    speed = [p.get("speed", 0) for p in telemetry_points]
    rpm = [p.get("rpm", 0) for p in telemetry_points]
    throttle = [p.get("throttle", 0) for p in telemetry_points]
    brake = [p.get("brake", 0) for p in telemetry_points]
    gear = [p.get("gear", 0) for p in telemetry_points]

    fig, (ax_speed, ax_rpm, ax_pedals, ax_gear) = plt.subplots(
        4, 1, figsize=(10, 6.5), sharex=True, facecolor="#020617", gridspec_kw={"height_ratios": [2.5, 1.5, 1.5, 1]}
    )

    for ax in (ax_speed, ax_rpm, ax_pedals, ax_gear):
        ax.set_facecolor("#090d16")
        ax.grid(True, color="#1e293b", linestyle="--", linewidth=0.5)
        ax.tick_params(colors="#94a3b8", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#334155")

    # 1. Speed Plot
    ax_speed.plot(dist, speed, color="#ff1801", linewidth=1.5, label="Speed (km/h)")
    ax_speed.set_ylabel("Speed (km/h)", color="#f8fafc", fontsize=8, fontweight="bold")
    ax_speed.set_ylim(0, max(max(speed or [300]), 340) + 15)

    # 2. RPM Plot
    ax_rpm.plot(dist, rpm, color="#22d3ee", linewidth=1.2, label="RPM")
    ax_rpm.set_ylabel("RPM", color="#f8fafc", fontsize=8, fontweight="bold")

    # 3. Throttle & Brake Plot
    ax_pedals.plot(dist, throttle, color="#10b981", linewidth=1.2, label="Throttle %")
    ax_pedals.plot(dist, brake, color="#ef4444", linewidth=1.2, label="Brake %")
    ax_pedals.set_ylabel("Pedals (%)", color="#f8fafc", fontsize=8, fontweight="bold")
    ax_pedals.set_ylim(-5, 105)

    # 4. Gear Plot
    ax_gear.plot(dist, gear, color="#f59e0b", drawstyle="steps-post", linewidth=1.2, label="Gear")
    ax_gear.set_ylabel("Gear", color="#f8fafc", fontsize=8, fontweight="bold")
    ax_gear.set_xlabel("Distance (m)", color="#f8fafc", fontsize=9, fontweight="bold")
    ax_gear.set_ylim(0, 9)

    plt.tight_layout(pad=1.0)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=180, bbox_inches="tight", facecolor="#020617")
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def generate_track_map_image(
    telemetry_points: List[Dict[str, Any]], corners: List[Dict[str, Any]] = None
) -> bytes:
    """
    Renders 2D track map outline from X,Y telemetry points with corner markers.
    Returns PNG bytes.
    """
    fig, ax = plt.subplots(figsize=(6, 5), facecolor="#020617")
    ax.set_facecolor("#090d16")
    ax.axis("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_color("#1e293b")

    x = [p.get("x", 0) for p in telemetry_points if "x" in p]
    y = [p.get("y", 0) for p in telemetry_points if "y" in p]

    if x and y:
        ax.plot(x, y, color="#ff1801", linewidth=2.5, label="Track Layout")
        # Start/Finish indicator
        ax.scatter([x[0]], [y[0]], color="#10b981", s=40, zorder=5, label="Start/Finish")

        if corners:
            for c in corners:
                cx, cy, num = c.get("x"), c.get("y"), c.get("number")
                if cx is not None and cy is not None and num is not None:
                    ax.annotate(
                        f"T{num}",
                        (cx, cy),
                        color="#f59e0b",
                        fontsize=7,
                        fontweight="bold",
                        ha="center",
                        va="center",
                        bbox=dict(boxstyle="circle,pad=0.2", fc="#0f172a", ec="#f59e0b", lw=0.8),
                    )
    else:
        ax.text(0.5, 0.5, "Track Map Unavailable", color="#94a3b8", ha="center", va="center")

    plt.tight_layout(pad=0.8)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=180, bbox_inches="tight", facecolor="#020617")
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def export_lap_telemetry_pdf(
    session_name: str,
    circuit_name: str,
    season: int,
    driver_code: str,
    driver_number: int,
    lap_number: int,
    lap_time_str: Optional[str],
    telemetry_points: List[Dict[str, Any]],
    corners: List[Dict[str, Any]],
    notes: List[Dict[str, Any]],
    engineer_name: str,
) -> bytes:
    """
    Generates a full reportlab PDF document containing header, charts, track map, and lap notes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom F1 Styles
    title_style = ParagraphStyle(
        "F1Title",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#f8fafc"),
    )
    subtitle_style = ParagraphStyle(
        "F1SubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#94a3b8"),
    )
    section_heading = ParagraphStyle(
        "F1Section",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#ff1801"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "F1Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#cbd5e1"),
    )
    note_header_style = ParagraphStyle(
        "F1NoteHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#38bdf8"),
    )

    elements = []

    # 1. Header Banner Table
    header_data = [
        [
            Paragraph(f"<b>RIDSS TELEMETRY ANALYSIS REPORT</b><br/><font size=9 color='#94a3b8'>{circuit_name} ({season}) — {session_name}</font>", title_style),
            Paragraph(f"<font color='#ff1801'><b>CAR #{driver_number} ({driver_code})</b></font><br/><b>LAP {lap_number}</b> — <font color='#10b981'>{lap_time_str or 'N/A'}</font>", ParagraphStyle("RightHeader", parent=title_style, alignment=2, fontSize=12, leading=16)),
        ]
    ]
    header_table = Table(header_data, colWidths=[340, 200])
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#020617")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # Meta Bar Table
    meta_info = f"Exported: {datetime.now(timezone.utc).strftime('%b %d, %Y %H:%M UTC')} | Engineer: {engineer_name} | Data Source: FastF1 Telemetry Engine"
    meta_table = Table([[Paragraph(meta_info, subtitle_style)]], colWidths=[540])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    # 2. Telemetry Charts
    elements.append(Paragraph("LAP TELEMETRY TRACES", section_heading))
    chart_png = generate_telemetry_chart_image(telemetry_points)
    chart_img_obj = Image(io.BytesIO(chart_png), width=540, height=345)
    elements.append(chart_img_obj)
    elements.append(Spacer(1, 12))

    # 3. Track Map + Lap Notes Section Side by Side or Below
    elements.append(Paragraph("CIRCUIT MAP & ANNOTATED ENGINEER NOTES", section_heading))

    map_png = generate_track_map_image(telemetry_points, corners)
    map_img_obj = Image(io.BytesIO(map_png), width=230, height=190)

    notes_elements = []
    if notes:
        for n in notes:
            author = n.get("author_name") or "Race Engineer"
            dt_str = n.get("created_at") or ""
            if dt_str:
                try:
                    dt_val = datetime.fromisoformat(str(dt_str).replace("Z", "+00:00"))
                    dt_str = dt_val.strftime("%b %d, %H:%M")
                except Exception:
                    pass
            content_text = n.get("content", "")
            notes_elements.append(
                Paragraph(f"<b>{author}</b> <font color='#64748b'>({dt_str})</font>", note_header_style)
            )
            notes_elements.append(Paragraph(content_text, body_style))
            notes_elements.append(Spacer(1, 6))
    else:
        notes_elements.append(Paragraph("<i>No annotated notes recorded for this lap.</i>", body_style))

    notes_table_data = [[map_img_obj, notes_elements]]
    side_table = Table(notes_table_data, colWidths=[240, 300])
    side_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#020617")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#1e293b")),
            ]
        )
    )
    elements.append(side_table)

    # Build Document
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
