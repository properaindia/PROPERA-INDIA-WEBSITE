import os
import re

html_files = [f for f in os.listdir() if f.endswith('.html')]

premium_regex = re.compile(
    r'(\s*<div class="nav-dropdown">\s*<a href="premium-services\.html"[^>]*>Premium Services.*?</div>\s*</div>)',
    re.DOTALL
)

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = premium_regex.search(content)
    if match:
        premium_html = match.group(1)
        # Remove from current location
        content = content.replace(premium_html, '')
        
        # Insert into nav-actions
        actions_regex = re.compile(r'(<div class="nav-actions">)')
        content = actions_regex.sub(r'\1' + premium_html, content)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
