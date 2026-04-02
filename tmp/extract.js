const fs = require('fs');
const path = require('path');

try {
    const htmlPath = 'C:\\Users\\marce\\Downloads\\Analysis of Communication and Backend in ProteticFlow - Manus.html';
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Simple regex to remove script and style tags and their contents
    let text = html.replace(/<(script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, '');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Replace HTML entities
    text = text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    
    // Collapse multiple spaces and newlines
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n');
    
    const outPath = path.join(__dirname, 'extracted_manus.txt');
    fs.writeFileSync(outPath, text.trim(), 'utf8');
    
    console.log('Sucesso! Arquivo gerado em:', outPath);
} catch (error) {
    console.error('Erro ao extrair:', error.message);
}
