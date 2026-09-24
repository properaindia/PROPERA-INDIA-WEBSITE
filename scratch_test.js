async function run() {
    const scriptUrl = "https://script.google.com/macros/s/AKfycbxkBu-BIS1bzOKV-lDDeZNtXm3B8wfHHUNzgw6LJ-8QoyttAckjs2-mDYyz5zGOMKFDgQ/exec";
    const url = `${scriptUrl}?action=getProperties&t=${Date.now()}`;
    const response = await fetch(url);
    const properties = await response.json();
    const matchedProperty = properties.find(p => p.title && p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') === 'candeur-signature');
    console.log("Images for candeur-signature:", matchedProperty ? matchedProperty.images : "Not found");
}
run();
