import fs from 'fs';
import path from 'path';
import handler from './api/property.js';

async function test() {
    const req = {
        method: 'GET',
        query: { propertyname: 'invalid-property' }
    };
    
    let statusCode = 200;
    let headers = {};
    let body = '';
    
    const res = {
        setHeader: (name, value) => { headers[name] = value; },
        status: (code) => { statusCode = code; return res; },
        send: (data) => { body = data; return res; },
        json: (data) => { body = JSON.stringify(data); return res; }
    };
    
    await handler(req, res);
    
    fs.writeFileSync('scratch_test_output.html', body);
    console.log(`Status: ${statusCode}`);
    console.log(`Headers:`, headers);
}

test();
