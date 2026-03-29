const req1 = new Request('https://example.com');
const req2 = new Request('https://example.com/?token=123', req1);
console.log(req2.url);
