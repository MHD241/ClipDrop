import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({limit:"16kb"}));
app.use(express.static("public"));

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:["ignore","ignore","pipe"]});
    let err="";
    p.stderr.on("data",d=>err+=d.toString());
    p.on("error",reject);
    p.on("close",c=>c===0?resolve():reject(new Error(err||`${cmd} exited ${c}`)));
  });
}

app.get("/health",(_q,r)=>r.json({ok:true,version:"4.0.0"}));

app.post("/api/convert", async (req,res)=>{
  const {mediaUrl,format}=req.body??{};
  let u;
  try { u=new URL(mediaUrl); } catch {}
  if(!u || u.protocol!=="https:")
    return res.status(400).json({error:"Please provide an HTTPS direct media URL."});
  if(!["mp4","mp3"].includes(format))
    return res.status(400).json({error:"Choose MP4 or MP3."});

  const work=await mkdtemp(path.join(tmpdir(),"clipdrop-"));
  const output=path.join(work,`clipdrop.${format}`);
  try{
    const args = format==="mp3"
      ? ["-y","-i",u.toString(),"-vn","-c:a","libmp3lame","-q:a","2",output]
      : ["-y","-i",u.toString(),"-c","copy","-movflags","+faststart",output];
    await run("ffmpeg",args);

    res.setHeader("Content-Type",format==="mp3"?"audio/mpeg":"video/mp4");
    res.setHeader("Content-Disposition",`attachment; filename="clipdrop.${format}"`);
    const s=createReadStream(output);
    const clean=()=>rm(work,{recursive:true,force:true}).catch(()=>{});
    s.on("close",clean);
    s.on("error",clean);
    s.pipe(res);
  } catch(e) {
    await rm(work,{recursive:true,force:true});
    res.status(502).json({error:"Could not process that media URL. Make sure it is a direct, publicly reachable video/audio file."});
  }
});

app.listen(PORT,"0.0.0.0",()=>console.log(`ClipDrop v4 listening on ${PORT}`));
