param(
    [string]$PrinterName = "POS-80C"
)

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Thermal Test Page";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
            return false;

        if (!StartDocPrinter(hPrinter, 1, di))
        {
            ClosePrinter(hPrinter);
            return false;
        }

        if (!StartPagePrinter(hPrinter))
        {
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return false;
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        int dwWritten = 0;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        return success && (dwWritten == bytes.Length);
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp

$bytes = New-Object System.Collections.Generic.List[byte]

function Add-Bytes([byte[]]$b) {
    foreach ($item in $b) {
        $bytes.Add($item)
    }
}

function Add-Ascii([string]$str) {
    $encoded = [System.Text.Encoding]::ASCII.GetBytes($str)
    Add-Bytes $encoded
}

# 1. Initialize printer (ESC @)
Add-Bytes @(0x1B, 0x40)

# 2. Center alignment (ESC a 1)
Add-Bytes @(0x1B, 0x61, 0x01)

# 3. Double height & width (GS ! 0x11), Bold ON (ESC E 1)
Add-Bytes @(0x1D, 0x21, 0x11)
Add-Bytes @(0x1B, 0x45, 0x01)
Add-Ascii "*** TEST PRINT ***`n"

# 4. Normal font (GS ! 0x00), Bold OFF (ESC E 0)
Add-Bytes @(0x1D, 0x21, 0x00)
Add-Bytes @(0x1B, 0x45, 0x00)
Add-Ascii "POS-80C Thermal Printer`n"
Add-Ascii "Port: USB001 | Status: Online`n"
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Add-Ascii "Date: $timestamp`n"
Add-Ascii "------------------------------------------------`n"

# 5. Alignment check
# Left Align (ESC a 0)
Add-Bytes @(0x1B, 0x61, 0x00)
Add-Ascii "[LEFT ALIGNED TEXT]`n"

# Center Align (ESC a 1)
Add-Bytes @(0x1B, 0x61, 0x01)
Add-Ascii "[CENTER ALIGNED TEXT]`n"

# Right Align (ESC a 2)
Add-Bytes @(0x1B, 0x61, 0x02)
Add-Ascii "[RIGHT ALIGNED TEXT]`n"

# 6. Text style checks
Add-Bytes @(0x1B, 0x61, 0x00)
Add-Ascii "------------------------------------------------`n"
# Bold
Add-Bytes @(0x1B, 0x45, 0x01)
Add-Ascii "BOLD TEXT: Checked`n"
Add-Bytes @(0x1B, 0x45, 0x00)

# Underline (ESC - 1)
Add-Bytes @(0x1B, 0x2D, 0x01)
Add-Ascii "UNDERLINED TEXT: Checked`n"
Add-Bytes @(0x1B, 0x2D, 0x00)

# Center and final note
Add-Bytes @(0x1B, 0x61, 0x01)
Add-Ascii "------------------------------------------------`n"
Add-Bytes @(0x1B, 0x45, 0x01)
Add-Ascii "COMMUNICATION STATUS: SUCCESS`n"
Add-Bytes @(0x1B, 0x45, 0x00)
Add-Ascii "ESC/POS Connection Verified`n"
Add-Ascii "------------------------------------------------`n"

# 7. Feed 4 lines (ESC d 4)
Add-Bytes @(0x1B, 0x64, 0x04)

# 8. Paper cut (GS V 66 0 -> feed and cut)
Add-Bytes @(0x1D, 0x56, 0x42, 0x00)

Write-Host "Sending formatted ESC/POS test slip to '$PrinterName'..."
$result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes.ToArray())

if ($result) {
    Write-Host "Test print sent successfully to $PrinterName!" -ForegroundColor Green
} else {
    Write-Host "Failed to send data to $PrinterName. Check printer connection and spooler." -ForegroundColor Red
}
