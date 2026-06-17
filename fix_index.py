import re

with open(r'C:\Users\USER\.gemini\antigravity-ide\brain\fdaaeacd-7e6b-4f3e-acd9-3f1f0c0f84fe\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    content = f.read()

path_str = 'File Path: `file:///e:/Part-Time/Propera/PROPERA-INDIA%20WEBSITE/index.html`'
start_idx = content.find(path_str)

if start_idx != -1:
    doc_idx = content.find('1: <!DOCTYPE html>', start_idx)
    # The block ends with either 'Showing lines 1 to' or 'The above content shows'
    end1 = content.find('Showing lines 1 to', doc_idx)
    end2 = content.find('The above content shows', doc_idx)
    
    # We want the nearest end marker
    ends = [e for e in [end1, end2] if e != -1]
    if ends:
        end_idx = min(ends)
        html = content[doc_idx:end_idx]
        
        # Clean line numbers
        cleaned = re.sub(r'(?m)^\d+:\s', '', html)
        # Decode JSON escaped chars
        cleaned = cleaned.replace('\\r\\n', '\n').replace('\\n', '\n').replace('\\"', '"')
        # Ensure logo is correct
        cleaned = cleaned.replace('assets/Logo.jpeg', 'assets/ribbonfile.png')
        
        # Add closing tags since it was truncated!
        if '</html>' not in cleaned:
            cleaned += '\n<script src="js/app.js" defer></script>\n</body>\n</html>'
            
        with open('index.html', 'w', encoding='utf-8') as out:
            out.write(cleaned)
        print('Created index.html perfectly, length:', len(cleaned))
