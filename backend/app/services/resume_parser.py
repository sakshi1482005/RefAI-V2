from io import BytesIO

from pypdf import PdfReader
from docx import Document


def extract_text(filename: str, file_bytes: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if filename.lower().endswith(".docx"):
        doc = Document(BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    # fall back to plain text
    return file_bytes.decode("utf-8", errors="ignore")


def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    words = text.split()
    return [
        " ".join(words[i : i + chunk_size])
        for i in range(0, len(words), chunk_size)
    ]
