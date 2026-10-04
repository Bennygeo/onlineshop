import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()

# Define Color Palette (TomorrowNeeds Teal / Modern E-commerce Theme)
TEAL_DARK = "097E63"
TEAL_LIGHT = "E6F4F1"
TEAL_ACCENT = "0D9677"
GOLD_ACCENT = "FFC529"
GRAY_LIGHT = "F8FAFC"
GRAY_BORDER = "E2E8F0"
GRAY_HEADER = "1E293B"

font_title = Font(name="Segoe UI", size=15, bold=True, color="FFFFFF")
font_section = Font(name="Segoe UI", size=12, bold=True, color="097E63")
font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
font_data = Font(name="Segoe UI", size=10, color="1E293B")
font_bold_data = Font(name="Segoe UI", size=10, bold=True, color="1E293B")
font_kpi_num = Font(name="Segoe UI", size=18, bold=True, color="097E63")
font_kpi_label = Font(name="Segoe UI", size=9, bold=True, color="64748B")

fill_header = PatternFill(start_color=TEAL_DARK, end_color=TEAL_DARK, fill_type="solid")
fill_sub_header = PatternFill(start_color=TEAL_ACCENT, end_color=TEAL_ACCENT, fill_type="solid")
fill_light = PatternFill(start_color=TEAL_LIGHT, end_color=TEAL_LIGHT, fill_type="solid")
fill_kpi_card = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
fill_gold = PatternFill(start_color=GOLD_ACCENT, end_color=GOLD_ACCENT, fill_type="solid")

thin_border_side = Side(border_style="thin", color=GRAY_BORDER)
thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
thick_bottom = Border(bottom=Side(border_style="medium", color=TEAL_DARK))

align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left = Alignment(horizontal="left", vertical="center")
align_right = Alignment(horizontal="right", vertical="center")

# ==========================================
# SHEET 1: DASHBOARD & KPI SUMMARY
# ==========================================
ws1 = wb.active
ws1.title = "📊 KPI Dashboard"
ws1.views.sheetView[0].showGridLines = True

# Title Banner
ws1.merge_cells("A1:G2")
title_cell = ws1["A1"]
title_cell.value = "  TOMORROWNEEDS - SUBSCRIPTION BUSINESS EXECUTIVE DASHBOARD"
title_cell.font = font_title
title_cell.fill = fill_header
title_cell.alignment = Alignment(horizontal="left", vertical="center")

# Subtitle
ws1["A3"] = "Real-time Metrics: Monthly Recurring Revenue (MRR), Active Subscribers, Delivery Fulfillment & Fee Collections"
ws1["A3"].font = Font(name="Segoe UI", size=9, italic=True, color="64748B")

# KPI Summary Cards (Row 5 - Row 7)
kpis = [
    ("B5", "B6", "B7", "Active Subscribers", "='👥 Subscriptions Master'!L2", "Total paid active customers"),
    ("C5", "C6", "C7", "Monthly Rec. Revenue (MRR)", "=SUM('👥 Subscriptions Master'!I3:I50)", "Expected monthly revenue"),
    ("D5", "D6", "D7", "Fees Collected (MTD)", "=SUM('💰 Fee Collection'!G3:G50)", "Realized revenue collected"),
    ("E5", "E6", "E7", "Pending Dues", "=SUM('💰 Fee Collection'!K3:K50)", "Outstanding payment balance"),
    ("F5", "F6", "F7", "Daily Deliveries Today", "=COUNTIF('🚚 Daily Delivery Log'!G3:G100, \"Delivered\")", "Successful daily drop-offs")
]

for top, mid, bot, label, formula, desc in kpis:
    ws1[top] = label.upper()
    ws1[top].font = font_kpi_label
    ws1[top].alignment = align_center
    ws1[top].fill = fill_kpi_card
    ws1[top].border = thin_border
    
    ws1[mid] = formula
    ws1[mid].font = font_kpi_num
    ws1[mid].alignment = align_center
    ws1[mid].fill = fill_kpi_card
    ws1[mid].border = thin_border
    if "$" in formula or "SUM" in formula:
        ws1[mid].number_format = "₹#,##0.00"
    
    ws1[bot] = desc
    ws1[bot].font = Font(name="Segoe UI", size=8, color="94A3B8")
    ws1[bot].alignment = align_center
    ws1[bot].fill = fill_kpi_card
    ws1[bot].border = thin_border

# Operational Tracking Guidelines Table
ws1["B9"] = "HOW TO TRACK YOUR BUSINESS (DAILY, WEEKLY, MONTHLY CADENCE)"
ws1["B9"].font = font_section

headers_guidelines = ["Cadence", "Responsible", "Key Activities to Review", "Target KPI / Health Indicator"]
for col_idx, text in enumerate(headers_guidelines, start=2):
    cell = ws1.cell(row=10, column=col_idx, value=text)
    cell.font = font_header
    cell.fill = fill_header
    cell.alignment = align_center
    cell.border = thin_border

cadence_data = [
    ("DAILY (Evening 7:00 PM)", "Store Operations", "Review pause/resume requests for tomorrow; check raw milk/batter/veggie procurement count.", "0 Missed deliveries, 100% order prep by 6:00 AM"),
    ("DAILY (Morning 8:30 AM)", "Delivery Fleet", "Verify morning doorstep drops (Log sheet); flag unreachable customers or wrong gate drops.", "Fulfillment Rate > 99.5% by 7:00 AM"),
    ("DAILY (Midday 12:00 PM)", "Accounts / Admin", "Check wallet balances < ₹200; auto-remind customers via WhatsApp / App push to top up.", "Wallet health > 80% positive balance"),
    ("WEEKLY (Every Monday)", "Growth & Marketing", "Analyze new subscription additions vs cancellations (churn); review trial-to-paid conversion.", "Weekly Net Growth Rate > 5%"),
    ("WEEKLY (Every Friday)", "Procurement / Vendors", "Reconcile vendor batch rates, wastage % (greens/fruits), and packaging supply inventory.", "Wastage Loss < 3.5% of total procurement"),
    ("MONTHLY (1st of Month)", "Business Owner", "Audit MRR, total fees collected, subscription renewals, average customer lifetime value (LTV).", "Collection Efficiency > 98%, Churn < 4%")
]

for row_idx, row_vals in enumerate(cadence_data, start=11):
    for col_idx, val in enumerate(row_vals, start=2):
        c = ws1.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = thin_border
        if col_idx == 2:
            c.font = font_bold_data
            c.fill = fill_light


# ==========================================
# SHEET 2: CUSTOMER SUBSCRIPTIONS MASTER
# ==========================================
ws2 = wb.create_sheet(title="👥 Subscriptions Master")
ws2.views.sheetView[0].showGridLines = True

ws2["A1"] = "TOMORROWNEEDS - ACTIVE & RECURRING SUBSCRIPTIONS MASTER DIRECTORY"
ws2["A1"].font = font_section
ws2["L2"] = "=COUNTIF(K3:K50, \"Active\")" # formula used in dashboard

sub_headers = [
    "Cust ID", "Customer Name", "Phone / WhatsApp", "Delivery Zone / Pincode",
    "Door / Flat / Apartment", "Subscribed Plan / Items", "Frequency",
    "Daily Qty", "Monthly Plan Fee (₹)", "Start Date", "Status",
    "Wallet Balance (₹)", "Next Billing Date", "Auto-Renew"
]

for col_idx, text in enumerate(sub_headers, start=1):
    cell = ws2.cell(row=2, column=col_idx, value=text)
    cell.font = font_header
    cell.fill = fill_header
    cell.alignment = align_center
    cell.border = thin_border

sample_subs = [
    ("TN-SUB-101", "Ramesh Kumar", "9840123456", "Chennai - 600095", "Flat 402, Green Acres Apt", "Farm Fresh Buffalo Milk", "Daily", "1 Litre", 2100, "2026-09-01", "Active", 850, "2026-11-01", "Yes (Wallet)"),
    ("TN-SUB-102", "Priya Sundaram", "9840234567", "Chennai - 600095", "Plot 12, Anna Nagar West", "Stoneground Idli/Dosa Batter", "Alternate Days", "1 Kg", 750, "2026-09-15", "Active", 420, "2026-10-15", "Yes (Wallet)"),
    ("TN-SUB-103", "Anand Venkatesh", "9840345678", "Chennai - 600028", "Villa 9, Palm Meadows", "Organic Vegetables Basket (5kg)", "Weekly (Sat)", "1 Basket", 1400, "2026-08-01", "Active", 1200, "2026-11-01", "Manual UPI"),
    ("TN-SUB-104", "Deepa Mohan", "9840456789", "Chennai - 600095", "Door 18, 3rd Cross Street", "Fresh Country Cow Milk", "Daily", "500 ml", 1200, "2026-09-20", "Active", 150, "2026-10-20", "Yes (Wallet)"),
    ("TN-SUB-105", "Karthik Subramanian", "9840567890", "Chennai - 600041", "B-301, Skyline Towers", "Cold-Pressed Sesame & Groundnut Oil", "Monthly", "2 Litres", 900, "2026-09-01", "Active", 900, "2026-11-01", "Yes (Wallet)"),
    ("TN-SUB-106", "Sneha Balaji", "9840678901", "Chennai - 600095", "Flat 104, Oasis Heights", "Fresh Greens & Spinach Combo", "Mon / Wed / Fri", "2 Bunches", 480, "2026-10-01", "Paused", 300, "2026-11-01", "Manual UPI"),
    ("TN-SUB-107", "Manoj Prabhakar", "9840789012", "Chennai - 600028", "No 54, Gandhi Road", "Farm Fresh Cow Milk + Batter", "Daily", "1L + 1Kg", 2850, "2026-07-01", "Active", 2100, "2026-11-01", "Yes (Wallet)")
]

for row_idx, row_vals in enumerate(sample_subs, start=3):
    for col_idx, val in enumerate(row_vals, start=1):
        c = ws2.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = thin_border
        if col_idx in [1, 7, 8, 10, 11, 13, 14]:
            c.alignment = align_center
        elif col_idx in [9, 12]:
            c.alignment = align_right
            c.number_format = "₹#,##0.00"
        else:
            c.alignment = align_left


# ==========================================
# SHEET 3: DAILY DELIVERY LOG
# ==========================================
ws3 = wb.create_sheet(title="🚚 Daily Delivery Log")
ws3.views.sheetView[0].showGridLines = True

ws3["A1"] = "TOMORROWNEEDS - MORNING 7:00 AM FULFILLMENT & DISPATCH LOG"
ws3["A1"].font = font_section

delivery_headers = [
    "Date", "Slot Time", "Cust ID", "Customer Name", "Delivery Address",
    "Subscribed Items to Pack", "Fulfillment Status", "Delivery Executive",
    "Delivered At", "Customer Notes / Gate Code"
]

for col_idx, text in enumerate(delivery_headers, start=1):
    cell = ws3.cell(row=2, column=col_idx, value=text)
    cell.font = font_header
    cell.fill = fill_header
    cell.alignment = align_center
    cell.border = thin_border

sample_deliveries = [
    ("2026-10-04", "06:00 - 07:00 AM", "TN-SUB-101", "Ramesh Kumar", "Flat 402, Green Acres Apt", "1L Buffalo Milk (Chilled Pouch)", "Delivered", "Murugan (Rider 1)", "06:22 AM", "Leave inside door bag"),
    ("2026-10-04", "06:00 - 07:00 AM", "TN-SUB-102", "Priya Sundaram", "Plot 12, Anna Nagar West", "1Kg Idli/Dosa Batter", "Delivered", "Murugan (Rider 1)", "06:35 AM", "Ring bell once"),
    ("2026-10-04", "06:00 - 07:00 AM", "TN-SUB-104", "Deepa Mohan", "Door 18, 3rd Cross Street", "500ml Country Cow Milk", "Delivered", "Saravanan (Rider 2)", "06:15 AM", "Keep in milk box"),
    ("2026-10-04", "06:00 - 07:00 AM", "TN-SUB-107", "Manoj Prabhakar", "No 54, Gandhi Road", "1L Cow Milk + 1Kg Batter", "Delivered", "Saravanan (Rider 2)", "06:48 AM", "Door hook drop"),
    ("2026-10-05", "06:00 - 07:00 AM", "TN-SUB-101", "Ramesh Kumar", "Flat 402, Green Acres Apt", "1L Buffalo Milk", "Scheduled", "Murugan (Rider 1)", "--", "Door bag"),
    ("2026-10-05", "06:00 - 07:00 AM", "TN-SUB-104", "Deepa Mohan", "Door 18, 3rd Cross Street", "500ml Country Cow Milk", "Scheduled", "Saravanan (Rider 2)", "--", "Milk box"),
    ("2026-10-05", "06:00 - 07:00 AM", "TN-SUB-107", "Manoj Prabhakar", "No 54, Gandhi Road", "1L Cow Milk + 1Kg Batter", "Scheduled", "Saravanan (Rider 2)", "--", "Door hook")
]

for row_idx, row_vals in enumerate(sample_deliveries, start=3):
    for col_idx, val in enumerate(row_vals, start=1):
        c = ws3.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = thin_border
        if col_idx in [1, 2, 3, 7, 9]:
            c.alignment = align_center
            if val == "Delivered":
                c.font = font_bold_data
                c.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
        else:
            c.alignment = align_left


# ==========================================
# SHEET 4: FEE COLLECTION & INVOICING
# ==========================================
ws4 = wb.create_sheet(title="💰 Fee Collection")
ws4.views.sheetView[0].showGridLines = True

ws4["A1"] = "TOMORROWNEEDS - SUBSCRIPTION FEES & PAYMENT RECONCILIATION"
ws4["A1"].font = font_section

fee_headers = [
    "Invoice #", "Cust ID", "Customer Name", "Billing Cycle", "Plan Fee (₹)",
    "Extra Orders (₹)", "Total Billed (₹)", "Paid via Wallet (₹)",
    "Paid via UPI / Card (₹)", "Cash / Direct (₹)", "Balance Due (₹)",
    "Payment Status", "Txn Reference / Notes", "Payment Date"
]

for col_idx, text in enumerate(fee_headers, start=1):
    cell = ws4.cell(row=2, column=col_idx, value=text)
    cell.font = font_header
    cell.fill = fill_header
    cell.alignment = align_center
    cell.border = thin_border

sample_fees = [
    ("INV-2026-1001", "TN-SUB-101", "Ramesh Kumar", "Oct 2026 (Monthly)", 2100, 180, "=E3+F3", 2280, 0, 0, "=G3-(H3+I3+J3)", "Paid in Full", "Auto-deducted from Wallet", "2026-10-01"),
    ("INV-2026-1002", "TN-SUB-102", "Priya Sundaram", "Oct 2026 (Monthly)", 750, 0, "=E4+F4", 750, 0, 0, "=G4-(H4+I4+J4)", "Paid in Full", "Wallet auto-debit", "2026-10-01"),
    ("INV-2026-1003", "TN-SUB-103", "Anand Venkatesh", "Oct 2026 (Monthly)", 1400, 320, "=E5+F5", 0, 1720, 0, "=G5-(H5+I5+J5)", "Paid in Full", "Razorpay UPI (rzp_live_xxx)", "2026-10-02"),
    ("INV-2026-1004", "TN-SUB-104", "Deepa Mohan", "Oct 2026 (Monthly)", 1200, 0, "=E6+F6", 150, 0, 0, "=G6-(H6+I6+J6)", "Pending Dues", "Insufficient wallet; reminder sent", "Pending"),
    ("INV-2026-1005", "TN-SUB-105", "Karthik Subramanian", "Oct 2026 (Monthly)", 900, 0, "=E7+F7", 900, 0, 0, "=G7-(H7+I7+J7)", "Paid in Full", "Wallet balance debit", "2026-10-01"),
    ("INV-2026-1006", "TN-SUB-107", "Manoj Prabhakar", "Oct 2026 (Monthly)", 2850, 450, "=E8+F8", 2850, 450, 0, "=G8-(H8+I8+J8)", "Paid in Full", "Wallet (2850) + UPI (450)", "2026-10-01")
]

for row_idx, row_vals in enumerate(sample_fees, start=3):
    for col_idx, val in enumerate(row_vals, start=1):
        c = ws4.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = thin_border
        if col_idx in [1, 2, 4, 12, 14]:
            c.alignment = align_center
            if val == "Paid in Full":
                c.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
            elif val == "Pending Dues":
                c.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                c.font = font_bold_data
        elif col_idx in [5, 6, 7, 8, 9, 10, 11]:
            c.alignment = align_right
            c.number_format = "₹#,##0.00"
        else:
            c.alignment = align_left


# ==========================================
# SHEET 5: DEMAND FORECAST & PROCUREMENT
# ==========================================
ws5 = wb.create_sheet(title="📦 Inventory & Demand Forecast")
ws5.views.sheetView[0].showGridLines = True

ws5["A1"] = "TOMORROWNEEDS - DAILY RECURRING DEMAND & PROCUREMENT PLANNER"
ws5["A1"].font = font_section

demand_headers = [
    "Item ID", "Item Name", "Category", "Pack Size / Unit",
    "Active Daily Subscriptions Demand", "Buffer / Extra On-Demand Orders",
    "Total Daily Procurement Target", "Vendor Cost / Unit (₹)",
    "Total Daily Procurement Budget (₹)", "Retail Selling Price (₹)", "Daily Margin (₹)"
]

for col_idx, text in enumerate(demand_headers, start=1):
    cell = ws5.cell(row=2, column=col_idx, value=text)
    cell.font = font_header
    cell.fill = fill_header
    cell.alignment = align_center
    cell.border = thin_border

sample_demand = [
    ("ITM-01", "Fresh Buffalo Milk", "Milk & Dairy", "1 Litre Pouch", 18, 5, "=E3+F3", 52, "=G3*H3", 70, "=(J3-H3)*G3"),
    ("ITM-02", "Country Cow Milk (Pure A2)", "Milk & Dairy", "500 ml Pouch", 24, 6, "=E4+F4", 30, "=G4*H4", 40, "=(J4-H4)*G4"),
    ("ITM-03", "Fresh Idli/Dosa Batter", "Batters", "1 Kg Pouch", 14, 8, "=E5+F5", 35, "=G5*H5", 50, "=(J5-H5)*G5"),
    ("ITM-04", "Organic Vegetable Basket", "Vegetables", "5 Kg Assorted", 8, 3, "=E6+F6", 240, "=G6*H6", 350, "=(J6-H6)*G6"),
    ("ITM-05", "Fresh Spinach & Greens Combo", "Greens", "2 Bunches", 12, 4, "=E7+F7", 18, "=G7*H7", 30, "=(J7-H7)*G7"),
    ("ITM-06", "Cold-Pressed Sesame Oil", "Oils", "1 Litre Bottle", 5, 2, "=E8+F8", 280, "=G8*H8", 380, "=(J8-H8)*G8")
]

for row_idx, row_vals in enumerate(sample_demand, start=3):
    for col_idx, val in enumerate(row_vals, start=1):
        c = ws5.cell(row=row_idx, column=col_idx, value=val)
        c.font = font_data
        c.border = thin_border
        if col_idx in [1, 3, 4]:
            c.alignment = align_center
        elif col_idx in [5, 6, 7]:
            c.alignment = align_center
            c.font = font_bold_data
        elif col_idx in [8, 9, 10, 11]:
            c.alignment = align_right
            c.number_format = "₹#,##0.00"
            if col_idx == 11:
                c.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                c.font = font_bold_data
        else:
            c.alignment = align_left


# Auto-fit Column Widths across all sheets
for sheet in wb.worksheets:
    for col in sheet.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if cell.number_format and "₹" in cell.number_format:
                val_str += "    "
            if len(val_str) > max_len:
                max_len = len(val_str)
        sheet.column_dimensions[col_letter].width = max(max_len + 4, 13)

# Save Workbook
output_path = r"c:\Users\Benny\Downloads\thinkspot-home\thinkspot-home\thinkspot-home\TomorrowNeeds_Subscription_Tracker.xlsx"
wb.save(output_path)
print("Workbook successfully saved to:", output_path)
