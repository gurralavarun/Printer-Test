// Initial IAS Bill Data matching "Ias whats app bill.jpeg"
const DEFAULT_BILL_DATA = {
  invoiceNo: "CS260922-0157",
  dateTime: "22 Sep 2026, 01:48 PM",
  paymentMode: "UPI / Card",
  customer: {
    name: "Shri Konapala Saikiran, IAS",
    designation: "District Collector & District Magistrate",
    location: "Vijayawada, Andhra Pradesh"
  },
  items: [
    { id: 1, name: "Veg Biryani", qty: 1, price: 120.00 },
    { id: 2, name: "Paneer Butter Masala", qty: 1, price: 140.00 },
    { id: 3, name: "Chapati", qty: 2, price: 15.00 },
    { id: 4, name: "Buttermilk", qty: 1, price: 20.00 },
    { id: 5, name: "Gulab Jamun", qty: 1, price: 40.00 }
  ],
  upiId: "canteen@upi",
  payeeName: "Canteen Services",
  customQrText: ""
};

let currentBill = JSON.parse(JSON.stringify(DEFAULT_BILL_DATA));
let invoiceCounter = 157;

// DOM Elements - Inputs
const inpInvoiceNo = document.getElementById("inp-invoiceno");
const inpDateTime = document.getElementById("inp-datetime");
const inpPayMode = document.getElementById("inp-paymode");
const inpCustName = document.getElementById("inp-cust-name");
const inpCustDesig = document.getElementById("inp-cust-desig");
const inpCustLoc = document.getElementById("inp-cust-loc");
const inpUpiId = document.getElementById("inp-upi-id");
const inpPayeeName = document.getElementById("inp-payee-name");
const inpQrCustom = document.getElementById("inp-qr-custom");
const itemsEditorContainer = document.getElementById("items-editor-container");

// DOM Elements - Preview Targets
const prevInvoiceNo = document.getElementById("prev-invoiceno");
const prevDateTime = document.getElementById("prev-datetime");
const prevPayMode = document.getElementById("prev-paymode");
const prevCustName = document.getElementById("prev-cust-name");
const prevCustDesig = document.getElementById("prev-cust-desig");
const prevCustLoc = document.getElementById("prev-cust-loc");
const prevItemsList = document.getElementById("prev-items-list");
const prevSubtotal = document.getElementById("prev-subtotal");
const prevCgst = document.getElementById("prev-cgst");
const prevSgst = document.getElementById("prev-sgst");
const prevTotalAmount = document.getElementById("prev-total-amount");
const prevQrImage = document.getElementById("prev-qr-image");

// Buttons
const btnNewOrder = document.getElementById("btn-new-order");
const btnResetSample = document.getElementById("btn-reset-sample");
const btnDownloadImage = document.getElementById("btn-download-image");
const btnPrintBrowser = document.getElementById("btn-print-browser");
const btnDirectPrint = document.getElementById("btn-direct-print");
const btnAddItem = document.getElementById("btn-add-item");
const btnAutoInvoiceNo = document.getElementById("btn-auto-invoiceno");
const btnNowDateTime = document.getElementById("btn-now-datetime");

// Toast
const printToast = document.getElementById("print-toast");
const toastTitle = document.getElementById("toast-title");
const toastMsg = document.getElementById("toast-msg");

// Format Date & Time Now
function getFormattedNow() {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = String(now.getDate()).padStart(2, "0");
  const m = months[now.getMonth()];
  const y = now.getFullYear();

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

  return `${d} ${m} ${y}, ${timeStr}`;
}

// Format Currency
function formatCurrency(val) {
  return "₹" + Number(val).toFixed(2);
}

// Calculate Totals
function calculateTotals() {
  let subtotal = 0;
  currentBill.items.forEach(item => {
    subtotal += (Number(item.qty) || 0) * (Number(item.price) || 0);
  });

  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const total = subtotal + cgst + sgst;

  return { subtotal, cgst, sgst, total };
}

// Generate UPI QR Code URL
function getQrCodeUrl(totalAmount) {
  let qrText = currentBill.customQrText.trim();
  if (!qrText) {
    const upi = currentBill.upiId || "canteen@upi";
    const name = encodeURIComponent(currentBill.payeeName || "Canteen Services");
    const am = totalAmount.toFixed(2);
    qrText = `upi://pay?pa=${upi}&pn=${name}&am=${am}&cu=INR`;
  }
  // Call local python server /api/qr endpoint
  return `/api/qr?text=${encodeURIComponent(qrText)}`;
}

// Render Items in Form Editor
function renderEditorItems() {
  itemsEditorContainer.innerHTML = "";
  currentBill.items.forEach((item, index) => {
    const lineAmount = (Number(item.qty) || 0) * (Number(item.price) || 0);
    const row = document.createElement("div");
    row.className = "item-row-edit";
    row.innerHTML = `
      <span class="row-idx">${index + 1}</span>
      <input type="text" class="inp-item-name" data-idx="${index}" value="${escapeHtml(item.name)}" placeholder="Item Name" list="menu-items-datalist">
      <div class="qty-stepper">
        <button type="button" class="btn-step btn-minus" data-idx="${index}">-</button>
        <input type="text" class="inp-item-qty" data-idx="${index}" value="${escapeHtml(String(item.qty))}">
        <button type="button" class="btn-step btn-plus" data-idx="${index}">+</button>
      </div>
      <input type="text" class="inp-item-price" data-idx="${index}" value="${Number(item.price).toFixed(2)}" placeholder="Price">
      <span class="row-amount" id="row-amt-${index}">${formatCurrency(lineAmount)}</span>
      <button type="button" class="btn-del-row" data-idx="${index}" title="Remove Item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    itemsEditorContainer.appendChild(row);
  });

  // Event Listeners for inputs
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
      updateLineAmount(idx);
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

  itemsEditorContainer.querySelectorAll(".inp-item-price").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.idx);
      const price = parseFloat(e.target.value) || 0;
      currentBill.items[idx].price = price;
      updateLineAmount(idx);
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

function updateLineAmount(idx) {
  const item = currentBill.items[idx];
  const amtEl = document.getElementById(`row-amt-${idx}`);
  if (amtEl && item) {
    const amt = (Number(item.qty) || 0) * (Number(item.price) || 0);
    amtEl.textContent = formatCurrency(amt);
  }
}

// Render Preview Items Table
function renderPreviewItems() {
  prevItemsList.innerHTML = "";
  currentBill.items.forEach((item, index) => {
    const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
    const row = document.createElement("div");
    row.className = "inv-item-row";
    row.innerHTML = `
      <div class="td-num">${index + 1}</div>
      <div class="td-name">${escapeHtml(item.name)}</div>
      <div class="td-qty">${Number(item.qty)}</div>
      <div class="td-price">${Number(item.price).toFixed(2)}</div>
      <div class="td-amount">${Number(amount).toFixed(2)}</div>
    `;
    prevItemsList.appendChild(row);
  });
}

// Update Preview Targets
function updatePreview() {
  prevInvoiceNo.textContent = currentBill.invoiceNo;
  prevDateTime.textContent = currentBill.dateTime;
  prevPayMode.textContent = currentBill.paymentMode;
  prevCustName.textContent = currentBill.customer.name;
  prevCustDesig.textContent = currentBill.customer.designation;
  prevCustLoc.textContent = currentBill.customer.location;

  renderPreviewItems();

  const { subtotal, cgst, sgst, total } = calculateTotals();
  prevSubtotal.textContent = formatCurrency(subtotal);
  prevCgst.textContent = formatCurrency(cgst);
  prevSgst.textContent = formatCurrency(sgst);
  prevTotalAmount.textContent = formatCurrency(total);

  // Update QR Code
  prevQrImage.src = getQrCodeUrl(total);
}

// Sync Editor Inputs
function syncFormValues() {
  inpInvoiceNo.value = currentBill.invoiceNo;
  inpDateTime.value = currentBill.dateTime;
  inpPayMode.value = currentBill.paymentMode;
  inpCustName.value = currentBill.customer.name;
  inpCustDesig.value = currentBill.customer.designation;
  inpCustLoc.value = currentBill.customer.location;
  inpUpiId.value = currentBill.upiId;
  inpPayeeName.value = currentBill.payeeName;
  inpQrCustom.value = currentBill.customQrText;

  renderEditorItems();
  updatePreview();
}

// Input Event Listeners
inpInvoiceNo.addEventListener("input", e => { currentBill.invoiceNo = e.target.value; updatePreview(); });
inpDateTime.addEventListener("input", e => { currentBill.dateTime = e.target.value; updatePreview(); });
inpPayMode.addEventListener("input", e => { currentBill.paymentMode = e.target.value; updatePreview(); });
inpCustName.addEventListener("input", e => { currentBill.customer.name = e.target.value; updatePreview(); });
inpCustDesig.addEventListener("input", e => { currentBill.customer.designation = e.target.value; updatePreview(); });
inpCustLoc.addEventListener("input", e => { currentBill.customer.location = e.target.value; updatePreview(); });
inpUpiId.addEventListener("input", e => { currentBill.upiId = e.target.value; updatePreview(); });
inpPayeeName.addEventListener("input", e => { currentBill.payeeName = e.target.value; updatePreview(); });
inpQrCustom.addEventListener("input", e => { currentBill.customQrText = e.target.value; updatePreview(); });

// Quick Menu Chips Click Handler
document.querySelectorAll(".menu-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const itemName = chip.dataset.name;
    const price = parseFloat(chip.dataset.price) || 0;

    const existing = currentBill.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
      existing.qty = (parseInt(existing.qty) || 1) + 1;
    } else {
      currentBill.items.push({
        id: Date.now(),
        name: itemName,
        qty: 1,
        price: price
      });
    }

    renderEditorItems();
    updatePreview();
  });
});

// Auto Invoice # Button
btnAutoInvoiceNo.addEventListener("click", () => {
  invoiceCounter++;
  const d = new Date();
  const dateCode = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  currentBill.invoiceNo = `CS${dateCode}-${String(invoiceCounter).padStart(4, "0")}`;
  inpInvoiceNo.value = currentBill.invoiceNo;
  updatePreview();
});

// Clock Now Button
btnNowDateTime.addEventListener("click", () => {
  const dtStr = getFormattedNow();
  currentBill.dateTime = dtStr;
  inpDateTime.value = dtStr;
  updatePreview();
});

// Add Custom Item
btnAddItem.addEventListener("click", () => {
  currentBill.items.push({
    id: Date.now(),
    name: "New Item",
    qty: 1,
    price: 50.00
  });
  renderEditorItems();
  updatePreview();

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
  invoiceCounter++;
  const d = new Date();
  const dateCode = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  currentBill = {
    invoiceNo: `CS${dateCode}-${String(invoiceCounter).padStart(4, "0")}`,
    dateTime: getFormattedNow(),
    paymentMode: "UPI / Card",
    customer: {
      name: "Guest VIP / Officer",
      designation: "General Administration",
      location: "Camp Office"
    },
    items: [],
    upiId: "canteen@upi",
    payeeName: "Canteen Services",
    customQrText: ""
  };
  syncFormValues();
  showToast("New Invoice Started", `Invoice ${currentBill.invoiceNo} ready for entry.`);
});

// Reset to Photo Sample
btnResetSample.addEventListener("click", () => {
  currentBill = JSON.parse(JSON.stringify(DEFAULT_BILL_DATA));
  syncFormValues();
  showToast("Photo Sample Loaded", "Reset to original IAS WhatsApp bill values.");
});

// Download WhatsApp Image (1:1 High-Res PNG)
btnDownloadImage.addEventListener("click", async () => {
  showToast("Generating WhatsApp Image...", "Creating high-resolution export.");
  const card = document.getElementById("invoice-card");
  
  try {
    const canvas = await html2canvas(card, {
      scale: 2, // High resolution for mobile WhatsApp viewing
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const filename = `Food_Invoice_${currentBill.invoiceNo.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    link.download = filename;
    link.href = imgData;
    link.click();
    showToast("Downloaded!", `Saved as ${filename} for WhatsApp sharing.`);
  } catch (err) {
    console.error("html2canvas error:", err);
    showToast("Export Error", "Could not export image.", true);
  }
});

// Browser Print (PDF / Color)
btnPrintBrowser.addEventListener("click", () => {
  window.print();
});

// Direct Print to POS-80C Thermal Printer
btnDirectPrint.addEventListener("click", async () => {
  showToast("Printing to POS-80C...", "Rendering thermal ticket and transmitting...", false);

  try {
    const card = document.getElementById("invoice-card");
    const canvas = await html2canvas(card, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    // Resize to 576 dots width for 80mm roll
    const thermalCanvas = document.getElementById("thermal-canvas");
    thermalCanvas.width = 576;
    thermalCanvas.height = Math.round(canvas.height * (576 / canvas.width));
    const tCtx = thermalCanvas.getContext("2d");
    tCtx.fillStyle = "#ffffff";
    tCtx.fillRect(0, 0, thermalCanvas.width, thermalCanvas.height);
    tCtx.drawImage(canvas, 0, 0, thermalCanvas.width, thermalCanvas.height);

    const dataUrl = thermalCanvas.toDataURL("image/png");

    const res = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ias",
        imageData: dataUrl,
        invoice: currentBill
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast("Print Successful!", `Invoice ${currentBill.invoiceNo} printed on POS-80C.`);
    } else {
      showToast("Print Error", data.error || "Failed to print.", true);
    }
  } catch (err) {
    console.warn("Direct print error, falling back to window.print():", err);
    showToast("Opening Browser Print Dialog...", "Sending via print driver.");
    window.print();
  }
});

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
