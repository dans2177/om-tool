"""
CLI script – Lock & Compress PDF with pikepdf.

Usage:
    python3 lock-pdf.py <input.pdf> <output.pdf> <owner_password> [user_password]

pikepdf (wrapping the C++ QPDF library) preserves all links, bookmarks,
text, and formatting — unlike JS-based PDF manipulation which can corrupt
complex PDFs.
"""

import sys
import pikepdf


def lock_and_compress(input_path, output_path, owner_password, user_password=""):
    # Pass 1: Compress & optimize (can't combine stream_decode_level with encryption)
    compressed_path = output_path + ".compressed.pdf"
    with pikepdf.open(input_path) as pdf:
        pdf.save(
            compressed_path,
            compress_streams=True,
            stream_decode_level=pikepdf.StreamDecodeLevel.generalized,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            linearize=True,  # web-optimised
        )

    # Pass 2: Encrypt the already-compressed PDF
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

    # Clean up intermediate file
    import os
    try:
        os.unlink(compressed_path)
    except OSError:
        pass


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 lock-pdf.py <input> <output> <owner_password> [user_password]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    owner_password = sys.argv[3]
    user_password = sys.argv[4] if len(sys.argv) > 4 else ""

    lock_and_compress(input_path, output_path, owner_password, user_password)
