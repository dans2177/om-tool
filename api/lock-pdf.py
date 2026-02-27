"""
Vercel Python Serverless Function – Lock & Compress PDF with pikepdf.

POST /api/lock-pdf
Body JSON: { pdfUrl, slug, ownerPassword, userPassword }
Returns JSON: { lockedPdfUrl, originalSize, lockedSize }

pikepdf (wrapping the C++ QPDF library) preserves all links, bookmarks,
text, and formatting — unlike JS-based PDF manipulation.
"""

import json
import os
import tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler

import pikepdf


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length)
            body = json.loads(raw_body)
        except Exception:
            self._json_response(400, {"error": "Invalid JSON body"})
            return

        pdf_url = body.get("pdfUrl", "")
        slug = body.get("slug", "")
        owner_password = body.get("ownerPassword", "")
        user_password = body.get("userPassword", "")

        if not pdf_url or not slug:
            self._json_response(400, {"error": "Missing pdfUrl or slug"})
            return

        tmp_dir = tempfile.mkdtemp()
        input_path = os.path.join(tmp_dir, "input.pdf")
        compressed_path = os.path.join(tmp_dir, "compressed.pdf")
        output_path = os.path.join(tmp_dir, "output.pdf")

        try:
            # Download PDF
            urllib.request.urlretrieve(pdf_url, input_path)
            original_size = os.path.getsize(input_path)

            # Pass 1: Compress & optimize
            with pikepdf.open(input_path) as pdf:
                pdf.save(
                    compressed_path,
                    compress_streams=True,
                    stream_decode_level=pikepdf.StreamDecodeLevel.generalized,
                    object_stream_mode=pikepdf.ObjectStreamMode.generate,
                    linearize=True,
                )

            # Pass 2: Encrypt
            with pikepdf.open(compressed_path) as pdf:
                perms = pikepdf.Permissions(
                    extract=False,
                    modify_annotation=False,
                    modify_assembly=False,
                    modify_form=False,
                    modify_other=False,
                    print_highres=True,
                    print_lowres=True,
                )
                pdf.save(
                    output_path,
                    encryption=pikepdf.Encryption(
                        owner=owner_password,
                        user=user_password,
                        R=6,  # AES-256 (PDF 2.0)
                        allow=perms,
                    ),
                    linearize=True,
                )

            locked_size = os.path.getsize(output_path)

            # Upload to Vercel Blob via REST API
            blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
            if not blob_token:
                self._json_response(500, {"error": "BLOB_READ_WRITE_TOKEN not set"})
                return

            with open(output_path, "rb") as f:
                pdf_bytes = f.read()

            blob_url = self._upload_to_blob(pdf_bytes, f"{slug}/locked-om.pdf", blob_token)

            self._json_response(200, {
                "lockedPdfUrl": blob_url,
                "originalSize": original_size,
                "lockedSize": locked_size,
            })

        except Exception as e:
            print(f"lock-pdf error: {e}")
            self._json_response(500, {"error": str(e)})

        finally:
            for p in [input_path, compressed_path, output_path]:
                try:
                    os.unlink(p)
                except OSError:
                    pass
            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass

    def _json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _upload_to_blob(self, data, pathname, token):
        """Upload bytes to Vercel Blob store and return the public URL."""
        url = f"https://blob.vercel-storage.com/{pathname}"
        req = urllib.request.Request(
            url,
            data=data,
            method="PUT",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/pdf",
                "x-api-version": "7",
                "x-content-type": "application/pdf",
            },
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
        return result.get("url", "")
