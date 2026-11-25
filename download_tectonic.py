import urllib.request
import zipfile
import os

url = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-pc-windows-msvc.zip"
zip_path = "tectonic.zip"

print("Downloading tectonic binary...")
urllib.request.urlretrieve(url, zip_path)
print("Downloaded size:", os.path.getsize(zip_path))

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall("tectonic_bin")
print("Extracted files:", os.listdir("tectonic_bin"))
