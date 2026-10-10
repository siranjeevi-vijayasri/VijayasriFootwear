const ALLOWED = new Set(['walkaroo.in','www.walkaroo.in','flite.in','www.flite.in','paragonfootwear.com','www.paragonfootwear.com','bata.in','www.bata.in','myntra.com','www.myntra.com','ajio.com','www.ajio.com']);
const json = (statusCode, body) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
function decode(s=''){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
function meta(html,key,attr='property'){const safe=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const r=new RegExp(`<meta\\b(?=[^>]*\\b${attr}\\s*=\\s*["']${safe}["'])[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'][^>]*>`,'i');let m=html.match(r);if(!m){const r2=new RegExp(`<meta\\b(?=[^>]*\\b${attr}\\s*=\\s*["']${safe}["'])[^>]*\\bcontent\\s*=\\s*([^\\s>]+)[^>]*>`,'i');m=html.match(r2);}return m?decode(m[1]):'';}
function findPrice(html){const patterns=[/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i,/"lowPrice"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/i,/itemprop=["']price["'][^>]*content=["']([0-9.]+)["']/i];for(const p of patterns){const m=html.match(p);if(m)return Number(m[1]);}return null;}
export default async (req) => {
 if(req.method!=='POST') return json(405,{error:'Use POST.'});
 let input;try{input=JSON.parse(req.body||'{}')}catch{return json(400,{error:'Invalid JSON.'})}
 let u;try{u=new URL(input.url)}catch{return json(400,{error:'Enter a valid product page URL.'})}
 if(u.protocol!=='https:'||!ALLOWED.has(u.hostname.toLowerCase())||u.username||u.password) return json(400,{error:'For safety, only HTTPS product URLs from supported domains (Walkaroo, Flite, Paragon, Bata, Myntra or AJIO) are accepted.'});
 try {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
  const response=await fetch(u.href,{signal:controller.signal,headers:{'User-Agent':'VijayasriFootwearProductImporter/1.0 (owner-initiated public product metadata import)','Accept':'text/html,application/xhtml+xml'}});clearTimeout(timeout);
  if(!response.ok)return json(502,{error:`Source site returned HTTP ${response.status}. It may block automated access.`});
  const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return json(400,{error:'The supplied URL did not return an HTML product page.'});
  const html=(await response.text()).slice(0,2_000_000);
  const name=meta(html,'og:title')||meta(html,'twitter:title','name')||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/<[^>]+>/g,'').trim()||'';
  const image=meta(html,'og:image')||meta(html,'twitter:image','name')||'';
  const description=meta(html,'og:description')||meta(html,'description','name')||'';
  const brand=meta(html,'product:brand')||'';
  let imageUrl='';try{if(image){const iu=new URL(image,u);if(iu.protocol==='https:')imageUrl=iu.href;}}catch{}
  if(!name&&!imageUrl)return json(422,{error:'No product title or image metadata found. This site may require JavaScript or block importing.'});
  return json(200,{product:{name,brand,price:findPrice(html),mrp:null,image_url:imageUrl,description,source_url:u.href},note:'Metadata is unverified. Confirm product identity, price, image rights and your shop price before publishing.'});
 } catch(e){return json(502,{error:e.name==='AbortError'?'Source page timed out.':'Could not fetch this page; the site may block automated requests.'});}
};
