import * as dotenv from 'dotenv';
import * as https from 'https';
import * as fs from 'fs';

dotenv.config();
const key = process.env.GEMINI_API_KEY.trim();
https.get('https://generativelanguage.googleapis.com/v1beta/models?key=' + key, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => fs.writeFileSync('models.json', d));
});
