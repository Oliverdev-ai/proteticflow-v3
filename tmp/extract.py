import sys
import re
from bs4 import BeautifulSoup

try:
    with open(r'C:\Users\marce\Downloads\Analysis of Communication and Backend in ProteticFlow - Manus.html', 'r', encoding='utf-8') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')

    # Remove script and style elements
    for script_or_style in soup(['script', 'style', 'svg']):
        script_or_style.extract()

    text = soup.get_text(separator='\n', strip=True)
    text = re.sub(r'\n+', '\n', text)

    with open(r'tmp\extracted_manus.txt', 'w', encoding='utf-8') as out:
        out.write(text)

    print("Success: tmp\\extracted_manus.txt created.")
except Exception as e:
    print(f"Error: {e}")
