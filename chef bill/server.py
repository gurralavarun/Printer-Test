import os
import sys
import json
import base64
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class POSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "printer": "POS-80C",
                "port": "USB001"
            }).encode("utf-8"))
            return
        
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/print":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode("utf-8"))
                
                # Check if payload contains base64 image data
                image_data = payload.get("imageData")
                if image_data:
                    # Strip data:image/png;base64, prefix if present
                    if "," in image_data:
                        image_data = image_data.split(",", 1)[1]
                    
                    temp_img_path = os.path.join(DIRECTORY, "temp_print.png")
                    with open(temp_img_path, "wb") as f:
                        f.write(base64.b64decode(image_data))
                    
                    # Print using print_chief_bill.ps1
                    ps_script = os.path.join(DIRECTORY, "print_chief_bill.ps1")
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
                        "message": "Bill printed successfully on POS-80C!",
                        "output": res.stdout
                    }).encode("utf-8"))
                    return

                # If raw print request with default bill
                ps_script = os.path.join(DIRECTORY, "print_chief_bill.ps1")
                cmd = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", ps_script]
                res = subprocess.run(cmd, capture_output=True, text=True, check=True)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": "Chief Bill printed successfully!",
                    "output": res.stdout
                }).encode("utf-8"))

            except Exception as e:
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
    httpd = HTTPServer(server_address, POSRequestHandler)
    print(f"POS Server running on http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
