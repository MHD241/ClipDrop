import express from 'express';
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.json({ limit: '4kb' }));
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS') return res.sendStatus(204);next();});
app.get('/', (_req,res)=>res.json({ok:true,service:'ClipDrop processor',status:'online'}));
app.get('/health', (_req,res)=>res.json({ok:true}));
app.post('/process', (req,res)=>{
 const {url,format}=req.body||{};
 if(typeof url!=='string'||!['mp4','mp3'].includes(format)) return res.status(400).json({error:'Provide a TikTok URL and format mp4 or mp3.'});
 let parsed; try{parsed=new URL(url.trim());}catch{return res.status(400).json({error:'Invalid URL.'});}
 const host=parsed.hostname.toLowerCase();
 if(parsed.protocol!=='https:' || !(host==='tiktok.com'||host.endsWith('.tiktok.com'))) return res.status(400).json({error:'Only HTTPS TikTok links are accepted.'});
 return res.status(501).json({ok:false,status:'retrieval_not_configured',message:'Processor is online. Media retrieval must use an authorized source for content you own or have permission to download.'});
});
app.listen(PORT,'0.0.0.0',()=>console.log(`ClipDrop listening on ${PORT}`));
