"""
Runs EasyOCR against a single image file and prints the extracted text as
JSON on stdout: {"text": "..."} on success, {"error": "..."} on failure.

Invoked per-request from src/lib/extract-document.ts via child_process —
this reloads the EasyOCR model on every call (slow, ~5-15s), which is
acceptable for the manual "Fetch Address" button this backs but would not
scale to a high-volume/automatic extraction path.
"""
import sys
import json


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no file path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]

    try:
        import easyocr
    except ImportError as e:
        print(json.dumps({"error": f"easyocr not installed: {e}"}))
        sys.exit(1)

    try:
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        lines = reader.readtext(image_path, detail=0, paragraph=True)
        text = "\n".join(lines)
        print(json.dumps({"text": text}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
