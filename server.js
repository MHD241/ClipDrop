import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const app=express();
const PORT=process.env.PORT||10000;
app.use(express.json({limit:"8kb"}));
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});

function platform(raw){
  try{
    const u=new URL(raw), h=u.hostname.toLowerCase();
    if(u.protocol!=="https:") return null;
    if(h==="tiktok.com"||h.endsWith(".tiktok.com")) return "tiktok";
    if(h==="instagram.com"||h.endsWith(".instagram.com")) return "instagram";
  }catch{}
  return null;
}
function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:["ignore","ignore","pipe"]}); let err="";
    p.stderr.on("data",d=>err+=d);
    p.on("error",reject);
    p.on("close",c=>c===0?resolve():reject(new Error(err||`${cmd} exited ${c}`)));
  });
}
app.get("/",(_q,r)=>r.json({name:"ClipDrop",version:"3.0.0",status:"online",platforms:["TikTok","Instagram"]}));
app.get("/health",(_q,r)=>r.json({ok:true,version:"3.0.0",ffmpeg:true}));

app.post("/process",(req,res)=>{
  const {url,format}=req.body??{};
  const p=platform(url);
  if(!p) return res.status(400).json({error:"Only HTTPS TikTok or Instagram links are accepted."});
  if(!["mp4","mp3"].includes(format)) return res.status(400).json({error:"format must be mp4 or mp3."});
  // Page URLs are deliberately not scraped here. An authorized platform integration
  // can resolve the user's permitted media and call /convert-direct.
  res.status(501).json({
    ok:false, platform:p, status:"authorized_media_source_required",
    message:`${p} URL accepted. Connect an authorized media source for the direct media URL.`
  });
});

app.post("/convert-direct",async(req,res)=>{
  const {mediaUrl,format}=req.body??{};
  let u; try{u=new URL(mediaUrl)}catch{}
  if(!u||u.protocol!=="https:") return res.status(400).json({error:"Valid HTTPS direct media URL required."});
  if(!["mp4","mp3"].includes(format)) return res.status(400).json({error:"format must be mp4 or mp3."});
  const work=await mkdtemp(path.join(tmpdir(),"clipdrop-"));
  const output=path.join(work,`clipdrop.${format}`);
  try{
    const args=format==="mp3"
      ?["-y","-i",u.toString(),"-vn","-c:a","libmp3lame","-q:a","2",output]
      :["-y","-i",u.toString(),"-c","copy",output];
    await run("ffmpeg",args);
    res.setHeader("Content-Type",format==="mp3"?"audio/mpeg":"video/mp4");
    res.setHeader("Content-Disposition",`attachment; filename="clipdrop.${format}"`);
    const s=createReadStream(output);
    const clean=()=>rm(work,{recursive:true,force:true}).catch(()=>{});
    s.on("close",clean); s.on("error",clean); s.pipe(res);
  }catch(e){
    await rm(work,{recursive:true,force:true});
    res.status(502).json({error:"Conversion failed."});
  }
});
app.listen(PORT,"0.0.0.0",()=>console.log(`ClipDrop v3 listening on ${PORT}`));
