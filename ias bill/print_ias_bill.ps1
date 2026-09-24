param(
    [string]$PrinterName = "POS-80C",
    [string]$ImagePath = "D:\Printer test\ias bill\temp_ias_print.png"
)

Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelperIas
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
        di.pDocName = "Food Invoice IAS Bill";
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

if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelperIas').Type) {
    Add-Type -TypeDefinition $code -Language CSharp
}

function Convert-BitmapToEscPosRaster($bmpPath) {
    $bmp = [System.Drawing.Bitmap]::FromFile($bmpPath)
    $targetWidth = 576
    $targetHeight = [int]($bmp.Height * ($targetWidth / $bmp.Width))
    
    # Scale to 576 width
    $resized = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($bmp, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    $bmp.Dispose()
    
    $widthBytes = [int]($targetWidth / 8) # 72 bytes
    $bytes = New-Object System.Collections.Generic.List[byte]
    
    # Initialize printer (ESC @)
    $bytes.Add(0x1B); $bytes.Add(0x40)
    # Line spacing 0
    $bytes.Add(0x1B); $bytes.Add(0x33); $bytes.Add(0x00)
    # Center alignment
    $bytes.Add(0x1B); $bytes.Add(0x61); $bytes.Add(0x01)
    
    # GS v 0 0 xL xH yL yH
    $bytes.Add(0x1D); $bytes.Add(0x76); $bytes.Add(0x30); $bytes.Add(0x00)
    $bytes.Add([byte]($widthBytes -band 0xFF))
    $bytes.Add([byte](($widthBytes -shr 8) -band 0xFF))
    $bytes.Add([byte]($targetHeight -band 0xFF))
    $bytes.Add([byte](($targetHeight -shr 8) -band 0xFF))
    
    # Fast lock bits
    $rect = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
    $bmpData = $resized.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $stride = [Math]::Abs($bmpData.Stride)
    $rawBytes = New-Object byte[] ($stride * $targetHeight)
    [System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $rawBytes, 0, $rawBytes.Length)
    $resized.UnlockBits($bmpData)
    $resized.Dispose()
    
    # Adaptive threshold for colored bill to ensure text & QR code are high contrast
    for ($y = 0; $y -lt $targetHeight; $y++) {
        $rowOffset = $y * $stride
        for ($xb = 0; $xb -lt $widthBytes; $xb++) {
            $byteVal = 0
            for ($bit = 0; $bit -lt 8; $bit++) {
                $px = ($xb * 8) + $bit
                if ($px -lt $targetWidth) {
                    $pixelOffset = $rowOffset + ($px * 4)
                    $b = $rawBytes[$pixelOffset]
                    $g = $rawBytes[$pixelOffset + 1]
                    $r = $rawBytes[$pixelOffset + 2]
                    $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b
                    # High contrast threshold: mint/light green (~220-250) becomes white, text and QR become dark black
                    if ($lum -lt 190) {
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

Write-Host "Converting '$ImagePath' to ESC/POS raster for $PrinterName..."
$escpos = Convert-BitmapToEscPosRaster $ImagePath
Write-Host "Sending $($escpos.Length) bytes to '$PrinterName'..."
$success = [RawPrinterHelperIas]::SendBytesToPrinter($PrinterName, $escpos)

if ($success) {
    Write-Host "Food Invoice sent to $PrinterName successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to send invoice to $PrinterName." -ForegroundColor Red
}
