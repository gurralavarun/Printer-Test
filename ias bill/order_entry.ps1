# Interactive CLI for IAS Food Invoice
param(
    [string]$PrinterName = "POS-80C"
)

Clear-Host
Write-Host "==========================================================" -ForegroundColor DarkGreen
Write-Host "         FOOD INVOICE (IAS BILL) - POS-80C STUDIO         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor DarkGreen

# 1. Invoice Metadata
$defaultInv = "CS" + (Get-Date -Format "yyMMdd") + "-0157"
$invoiceNo = Read-Host "Invoice Number [$defaultInv]"
if ([string]::IsNullOrWhiteSpace($invoiceNo)) { $invoiceNo = $defaultInv }

$defaultDt = (Get-Date -Format "dd MMM yyyy, hh:mm tt")
$dateTime = Read-Host "Date & Time [$defaultDt]"
if ([string]::IsNullOrWhiteSpace($dateTime)) { $dateTime = $defaultDt }

$custName = Read-Host "Customer Name [Shri Konapala Saikiran, IAS]"
if ([string]::IsNullOrWhiteSpace($custName)) { $custName = "Shri Konapala Saikiran, IAS" }

$custDesig = Read-Host "Designation [District Collector & District Magistrate]"
if ([string]::IsNullOrWhiteSpace($custDesig)) { $custDesig = "District Collector & District Magistrate" }

$custLoc = Read-Host "Location [Vijayawada, Andhra Pradesh]"
if ([string]::IsNullOrWhiteSpace($custLoc)) { $custLoc = "Vijayawada, Andhra Pradesh" }

# 2. Items
$items = @()
Write-Host "`n--- Add Menu Items (Press Enter on blank name to finish) ---" -ForegroundColor Yellow

$i = 1
while ($true) {
    Write-Host "`nItem #$i:" -ForegroundColor Cyan
    $name = Read-Host "  Item Name"
    if ([string]::IsNullOrWhiteSpace($name)) {
        if ($items.Count -eq 0) {
            Write-Host "  (Loading photo sample items by default...)" -ForegroundColor Gray
            $items += @{ Id = 1; Name = "Veg Biryani"; Qty = 1; Price = 120.00 }
            $items += @{ Id = 2; Name = "Paneer Butter Masala"; Qty = 1; Price = 140.00 }
            $items += @{ Id = 3; Name = "Chapati"; Qty = 2; Price = 15.00 }
            $items += @{ Id = 4; Name = "Buttermilk"; Qty = 1; Price = 20.00 }
            $items += @{ Id = 5; Name = "Gulab Jamun"; Qty = 1; Price = 40.00 }
        }
        break
    }

    $qtyInput = Read-Host "  Quantity [1]"
    $qty = 1
    if (-not [int]::TryParse($qtyInput, [ref]$qty) -or $qty -lt 1) { $qty = 1 }

    $priceInput = Read-Host "  Unit Price (INR) [50.00]"
    $price = 50.00
    if (-not [double]::TryParse($priceInput, [ref]$price)) { $price = 50.00 }

    $items += @{ Id = $i; Name = $name; Qty = $qty; Price = $price }
    $i++
}

# 3. UPI QR
$upiId = Read-Host "`nEnter UPI ID [canteen@upi]"
if ([string]::IsNullOrWhiteSpace($upiId)) { $upiId = "canteen@upi" }

# Calculations
$subtotal = 0
foreach ($item in $items) {
    $subtotal += ($item.Qty * $item.Price)
}
$cgst = [Math]::Round($subtotal * 0.025, 2)
$sgst = [Math]::Round($subtotal * 0.025, 2)
$total = $subtotal + $cgst + $sgst

Write-Host "`n==========================================================" -ForegroundColor DarkGreen
Write-Host "INVOICE SUMMARY:" -ForegroundColor Green
Write-Host "Invoice: $invoiceNo | Date: $dateTime"
Write-Host "Billed To: $custName ($custDesig)"
Write-Host "Items:"
foreach ($item in $items) {
    $lineAmt = ($item.Qty * $item.Price).ToString("F2")
    Write-Host "  $($item.Qty)x $($item.Name) @ INR $($item.Price) = INR $lineAmt"
}
Write-Host "Subtotal : INR $($subtotal.ToString('F2'))"
Write-Host "CGST 2.5%: INR $($cgst.ToString('F2'))"
Write-Host "SGST 2.5%: INR $($sgst.ToString('F2'))"
Write-Host "Total    : INR $($total.ToString('F2'))" -ForegroundColor Yellow
Write-Host "UPI ID   : $upiId"
Write-Host "==========================================================" -ForegroundColor DarkGreen

$confirm = Read-Host "Print this Food Invoice to POS-80C? (Y/n)"
if ($confirm -eq "" -or $confirm -match "^[yY]") {
    Write-Host "Printing to $PrinterName..." -ForegroundColor Green
    powershell.exe -ExecutionPolicy Bypass -File "D:\Printer test\ias bill\print_ias_bill.ps1" -PrinterName $PrinterName
} else {
    Write-Host "Print cancelled." -ForegroundColor Yellow
}
