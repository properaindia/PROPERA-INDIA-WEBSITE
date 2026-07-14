import glob
import os

link_tag = '    <link rel="stylesheet" href="css/responsive.css">\n'

for f in glob.glob('*.html'):
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        if 'css/responsive.css' not in content:
            content = content.replace('</head>', link_tag + '</head>')
            with open(f, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f"Updated {f}")
        else:
            print(f"Skipped {f}, already has link.")
    except Exception as e:
        print(f"Failed {f}: {e}")
