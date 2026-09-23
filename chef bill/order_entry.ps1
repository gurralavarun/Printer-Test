# Interactive POS Order Entry in Terminal for POS-80C
param(
    [string]$PrinterName = "POS-80C"
)

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "       CHIEF BILL - KITCHEN ORDER TICKET ENTRY      " -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Order Details
$defaultOrderNo = "#CS" + (Get-Date -Format "yyMMdd") + (Get-Random -Minimum 10 -Maximum 99)
$orderNo = Read-Host "Enter Order Number [$defaultOrderNo]"
if ([string]::IsNullOrWhiteSpace($orderNo)) { $orderNo = $defaultOrderNo }

$defaultDate = (Get-Date -Format "dd MMM yyyy")
$date = Read-Host "Enter Date [$defaultDate]"
if ([string]::IsNullOrWhiteSpace($date)) { $date = $defaultDate }

$defaultTime = (Get-Date -Format "hh:mm tt")
$time = Read-Host "Enter Time [$defaultTime]"
if ([string]::IsNullOrWhiteSpace($time)) { $time = $defaultTime }

$table = Read-Host "Enter Table Number [T-08]"
if ([string]::IsNullOrWhiteSpace($table)) { $table = "T-08" }

$orderType = Read-Host "Enter Order Type [Dine In]"
if ([string]::IsNullOrWhiteSpace($orderType)) { $orderType = "Dine In" }

# 2. Items Entry
$items = @()
Write-Host "`n--- Add Menu Items (Press Enter on blank item name to finish) ---" -ForegroundColor Green

$idx = 1
while ($true) {
    Write-Host "`nItem #$idx:" -ForegroundColor Yellow
    $name = Read-Host "  Menu Item Name"
    if ([string]::IsNullOrWhiteSpace($name)) {
        if ($items.Count -eq 0) {
            Write-Host "  (Adding sample items by default...)" -ForegroundColor Gray
            $items += @{ Id = 1; Name = "Veg Biryani"; Qty = 1; Remarks = "-" }
            $items += @{ Id = 2; Name = "Paneer Butter Masala"; Qty = 1; Remarks = "Less Spicy" }
            $items += @{ Id = 3; Name = "Chapati"; Qty = 2; Remarks = "-" }
            $items += @{ Id = 4; Name = "Buttermilk"; Qty = 1; Remarks = "Chilled" }
            $items += @{ Id = 5; Name = "Gulab Jamun"; Qty = 1; Remarks = "-" }
        }
        break
    }

    $qtyInput = Read-Host "  Quantity [1]"
    $qty = 1
    if (-not [int]::TryParse($qtyInput, [ref]$qty) -or $qty -lt 1) { $qty = 1 }

    $remarks = Read-Host "  Remarks [-]"
    if ([string]::IsNullOrWhiteSpace($remarks)) { $remarks = "-" }

    $items += @{ Id = $idx; Name = $name; Qty = $qty; Remarks = $remarks }
    $idx++
}

# 3. Special Instructions
$instructions = Read-Host "`nEnter Special Instructions [No onion. Serve hot.]"
if ([string]::IsNullOrWhiteSpace($instructions)) { $instructions = "No onion. Serve hot." }

# Print confirmation
Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "ORDER SUMMARY:" -ForegroundColor Yellow
Write-Host "Order: $orderNo | Table: $table | Type: $orderType"
Write-Host "Date : $date | Time: $time"
Write-Host "Items:"
foreach ($item in $items) {
    Write-Host "  $($item.Qty)x $($item.Name) (Remarks: $($item.Remarks))"
}
Write-Host "Instructions: $instructions"
Write-Host "====================================================" -ForegroundColor Cyan

$confirm = Read-Host "Print this ticket to POS-80C? (Y/n)"
if ($confirm -eq "" -or $confirm -match "^[yY]") {
    Write-Host "Sending to $PrinterName..." -ForegroundColor Green
    
    # Send to POS Server API or direct PowerShell script
    $body = @{
        order = @{
            orderNo = $orderNo
            table = $table
            date = $date
            time = $time
            orderType = $orderType
            instructions = $instructions
            items = $items
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/print" -Method Post -Body $body -ContentType "application/json"
        Write-Host "Ticket successfully printed on $PrinterName!" -ForegroundColor Green
    } catch {
        # Fallback to direct script
        powershell.exe -ExecutionPolicy Bypass -File "d:\Printer test\print_chief_bill.ps1" -PrinterName $PrinterName
    }
} else {
    Write-Host "Print cancelled." -ForegroundColor Yellow
}
