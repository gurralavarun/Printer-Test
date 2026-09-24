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

PORT = 3001
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class IASBillRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        if parsed.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "template": "IAS Food Invoice",
                "printer": "POS-80C",
                "port": "USB001",
                "qr_engine": "python-qrcode" if QR_AVAILABLE else "static"
            }).encode("utf-8"))
            return

        # Dynamic QR Code Generator Endpoint
        if parsed.path == "/api/qr":
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
                print(f"Error generating QR: {e}")

            # Fallback if QR generation fails: sample QR if available
            sample_path = os.path.join(DIRECTORY, "sample_qr.png")
            if os.path.exists(sample_path):
                with open(sample_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                self.wfile.write(data)
                return

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/print":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)

            try:
                payload = json.loads(post_data.decode("utf-8"))
                image_data = payload.get("imageData")

                if image_data:
                    if "," in image_data:
                        image_data = image_data.split(",", 1)[1]

                    temp_img_path = os.path.join(DIRECTORY, "temp_ias_print.png")
                    with open(temp_img_path, "wb") as f:
                        f.write(base64.b64decode(image_data))

                    ps_script = os.path.join(DIRECTORY, "print_ias_bill.ps1")
                    cmd = [
                        "powershell.exe",
                        "-ExecutionPolicy", "Bypass",
                        "-File", ps_script,
                        "-PrinterName", "POS-80C",
                        "-ImagePath", temp_img_path
                    ]
                    res = subprocess.run(cmd, capture_output=True, text=True, check=True)

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": True,
                        "message": "IAS Food Invoice printed successfully on POS-80C!",
                        "output": res.stdout
                    }).encode("utf-8"))
                    return

                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Missing imageData"}).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, IASBillRequestHandler)
    print(f"IAS Bill Studio Server running on http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
