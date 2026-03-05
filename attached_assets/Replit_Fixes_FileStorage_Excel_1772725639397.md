# Replit Fix 1: File Persistence — Store uploaded files as base64 in the database

## Problem
Uploaded files are currently stored on the filesystem under `uploads/{verticalId}/{timestamp}_{filename}`. In production/autoscale deployments, the filesystem is not persistent — files get lost on restart. We need files to survive restarts.

## Solution
Store the raw file content as base64 in the PostgreSQL database instead of the filesystem.

### Changes needed:

1. **Add a column to the `documents` table:**
   - Add `file_data TEXT` column — stores the base64-encoded file content
   - The existing `file_path` column can be kept for reference but is no longer the primary storage

2. **Modify the upload flow:**
   - When a file is uploaded, convert it to base64: `base64.b64encode(file.read()).decode('utf-8')`
   - Store the base64 string in the `file_data` column
   - Still save to filesystem as a temporary working copy (for processing), but the database is the source of truth

3. **Modify document retrieval:**
   - When the admin wants to view/download an original file, decode from base64: `base64.b64decode(doc.file_data)`
   - Set the correct Content-Type header based on `file_type` when serving the file

4. **Modify AI document processing:**
   - When sending a document to Claude for extraction, read from `file_data` (base64) instead of from the filesystem
   - For PDFs and images, the base64 is already in the right format for Claude's API
   - For text files, decode the base64 to get the text content

### Important notes:
- This will increase database size. For our use case (50-70 documents, mostly under 5MB each), this is fine for PostgreSQL.
- Add a file size validation: reject uploads over 10MB BEFORE converting to base64.
- Make sure the base64 encoding/decoding handles all supported file types: PDF, DOCX, TXT, PNG, JPG, JPEG, CSV, XLSX.

---

# Replit Fix 2: Proper Excel/XLSX file handling for AI extraction

## Problem
When Excel (.xlsx or .xls) files are uploaded and sent to Claude for content extraction, Claude cannot read the binary Excel format directly. We need to convert Excel files to a readable format before sending to Claude.

## Solution
Add a server-side conversion step that converts Excel files to CSV/text before sending to Claude for extraction.

### Changes needed:

1. **Install dependencies:**
   - Add `openpyxl` and `pandas` to requirements.txt (if not already present)

2. **Add an Excel-to-text conversion function in `ai_service.py` (or a utils file):**

```python
import pandas as pd
import io
import base64

def extract_excel_content(file_data_base64):
    """Convert base64-encoded Excel file to readable text for Claude."""
    file_bytes = base64.b64decode(file_data_base64)
    
    # Read all sheets from the Excel file
    excel_file = io.BytesIO(file_bytes)
    all_sheets = pd.read_excel(excel_file, sheet_name=None, engine='openpyxl')
    
    text_output = []
    for sheet_name, df in all_sheets.items():
        text_output.append(f"=== Sheet: {sheet_name} ===")
        text_output.append(f"Rows: {len(df)}, Columns: {len(df.columns)}")
        text_output.append(f"Column headers: {', '.join(str(c) for c in df.columns)}")
        text_output.append("")
        # Convert dataframe to CSV string (readable by Claude)
        csv_text = df.to_csv(index=False)
        text_output.append(csv_text)
        text_output.append("")
    
    return "\n".join(text_output)
```

3. **Modify the document processing flow in `ai_service.py`:**
   - In the function that processes uploaded documents and sends them to Claude:
   - Add a check: if `file_type` is `xlsx`, `xls`, or `csv`:
     - For XLSX/XLS: call `extract_excel_content(file_data_base64)` to get text
     - For CSV: just decode the base64 to get the CSV text directly
     - Send the resulting text to Claude as a text message (not as a document/image content type)
   - For PDF and images: continue sending as base64 document/image content type (current behavior)
   - For DOCX: if not already handled, consider using `python-docx` to extract text similarly
   - For TXT: decode base64 to text and send as text

4. **The routing logic should look like this:**

```python
def process_document_with_claude(document):
    file_type = document.file_type.lower()
    
    if file_type in ['xlsx', 'xls']:
        # Convert Excel to readable text
        content = extract_excel_content(document.file_data)
        # Send as text message to Claude
        messages = [{"role": "user", "content": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]\n\nFile content:\n{content}"}]
        
    elif file_type == 'csv':
        # Decode CSV directly
        content = base64.b64decode(document.file_data).decode('utf-8')
        messages = [{"role": "user", "content": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]\n\nFile content:\n{content}"}]
        
    elif file_type in ['txt']:
        content = base64.b64decode(document.file_data).decode('utf-8')
        messages = [{"role": "user", "content": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]\n\nFile content:\n{content}"}]
    
    elif file_type in ['pdf']:
        # Send as base64 document to Claude
        messages = [{"role": "user", "content": [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": document.file_data}},
            {"type": "text", "text": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]"}
        ]}]
    
    elif file_type in ['png', 'jpg', 'jpeg']:
        media_type = f"image/{'jpeg' if file_type in ['jpg','jpeg'] else file_type}"
        messages = [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": document.file_data}},
            {"type": "text", "text": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]"}
        ]}]
    
    elif file_type == 'docx':
        # Extract text from DOCX using python-docx
        content = extract_docx_content(document.file_data)
        messages = [{"role": "user", "content": f"[Document: {document.filename}]\n[Type: {document.doc_type}]\n[User description: {document.user_description}]\n\nFile content:\n{content}"}]
    
    # Send to Claude with the document extraction system prompt
    # ... (existing Claude API call code)
```

5. **Also add DOCX text extraction while we're at it:**

```python
from docx import Document as DocxDocument

def extract_docx_content(file_data_base64):
    """Convert base64-encoded DOCX file to readable text for Claude."""
    file_bytes = base64.b64decode(file_data_base64)
    doc = DocxDocument(io.BytesIO(file_bytes))
    
    text_parts = []
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)
    
    # Also extract tables
    for table in doc.tables:
        table_text = []
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells]
            table_text.append(" | ".join(row_text))
        text_parts.append("\n".join(table_text))
    
    return "\n\n".join(text_parts)
```

6. **Add `python-docx` to requirements.txt** (if not already present)

### Testing:
- Upload an Excel file with multiple sheets. Verify the extraction captures all sheets with headers and data.
- Upload a DOCX file. Verify text and tables are extracted.
- Upload a CSV file. Verify content is readable.
- Check that PDF and image processing still works as before (no regression).
