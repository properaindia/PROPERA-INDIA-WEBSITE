import glob

files = glob.glob('search*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change the main container class to use the correct search-page-container
    content = content.replace(
        '<main class="container search-container" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">',
        '<main class="search-page-container">'
    )
    
    # Also clean up the body tag to let CSS handle it
    content = content.replace(
        '<body class="theme-root" style="display:flex; flex-direction:column; height:100vh; overflow:hidden; background: var(--color-5);">',
        '<body class="theme-root" style="background: var(--color-5);">'
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated search pages to use search-page-container")
