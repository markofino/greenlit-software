import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';
const message = { name: 'Visitor', email: 'visitor@example.com', service: 'Website', message: 'Please help with a business website.', website: '' };
async function fixture(t, options = {}) {
 const app = createApp(options); await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
 t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
 const base = `http://127.0.0.1:${app.address().port}`;
 return { base, post: (body = message, headers = {}) => fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }) };
}
test('sends to business inbox with visitor reply address and rejects client recipient override', async t => {
 let payload; const {post} = await fixture(t, {apiKey:'test-key',from:'Greenlit <contact@greenlitsoftware.com>',sendFetch:async (url, options) => { assert.equal(url,'https://api.resend.com/emails'); payload=JSON.parse(options.body); return new Response(JSON.stringify({id:'mock-email'}),{status:200}); }});
 const r=await post({...message,company:'Sample Co',to:['attacker@example.com']}); assert.equal(r.status,200);
 assert.deepEqual(payload.to,['greenlitsoftwarebusiness@gmail.com']); assert.equal(payload.reply_to,message.email); assert.match(payload.text,/business website/); assert.match(payload.text,/Company: Sample Co/);
});
test('rejects malformed data, oversized content, and foreign origins', async t => {
 const {post}=await fixture(t,{siteUrl:'https://greenlitsoftware.com'});
 assert.equal((await post({...message,email:'invalid'})).status,400);
 assert.equal((await post({...message,message:'x'.repeat(17000)})).status,413);
 assert.equal((await post(message,{Origin:'https://other.example'})).status,403);
});
test('unconfigured email and provider failures never report success',async t=>{
 const {post}=await fixture(t,{apiKey:'',from:''});assert.equal((await post()).status,503);
 const failed=await fixture(t,{apiKey:'test',from:'contact@example.com',sendFetch:async()=>new Response(JSON.stringify({error:'rejected'}),{status:403})});
 const r=await failed.post();assert.equal(r.status,502);assert.ok((await r.json()).error);
});
test('spam trap skips email and client rate limit is enforced',async t=>{
 let sent=0;const {post}=await fixture(t,{apiKey:'test',from:'contact@example.com',sendFetch:async()=>{sent++;return new Response(JSON.stringify({id:'mock'}));}});
 assert.equal((await post({...message,website:'bot'})).status,200);assert.equal(sent,0);
 for(let i=0;i<4;i++)assert.equal((await post()).status,200);
 assert.equal((await post()).status,429);assert.equal(sent,4);
});
test('serves all pages and keeps backend secrets inaccessible',async t=>{
 const {base}=await fixture(t);
 for(const path of ['/','/about.html','/services.html','/contact.html','/privacy.html','/terms.html']){const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/Greenlit/);}
 assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server.mjs')).status,404);
 const r=await fetch(base+'/api/contact');assert.equal(r.status,405);
});

test('contact form uses backend and page scripts and fonts are allowed by CSP',async t=>{
 const {base}=await fixture(t); const r=await fetch(base+'/contact.html');const html=await r.text();const csp=r.headers.get('content-security-policy');
 assert.match(html,/fetch\('\/api\/contact'/);assert.doesNotMatch(html,/formsubmit\.co/);assert.match(csp,/sha256-/);assert.match(csp,/fonts\.googleapis\.com/);assert.match(csp,/fonts\.gstatic\.com/);assert.match(html,/maxlength="5000"/);
});
