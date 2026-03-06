import sys

with open("public/index.html","r") as f:
    src = f.read()

changes = 0

# 1. Add login state
old = '''  const [uwKey,setUwKey]      = useState("");
  const [showKey,setShowKey]  = useState(false);
  const [uwOk,setUwOk]        = useState(null);   // null/true/false'''
new = '''  const [uwKey,setUwKey]      = useState("");
  const [showKey,setShowKey]  = useState(false);
  const [uwOk,setUwOk]        = useState(null);   // null/true/false
  const [loginOpen,setLoginOpen]   = useState(true);
  const [loginMode,setLoginMode]   = useState("login");
  const [loginPwd,setLoginPwd]     = useState("");
  const [setupPwd,setSetupPwd]     = useState("");
  const [setupKey,setSetupKey]     = useState("");
  const [loginErr,setLoginErr]     = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [configured,setConfigured] = useState(null);'''
if old in src: src=src.replace(old,new,1); changes+=1

# 2. Add login functions
old = '''  /* ── 模擬跳動 ───────────────────────────────────────────────────────────── */'''
new = '''  /* ── 登入 / 設定 ───────────────────────────────────────────────────────── */
  const WORKER = "https://solitary-wood-898d.justest521.workers.dev";
  useEffect(()=>{
    fetch(`${WORKER}/auth/status`).then(r=>r.json()).then(j=>{
      setConfigured(j.configured);setLoginMode(j.configured?"login":"setup");
    }).catch(()=>setConfigured(false));
  },[]);
  const handleLogin = useCallback(async()=>{
    if(!loginPwd){setLoginErr("請輸入密碼");return;}
    setLoginLoading(true);setLoginErr("");
    try{
      const r=await fetch(`${WORKER}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:loginPwd})});
      const j=await r.json();
      if(!r.ok){setLoginErr(j.error||"密碼錯誤");return;}
      setUwKey(j.uwKey);setLoginOpen(false);setLoginPwd("");
    }catch(e){setLoginErr("連線失敗："+e.message);}
    finally{setLoginLoading(false);}
  },[loginPwd]);
  const handleSetup = useCallback(async()=>{
    if(!setupPwd||!setupKey){setLoginErr("請填寫密碼和金鑰");return;}
    if(setupPwd.length<6){setLoginErr("密碼至少 6 個字元");return;}
    setLoginLoading(true);setLoginErr("");
    try{
      const r=await fetch(`${WORKER}/auth/save`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:setupPwd,uwKey:setupKey})});
      const j=await r.json();
      if(!r.ok){setLoginErr(j.error||"儲存失敗");return;}
      setConfigured(true);setLoginMode("login");
      setLoginErr("✅ 金鑰已儲存！請用剛設定的密碼登入");
      setSetupPwd("");setSetupKey("");
    }catch(e){setLoginErr("連線失敗："+e.message);}
    finally{setLoginLoading(false);}
  },[setupPwd,setupKey]);

  /* ── 模擬跳動 ───────────────────────────────────────────────────────────── */'''
if old in src: src=src.replace(old,new,1); changes+=1

# 3. Replace sidebar UW input with login button
old = '''        {/* UW Key + stats */}
        <div style={{marginTop:"auto",padding:"14px",borderTop:"1px solid #ffffff08"}}>
          <div style={{fontSize:11,color:"#ffffff30",letterSpacing:1,marginBottom:6}}>UW API 金鑰</div>
          <div style={{display:"flex",gap:5,marginBottom:4}}>
            <input type={showKey?"text":"password"} value={uwKey}
              onChange={e=>setUwKey(e.target.value)}
              placeholder="uw_key_••••••" style={{flex:1,fontSize:12}}/>
            <div onClick={()=>setShowKey(v=>!v)} style={{padding:"5px 8px",background:"#ffffff08",
              border:"1px solid #ffffff15",borderRadius:5,cursor:"pointer",fontSize:13,color:"#ffffff40"}}>👁</div>
          </div>
          {uwKey&&<div onClick={()=>loadUW(uwKey)} style={{fontSize:12,color:"#ffa72680",cursor:"pointer",textAlign:"center",
            padding:"4px",background:"#ffa72610",borderRadius:5,border:"1px solid #ffa72625",marginBottom:8}}>↻ 重新連線</div>}'''
new = '''        {/* UW Key + stats */}
        <div style={{marginTop:"auto",padding:"14px",borderTop:"1px solid #ffffff08"}}>
          {uwKey?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,color:"#00e5a080",letterSpacing:1}}>● 已登入</span>
              <div onClick={()=>{setUwKey("");setUwOk(null);setLoginOpen(true);setLoginPwd("");}}
                style={{fontSize:11,padding:"2px 8px",borderRadius:4,cursor:"pointer",
                  background:"#ffffff08",border:"1px solid #ffffff12",color:"#ffffff40"}}>登出</div>
            </div>
          ):(
            <div onClick={()=>setLoginOpen(true)}
              style={{width:"100%",padding:"8px",marginBottom:8,borderRadius:6,cursor:"pointer",textAlign:"center",
                background:"#ffa72618",border:"1px solid #ffa72640",fontSize:13,color:"#ffa726",fontWeight:600}}>
              🔐 登入取得 UW 數據
            </div>
          )}'''
if old in src: src=src.replace(old,new,1); changes+=1

# 4. Add modal before closing
old = '''    </div>
  );
}'''
new = '''      {loginOpen&&(
        <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0f0f14",border:"1px solid #ffffff15",borderRadius:14,padding:"36px 32px",width:360,boxShadow:"0 20px 60px #000"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,#ffa726,#ff6d00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:"#000"}}>D</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:900,color:"#fff"}}>DONDONHAPPY</div>
                <div style={{fontSize:10,color:"#ffffff35",letterSpacing:1.5}}>期權 · 量化 · 暗池</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:20}}>
              {["login","setup"].map(m=>(
                <div key={m} onClick={()=>{setLoginMode(m);setLoginErr("");}}
                  style={{flex:1,padding:"7px",borderRadius:6,cursor:"pointer",textAlign:"center",fontSize:13,
                    background:loginMode===m?"#ffa72620":"#ffffff08",border:`1px solid ${loginMode===m?"#ffa72650":"#ffffff10"}`,
                    color:loginMode===m?"#ffa726":"#ffffff40",fontWeight:loginMode===m?700:400}}>
                  {m==="login"?"🔐 登入":"⚙️ 首次設定"}
                </div>
              ))}
            </div>
            {loginMode==="login"?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,color:"#ffffff40"}}>輸入密碼解鎖 UW API 金鑰</div>
                <input type="password" value={loginPwd} onChange={e=>setLoginPwd(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="密碼" autoFocus
                  style={{padding:"10px 12px",fontSize:14,borderRadius:7,background:"#0a0a0d",border:"1px solid #ffffff20",color:"#fff"}}/>
                <div onClick={handleLogin} style={{padding:"11px",borderRadius:7,cursor:"pointer",textAlign:"center",
                  background:"#ffa72625",border:"1px solid #ffa72650",fontSize:14,color:"#ffa726",fontWeight:700}}>
                  {loginLoading?"解密中…":"登入"}
                </div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,color:"#ffffff40"}}>首次設定：輸入 UW 金鑰 + 設定密碼，加密儲存至雲端</div>
                <input type="text" value={setupKey} onChange={e=>setSetupKey(e.target.value)}
                  placeholder="UW API 金鑰 (UUID)"
                  style={{padding:"10px 12px",fontSize:13,borderRadius:7,background:"#0a0a0d",border:"1px solid #ffffff20",color:"#fff"}}/>
                <input type="password" value={setupPwd} onChange={e=>setSetupPwd(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleSetup()} placeholder="設定密碼（至少 6 字元）"
                  style={{padding:"10px 12px",fontSize:14,borderRadius:7,background:"#0a0a0d",border:"1px solid #ffffff20",color:"#fff"}}/>
                <div onClick={handleSetup} style={{padding:"11px",borderRadius:7,cursor:"pointer",textAlign:"center",
                  background:"#ffa72625",border:"1px solid #ffa72650",fontSize:14,color:"#ffa726",fontWeight:700}}>
                  {loginLoading?"儲存中…":"加密儲存金鑰"}
                </div>
              </div>
            )}
            {loginErr&&(
              <div style={{marginTop:12,padding:"8px 12px",borderRadius:6,fontSize:12,
                background:loginErr.startsWith("✅")?"#00e5a010":"#ff4d6d10",
                border:`1px solid ${loginErr.startsWith("✅")?"#00e5a030":"#ff4d6d30"}`,
                color:loginErr.startsWith("✅")?"#00e5a0":"#ff4d6d"}}>{loginErr}</div>
            )}
            <div onClick={()=>setLoginOpen(false)}
              style={{marginTop:16,textAlign:"center",fontSize:12,color:"#ffffff25",cursor:"pointer"}}>
              略過，使用模擬數據
            </div>
          </div>
        </div>
      )}
    </div>
  );
}'''
if old in src: src=src.replace(old,new,1); changes+=1

with open("public/index.html","w") as f:
    f.write(src)

print(f"Changes applied: {changes}/4")
