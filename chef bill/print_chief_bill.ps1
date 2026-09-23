param(
    [string]$PrinterName = "POS-80C",
    [string]$ImagePath = "d:\Printer test\bill_cropped_mono.png"
)

Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelperChief
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
        di.pDocName = "Chief Bill Kitchen Order";
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

if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelperChief').Type) {
    Add-Type -TypeDefinition $code -Language CSharp
}

function Convert-BitmapToEscPos($bmpPath) {
    $bmp = [System.Drawing.Bitmap]::FromFile($bmpPath)
    $width = $bmp.Width
    $height = $bmp.Height
    $widthBytes = [int](($width + 7) / 8)
    
    $bytes = New-Object System.Collections.Generic.List[byte]
    
    # Reset / initialize
    $bytes.Add(0x1B); $bytes.Add(0x40)
    # Line spacing 0
    $bytes.Add(0x1B); $bytes.Add(0x33); $bytes.Add(0x00)
    # Center alignment
    $bytes.Add(0x1B); $bytes.Add(0x61); $bytes.Add(0x01)
    
    # GS v 0 0 xL xH yL yH
    $bytes.Add(0x1D); $bytes.Add(0x76); $bytes.Add(0x30); $bytes.Add(0x00)
    $bytes.Add([byte]($widthBytes -band 0xFF))
    $bytes.Add([byte](($widthBytes -shr 8) -band 0xFF))
    $bytes.Add([byte]($height -band 0xFF))
    $bytes.Add([byte](($height -shr 8) -band 0xFF))
    
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $bmpData = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $stride = [Math]::Abs($bmpData.Stride)
    $rawBytes = New-Object byte[] ($stride * $height)
    [System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $rawBytes, 0, $rawBytes.Length)
    $bmp.UnlockBits($bmpData)
    $bmp.Dispose()
    
    for ($y = 0; $y -lt $height; $y++) {
        $rowOffset = $y * $stride
        for ($xb = 0; $xb -lt $widthBytes; $xb++) {
            $byteVal = 0
            for ($bit = 0; $bit -lt 8; $bit++) {
                $px = ($xb * 8) + $bit
                if ($px -lt $width) {
                    $pixelOffset = $rowOffset + ($px * 4)
                    $b = $rawBytes[$pixelOffset]
                    $g = $rawBytes[$pixelOffset + 1]
                    $r = $rawBytes[$pixelOffset + 2]
                    $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b
                    if ($lum -lt 180) {
                        $byteVal = $byteVal -bor (0x80 -shr $bit)
                    }
                }
            }
            $bytes.Add([byte]$byteVal)
        }
    }
    
    # Feed 4 lines
    $bytes.Add(0x1B); $bytes.Add(0x64); $bytes.Add(0x04)
    # Cut paper
    $bytes.Add(0x1D); $bytes.Add(0x56); $bytes.Add(0x42); $bytes.Add(0x00)
    
    return $bytes.ToArray()
}

Write-Host "Rendering Chief Bill template to ESC/POS raster..."
$escpos = Convert-BitmapToEscPos $ImagePath
Write-Host "Sending $($escpos.Length) bytes to '$PrinterName'..."
$success = [RawPrinterHelperChief]::SendBytesToPrinter($PrinterName, $escpos)

if ($success) {
    Write-Host "Chief Bill sent to $PrinterName successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to send Chief Bill to $PrinterName." -ForegroundColor Red
}
