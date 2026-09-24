import os
import sys
import json
import base64
import urllib.parse
import subprocess
from io import BytesIO
from http.server import HTTPServer, SimpleHTTPRequestHandler

try:
    import qrcode
    from PIL import Image
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

PORT = 3000
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

class UnifiedPOSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Status API
        if parsed.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "printer": "POS-80C",
                "port": "USB001",
                "qr_engine": "python-qrcode" if QR_AVAILABLE else "static"
            }).encode("utf-8"))
            return

        # QR Code API (handles /api/qr or /ias bill/api/qr)
        if parsed.path.endswith("/api/qr"):
            query_params = urllib.parse.parse_qs(parsed.query)
            qr_text = query_params.get("text", ["upi://pay?pa=canteen@upi&pn=Canteen%20Services&am=367.50&cu=INR"])[0]

            try:
                if QR_AVAILABLE:
                    qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_M,
                        box_size=6,
                        border=1
                    )
                    qr.add_data(qr_text)
                    qr.make(fit=True)
                    img = qr.make_image(fill_color="black", back_color="white")
                    
                    buf = BytesIO()
                    img.save(buf, format="PNG")
                    img_bytes = buf.getvalue()

                    self.send_response(200)
                    self.send_header("Content-Type", "image/png")
                    self.send_header("Cache-Control", "no-cache")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(img_bytes)
                    return
            except Exception as e:
                print(f"Error generating QR code: {e}")

            # Fallback to static sample if qrcode fails
            sample_qr = os.path.join(ROOT_DIR, "ias bill", "sample_qr.png")
            if os.path.exists(sample_qr):
                with open(sample_qr, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                self.wfile.write(data)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Print API (handles /api/print or /ias bill/api/print or /chef bill/api/print)
        if parsed.path.endswith("/api/print"):
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)

            try:
                payload = json.loads(post_data.decode("utf-8"))
                image_data = payload.get("imageData")

                # Determine whether this is an IAS Bill or a Chef Bill
                referer = self.headers.get("Referer", "").lower()
                is_ias = ("invoice" in payload) or ("ias" in referer) or (payload.get("type") == "ias")

                if is_ias:
                    ps_script = os.path.join(ROOT_DIR, "ias bill", "print_ias_bill.ps1")
                    temp_img_path = os.path.join(ROOT_DIR, "ias bill", "temp_ias_print.png")
                    doc_title = "Food Invoice (IAS Bill)"
                else:
                    ps_script = os.path.join(ROOT_DIR, "chef bill", "print_chief_bill.ps1")
                    temp_img_path = os.path.join(ROOT_DIR, "chef bill", "temp_print.png")
                    doc_title = "Kitchen Order (Chief Bill)"

                if image_data:
                    if "," in image_data:
                        image_data = image_data.split(",", 1)[1]

                    with open(temp_img_path, "wb") as f:
                        f.write(base64.b64decode(image_data))

                    cmd = [
                        "powershell.exe",
                        "-ExecutionPolicy", "Bypass",
                        "-File", ps_script,
                        "-PrinterName", "POS-80C",
                        "-ImagePath", temp_img_path
                    ]
                else:
                    cmd = [
                        "powershell.exe",
                        "-ExecutionPolicy", "Bypass",
                        "-File", ps_script,
                        "-PrinterName", "POS-80C"
                    ]

                print(f"Executing: {' '.join(cmd)}")
                res = subprocess.run(cmd, capture_output=True, text=True, check=True)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": f"{doc_title} printed successfully on POS-80C!",
                    "output": res.stdout
                }).encode("utf-8"))
                return

            except subprocess.CalledProcessError as e:
                err_msg = e.stderr or e.stdout or str(e)
                print(f"Print process error: {err_msg}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": f"Printer Error: {err_msg}"
                }).encode("utf-8"))
                return

            except Exception as e:
                print(f"Server exception: {e}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "error": str(e)
                }).encode("utf-8"))
                return

        self.send_response(404)
        self.end_headers()

def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, UnifiedPOSRequestHandler)
    print(f"Unified POS Server running on http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
