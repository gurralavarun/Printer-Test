// Chief Bill Initial Data
const DEFAULT_BILL_DATA = {
  orderNo: "#CS241027",
  table: "T-08",
  date: "22 Sep 2026",
  time: "01:15 PM",
  orderType: "Dine In",
  badgeSub: "PREPARE WITH CARE",
  instructions: "No onion. Serve hot.",
  footerNote: "KINDLY PREPARE AND SERVE FRESH",
  items: [
    { id: 1, name: "Veg Biryani", qty: 1, remarks: "-" },
    { id: 2, name: "Paneer Butter Masala", qty: 1, remarks: "Less Spicy" },
    { id: 3, name: "Chapati", qty: 2, remarks: "-" },
    { id: 4, name: "Buttermilk", qty: 1, remarks: "Chilled" },
    { id: 5, name: "Gulab Jamun", qty: 1, remarks: "-" }
  ]
};

let currentBill = JSON.parse(JSON.stringify(DEFAULT_BILL_DATA));
let orderCounter = 241027;

// DOM Elements - Inputs
const inpOrderNo = document.getElementById("inp-orderno");
const inpTable = document.getElementById("inp-table");
const inpDate = document.getElementById("inp-date");
const inpTime = document.getElementById("inp-time");
const inpType = document.getElementById("inp-type");
const inpInstructions = document.getElementById("inp-instructions");
const itemsEditorContainer = document.getElementById("items-editor-container");

// DOM Elements - Preview Targets
const prevOrderNo = document.getElementById("preview-orderno");
const prevTable = document.getElementById("preview-table");
const prevTableBox = document.getElementById("preview-table-box");
const prevDate = document.getElementById("preview-date");
const prevTime = document.getElementById("preview-time");
const prevType = document.getElementById("preview-type");
const prevInstructions = document.getElementById("preview-instructions");
const prevItemsList = document.getElementById("preview-items-list");

// Header Buttons
const btnNewOrder = document.getElementById("btn-new-order");
const btnResetSample = document.getElementById("btn-reset-sample");
const btnPrintBrowser = document.getElementById("btn-print-browser");
const btnDirectPrint = document.getElementById("btn-direct-print");
const btnAddItem = document.getElementById("btn-add-item");
const btnAutoOrderNo = document.getElementById("btn-auto-orderno");
const btnNowDateTime = document.getElementById("btn-now-datetime");

// Toast
const printToast = document.getElementById("print-toast");
const toastTitle = document.getElementById("toast-title");
const toastMsg = document.getElementById("toast-msg");

// Fallback to base64 images if available
if (typeof ASSETS !== "undefined") {
  const logoEl = document.getElementById("receipt-logo");
  const noteEl = document.getElementById("receipt-note-icon");
  if (logoEl && ASSETS.logo) logoEl.src = ASSETS.logo;
  if (noteEl && ASSETS.noteIcon) noteEl.src = ASSETS.noteIcon;
}

// Format Current Date and Time
function getFormattedNow() {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = String(now.getDate()).padStart(2, "0");
  const m = months[now.getMonth()];
  const y = now.getFullYear();
  const dateStr = `${d} ${m} ${y}`;

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

  return { dateStr, timeStr };
}

// Render Items in Editor Table
function renderEditorItems() {
  itemsEditorContainer.innerHTML = "";
  currentBill.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row-edit";
    row.innerHTML = `
      <span class="row-idx">${index + 1}</span>
      <input type="text" class="inp-item-name" data-idx="${index}" value="${escapeHtml(item.name)}" placeholder="Item name" list="menu-items-list">
      <div class="qty-stepper">
        <button type="button" class="btn-step btn-minus" data-idx="${index}">-</button>
        <input type="text" class="inp-item-qty" data-idx="${index}" value="${escapeHtml(String(item.qty))}">
        <button type="button" class="btn-step btn-plus" data-idx="${index}">+</button>
      </div>
      <input type="text" class="inp-item-rem" data-idx="${index}" value="${escapeHtml(item.remarks || '-')}" placeholder="Remarks">
      <button type="button" class="btn-del-row" data-idx="${index}" title="Remove Item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    itemsEditorContainer.appendChild(row);
  });

  // Attach event listeners
  itemsEditorContainer.querySelectorAll(".inp-item-name").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.idx);
      currentBill.items[idx].name = e.target.value;
      updatePreview();
    });
  });

  itemsEditorContainer.querySelectorAll(".inp-item-qty").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.idx);
      const val = parseInt(e.target.value) || 1;
      currentBill.items[idx].qty = val;
      updatePreview();
    });
  });

  itemsEditorContainer.querySelectorAll(".btn-minus").forEach(btn => {
    btn.addEventListener("click", e => {
      const idx = parseInt(e.target.dataset.idx);
      let qty = parseInt(currentBill.items[idx].qty) || 1;
      if (qty > 1) {
        qty--;
        currentBill.items[idx].qty = qty;
        renderEditorItems();
        updatePreview();
      }
    });
  });

  itemsEditorContainer.querySelectorAll(".btn-plus").forEach(btn => {
    btn.addEventListener("click", e => {
      const idx = parseInt(e.target.dataset.idx);
      let qty = parseInt(currentBill.items[idx].qty) || 1;
      qty++;
      currentBill.items[idx].qty = qty;
      renderEditorItems();
      updatePreview();
    });
  });

  itemsEditorContainer.querySelectorAll(".inp-item-rem").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.idx);
      currentBill.items[idx].remarks = e.target.value;
      updatePreview();
    });
  });

  itemsEditorContainer.querySelectorAll(".btn-del-row").forEach(btn => {
    btn.addEventListener("click", e => {
      const targetBtn = e.target.closest(".btn-del-row");
      const idx = parseInt(targetBtn.dataset.idx);
      currentBill.items.splice(idx, 1);
      renderEditorItems();
      updatePreview();
    });
  });
}

// Render Preview Items
function renderPreviewItems() {
  prevItemsList.innerHTML = "";
  currentBill.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "receipt-item-row";
    row.innerHTML = `
      <div class="col-num">${index + 1}</div>
      <div class="col-item">${escapeHtml(item.name)}</div>
      <div class="col-qty item-qty">${escapeHtml(String(item.qty))}</div>
      <div class="col-rem item-rem">${escapeHtml(item.remarks || '-')}</div>
    `;
    prevItemsList.appendChild(row);
  });
}

// Update Preview
function updatePreview() {
  prevOrderNo.textContent = currentBill.orderNo;
  prevTable.textContent = currentBill.table;
  prevTableBox.textContent = currentBill.table;
  prevDate.textContent = currentBill.date;
  prevTime.textContent = currentBill.time;
  prevType.textContent = currentBill.orderType;
  prevInstructions.textContent = currentBill.instructions || "None";

  renderPreviewItems();
}

// Sync Editor Inputs to Current State
function syncFormValues() {
  inpOrderNo.value = currentBill.orderNo;
  inpTable.value = currentBill.table;
  inpDate.value = currentBill.date;
  inpTime.value = currentBill.time;
  inpType.value = currentBill.orderType;
  inpInstructions.value = currentBill.instructions;

  // Sync Type Buttons
  document.querySelectorAll(".type-btn").forEach(btn => {
    if (btn.dataset.type === currentBill.orderType) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderEditorItems();
  updatePreview();
}

// Input Event Listeners
inpOrderNo.addEventListener("input", e => { currentBill.orderNo = e.target.value; updatePreview(); });
inpTable.addEventListener("input", e => { currentBill.table = e.target.value; updatePreview(); });
inpDate.addEventListener("input", e => { currentBill.date = e.target.value; updatePreview(); });
inpTime.addEventListener("input", e => { currentBill.time = e.target.value; updatePreview(); });
inpInstructions.addEventListener("input", e => { currentBill.instructions = e.target.value; updatePreview(); });

// Quick Table Chips
document.querySelectorAll("[data-set-table]").forEach(chip => {
  chip.addEventListener("click", () => {
    currentBill.table = chip.dataset.setTable;
    inpTable.value = currentBill.table;
    updatePreview();
  });
});

// Order Type Buttons
document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentBill.orderType = btn.dataset.type;
    inpType.value = currentBill.orderType;
    updatePreview();
  });
});

// Quick Menu Chips
document.querySelectorAll(".menu-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const itemName = chip.dataset.name;
    const defaultRem = chip.dataset.rem || "-";

    // If item already exists, increment qty
    const existing = currentBill.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.qty = (parseInt(existing.qty) || 1) + 1;
    } else {
      currentBill.items.push({
        id: Date.now(),
        name: itemName,
        qty: 1,
        remarks: defaultRem
      });
    }

    renderEditorItems();
    updatePreview();
  });
});

// Quick Instruction Chips
document.querySelectorAll(".chip-inst").forEach(chip => {
  chip.addEventListener("click", () => {
    currentBill.instructions = chip.dataset.inst;
    inpInstructions.value = currentBill.instructions;
    updatePreview();
  });
});

// Auto Order Number Button
btnAutoOrderNo.addEventListener("click", () => {
  orderCounter++;
  currentBill.orderNo = `#CS${orderCounter}`;
  inpOrderNo.value = currentBill.orderNo;
  updatePreview();
});

// Clock Now Button
btnNowDateTime.addEventListener("click", () => {
  const { dateStr, timeStr } = getFormattedNow();
  currentBill.date = dateStr;
  currentBill.time = timeStr;
  inpDate.value = dateStr;
  inpTime.value = timeStr;
  updatePreview();
});

// Add Custom Item
btnAddItem.addEventListener("click", () => {
  currentBill.items.push({
    id: Date.now(),
    name: "New Item",
    qty: 1,
    remarks: "-"
  });
  renderEditorItems();
  updatePreview();
  
  // Focus new item input
  setTimeout(() => {
    const inputs = itemsEditorContainer.querySelectorAll(".inp-item-name");
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
      inputs[inputs.length - 1].select();
    }
  }, 50);
});

// New Order Button
btnNewOrder.addEventListener("click", () => {
  orderCounter++;
  const { dateStr, timeStr } = getFormattedNow();
  currentBill = {
    orderNo: `#CS${orderCounter}`,
    table: "T-01",
    date: dateStr,
    time: timeStr,
    orderType: "Dine In",
    badgeSub: "PREPARE WITH CARE",
    instructions: "No onion. Serve hot.",
    footerNote: "KINDLY PREPARE AND SERVE FRESH",
    items: []
  };
  syncFormValues();
  showToast("New Order Started", `Order ${currentBill.orderNo} initialized with current time.`);
});

// Reset to Sample Photo
btnResetSample.addEventListener("click", () => {
  currentBill = JSON.parse(JSON.stringify(DEFAULT_BILL_DATA));
  syncFormValues();
  showToast("Sample Data Loaded", "Reset to original Chief Bill photo values.");
});

// Browser Print
btnPrintBrowser.addEventListener("click", () => {
  window.print();
});

// ⚡ Direct Print to POS-80C via Server API & Canvas Rasterization
btnDirectPrint.addEventListener("click", async () => {
  showToast("Printing to POS-80C...", "Rendering raster ticket and transmitting...", false);
  
  try {
    // Generate bitmap on offscreen canvas
    const canvas = document.getElementById("thermal-canvas");
    const dataUrl = await renderReceiptToCanvas(canvas);

    // Send to local Python print server
    const res = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData: dataUrl,
        order: currentBill
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast("Print Successful!", `Order ${currentBill.orderNo} printed on POS-80C.`);
    } else {
      showToast("Print Error", data.error || "Failed to print.", true);
    }
  } catch (err) {
    // If server is not reachable, fallback to browser print
    console.warn("Direct print server unreachable, falling back to window.print():", err);
    showToast("Opening Browser Print Dialog...", "Sending via print driver.");
    window.print();
  }
});

// Render Receipt to High-Resolution Canvas for 80mm ESC/POS Rasterization
async function renderReceiptToCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const width = 576; // Exact printable width for 80mm
  
  // Calculate dynamic height based on items
  const baseHeight = 720;
  const itemRowHeight = 36;
  const height = baseHeight + (currentBill.items.length * itemRowHeight);
  canvas.width = width;
  canvas.height = height;

  // Background White
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";

  // 1. Header: Logo + Canteen Services + Values
  let logoImg = document.getElementById("receipt-logo");
  if (logoImg && logoImg.complete) {
    ctx.drawImage(logoImg, 20, 20, 100, 95);
  }

  // Canteen Services Brand
  ctx.font = "900 28px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CANTEEN", 135, 52);
  ctx.fillText("SERVICES", 135, 80);

  ctx.font = "700 13px Inter, Arial, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("GOOD FOOD", 135, 100);
  ctx.fillText("GREATER SERVICE", 135, 116);
  ctx.letterSpacing = "0px";

  // Vertical Divider
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(345, 25);
  ctx.lineTo(345, 120);
  ctx.stroke();

  // Values Column
  ctx.font = "800 13px Inter, Arial, sans-serif";
  ctx.fillText("FRESH", 365, 45);
  ctx.fillText("HYGIENIC", 365, 68);
  ctx.fillText("NUTRITIOUS", 365, 91);
  ctx.fillText("FOR A BETTER YOU", 365, 114);

  // 2. Kitchen Order Badge
  ctx.fillStyle = "#000000";
  roundRect(ctx, 80, 145, 416, 48, 6, true, false);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KITCHEN ORDER", 288, 180);

  ctx.fillStyle = "#000000";
  ctx.font = "800 14px Inter, Arial, sans-serif";
  ctx.fillText(currentBill.badgeSub || "PREPARE WITH CARE", 288, 214);

  // Dashed Line 1
  drawDashedLine(ctx, 20, 230, 556, 230);

  // 3. Order Details & Table Box
  ctx.textAlign = "left";
  ctx.font = "500 20px Inter, Arial, sans-serif";
  
  const drawMetaRow = (label, val, y, isBold = false) => {
    ctx.font = "500 20px Inter, Arial, sans-serif";
    ctx.fillText(label, 25, y);
    ctx.fillText(":", 155, y);
    ctx.font = isBold ? "900 21px Inter, Arial, sans-serif" : "500 20px Inter, Arial, sans-serif";
    ctx.fillText(val, 180, y);
  };

  drawMetaRow("Order No", currentBill.orderNo, 265, true);
  drawMetaRow("Date", currentBill.date, 295, false);
  drawMetaRow("Time", currentBill.time, 325, false);
  drawMetaRow("Table", currentBill.table, 355, true);
  drawMetaRow("Order Type", currentBill.orderType, 385, true);

  // Right Table Box
  ctx.lineWidth = 2.5;
  roundRect(ctx, 395, 250, 155, 135, 10, false, true);
  ctx.textAlign = "center";
  ctx.font = "900 17px Inter, Arial, sans-serif";
  ctx.fillText("TABLE", 472, 280);
  ctx.font = "900 52px Inter, Arial, sans-serif";
  ctx.fillText(currentBill.table, 472, 350);

  // Dashed Line 2
  drawDashedLine(ctx, 20, 410, 556, 410);

  // 4. Items Table
  ctx.textAlign = "left";
  ctx.font = "900 18px Inter, Arial, sans-serif";
  ctx.fillText("#", 25, 436);
  ctx.fillText("ITEM", 75, 436);
  ctx.textAlign = "center";
  ctx.fillText("QTY", 370, 436);
  ctx.textAlign = "right";
  ctx.fillText("REMARKS", 550, 436);

  // Solid line below header
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 448);
  ctx.lineTo(556, 448);
  ctx.stroke();

  // Draw Items
  let curY = 480;
  ctx.font = "600 20px 'Courier Prime', Consolas, monospace";

  currentBill.items.forEach((item, idx) => {
    ctx.textAlign = "left";
    ctx.fillText(String(idx + 1), 25, curY);
    ctx.fillText(item.name, 75, curY);
    ctx.textAlign = "center";
    ctx.fillText(String(item.qty), 370, curY);
    ctx.textAlign = "right";
    ctx.fillText(item.remarks || "-", 550, curY);
    curY += itemRowHeight;
  });

  // Dashed Line 3
  curY += 10;
  drawDashedLine(ctx, 20, curY, 556, curY);

  // 5. Special Instructions
  curY += 35;
  let noteImg = document.getElementById("receipt-note-icon");
  if (noteImg && noteImg.complete) {
    ctx.drawImage(noteImg, 25, curY - 24, 32, 40);
  }

  ctx.textAlign = "left";
  ctx.font = "900 17px Inter, Arial, sans-serif";
  ctx.fillText("SPECIAL INSTRUCTIONS :", 75, curY);
  ctx.font = "600 19px 'Courier Prime', Consolas, monospace";
  ctx.fillText(currentBill.instructions || "None", 75, curY + 28);

  // Dashed Line 4
  curY += 50;
  drawDashedLine(ctx, 20, curY, 556, curY);

  // 6. Footer Section
  curY += 30;
  ctx.textAlign = "center";
  ctx.font = "900 16px Inter, Arial, sans-serif";
  ctx.fillText(currentBill.footerNote || "KINDLY PREPARE AND SERVE FRESH", 288, curY);

  // Thank You with Lines
  curY += 30;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(80, curY - 8);
  ctx.lineTo(190, curY - 8);
  ctx.stroke();

  ctx.font = "40px 'Great Vibes', cursive";
  ctx.fillText("Thank You", 288, curY);

  ctx.beginPath();
  ctx.moveTo(385, curY - 8);
  ctx.lineTo(495, curY - 8);
  ctx.stroke();

  // Footer Brand
  curY += 32;
  ctx.font = "900 15px Inter, Arial, sans-serif";
  ctx.fillText("CANTEEN SERVICES", 288, curY);
  ctx.font = "700 12px Inter, Arial, sans-serif";
  ctx.fillText("GOOD FOOD. GREATER SERVICE.", 288, curY + 18);

  return canvas.toDataURL("image/png");
}

// Helpers
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawDashedLine(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function showToast(title, msg, isError = false) {
  toastTitle.textContent = title;
  toastMsg.textContent = msg;
  printToast.classList.remove("hidden");
  if (isError) {
    printToast.classList.add("toast-error");
  } else {
    printToast.classList.remove("toast-error");
  }

  setTimeout(() => {
    printToast.classList.add("hidden");
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
  syncFormValues();
});
