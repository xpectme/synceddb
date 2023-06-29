import*as o from"npm:idbx";var v=0,g=0;function E(S=1){let m=Date.now();return m===v?g++:(v=m,g=0),`${m}${g.toString().padStart(S,"0")}`}var w=class extends EventTarget{constructor(e,s,t){super();this.db=e;this.storeName=s;this.options={keyName:"id",url:location?.origin??"",autoSync:!1,createPath:"/api/create",readPath:"/api/read",updatePath:"/api/update",deletePath:"/api/delete",readAllPath:"/api/read_all",syncPath:"/api/sync",testRun:!1,...t},globalThis.addEventListener("online",()=>{this.syncState=new Promise(n=>{this.sync().then(()=>n("synced")).catch(console.error)})}),globalThis.addEventListener("offline",()=>{this.syncState=Promise.resolve("unsynced")})}static createStore(e,s,t){let n=e.createObjectStore(s,{keyPath:"id",autoIncrement:!1,...t});return n.createIndex("primaryKey","id",{unique:!0}),n.createIndex("syncState","sync_state",{unique:!1}),n.createIndex("syncAction","sync_action",{unique:!1}),n}options;syncState=Promise.resolve("unsynced");lastSync=0;async create(e){let s=this.#e("readwrite"),t=this.#t(e,"create","unsynced"),n;if(s.autoIncrement?(n=await o.add(s,t),e[this.options.keyName]=n,console.log("key",n)):(n="TMP-"+crypto.randomUUID(),e[this.options.keyName]=t[this.options.keyName]=n,await o.add(s,t)),navigator.onLine){let d=this.options.createPath,a=await this.#n("POST",d,e,n);return this.dispatchEvent(new MessageEvent("created",{data:a})),a}return t}async read(e,s=!1){let t=this.#e("readonly"),n=await o.get(t,e);if(n||(s=!0),navigator.onLine&&n?.sync_action==="create"||navigator.onLine&&s){let d=this.options.readPath,a=await this.#n("GET",d,void 0,e);return this.dispatchEvent(new MessageEvent("read",{data:a})),a}return this.dispatchEvent(new MessageEvent("read",{data:n})),n}async update(e){if(!e[this.options.keyName])throw new Error("Missing key");let s=e[this.options.keyName],t=this.#e("readwrite"),n=this.#t(e,"update","unsynced");if(await o.put(t,n),navigator.onLine){let d=this.options.updatePath,a=await this.#n("PUT",d,e,s);return this.dispatchEvent(new MessageEvent("updated",{data:a})),a}return n}async delete(e){let s=this.#e("readonly"),t=await o.get(s,e);if(t?.sync_action==="create"){let a=this.#e("readwrite");await o.del(a,e);return}let n=this.#e("readwrite"),d=this.#t(t,"delete","unsynced");if(await o.put(n,d),navigator.onLine){let a=this.options.deletePath;await this.#n("DELETE",a,void 0,e),this.dispatchEvent(new MessageEvent("deleted",{data:e}))}}async readAll(e=!1){let s=this.#e("readonly"),t=await o.getAll(s);if(navigator.onLine&&(t.length===0||e)){let n=new URL(this.options.url+this.options.readAllPath),d;if(this.options.testRun?(console.log(`TEST RUN: GET ${n}`),d=new Response(JSON.stringify(t),{status:200,headers:{"Content-Type":"application/json"}})):d=await fetch(n,{method:"GET",mode:"cors",credentials:"include"}),d.ok){let h=(await d.json()??[]??[]).map(i=>this.#t(i,"none","synced")),l=t.filter(i=>!h.some(p=>p[this.options.keyName]===i[this.options.keyName])).map(i=>i[this.options.keyName]),c=h.filter(i=>t.some(p=>p[this.options.keyName]===i[this.options.keyName]));return await o.batch(this.db,[{method:"del",keys:l,storeName:this.storeName},{method:"put",data:c,storeName:this.storeName}],"readwrite").completed,t=await o.getAll(this.#e("readonly")),this.dispatchEvent(new MessageEvent("readAll",{data:t})),t}else console.log("fetch entries failed",d)}return this.dispatchEvent(new MessageEvent("readAll",{data:t})),t}async sync(e=null){if(!navigator.onLine)return;e===null&&(e=this.lastSync);let d=this.#e("readonly").index("syncState").objectStore,h=(await o.getAll(d)).filter(r=>r.sync_state==="unsynced");if(h.length===0)return;let l=this.options.keyName,c=h.filter(r=>r.sync_action==="create").map(r=>r[l]),i=h.reduce((r,u)=>{if("sync_action"in u){let{sync_action:y}=u;y!==void 0&&(r[y]||(r[y]=[]),r[y].push(u))}return r},{}),p=new URL(this.options.url+this.options.syncPath);p.searchParams.set("t",e.toString());let f;if(this.options.testRun){let r=[];"delete"in i&&(r=i.delete.map(T=>T[l]));let u=[];"update"in i&&(u=JSON.parse(JSON.stringify(i.update)));let y=[];"create"in i&&(y=JSON.parse(JSON.stringify(i.create)).map(T=>(T[l]=E(3),T))),console.log(`TEST RUN: POST ${p}`),f=new Response(JSON.stringify({deleted:r,changed:[...u,...y],timestamp:Date.now()}),{status:200,headers:{"Content-Type":"application/json"}})}else f=await fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i),mode:"cors",credentials:"include"});if(f.ok){let r=await f.json(),u=r.changed.map(y=>this.#t(y,"none","synced"));await o.batch(this.db,[{method:"del",storeName:this.storeName,keys:c},{method:"del",storeName:this.storeName,keys:r.deleted},{method:"put",storeName:this.storeName,data:u}],"readwrite").completed,this.dispatchEvent(new MessageEvent("synced",{data:r})),this.lastSync=new Date(r.timestamp).getTime()}else console.log("sync failed",f)}#t(e,s,t){return{...e,sync_action:s,sync_state:t}}#e(e){return this.db.transaction(this.storeName,e).objectStore(this.storeName)}#s(e,s){let t=new URL(this.options.url+e);return s&&t.searchParams.set(this.options.keyName,s.toString()),t}#n=async(e,s,t,n)=>{let a=e!=="GET"&&e!=="DELETE"?JSON.stringify(t):void 0,h=this.#s(s,n),l;if(this.options.testRun){let c=a?JSON.parse(a):null,i=200,p=new Headers({"Content-Type":"application/json"});if(e==="POST"){let f=E(3);c!==null&&this.options.keyName in c&&(c[this.options.keyName]=f),i=201}else e==="DELETE"?(i=204,p.delete("Content-Type")):e==="PUT"&&(i=200);c!==null&&(c=JSON.stringify(c)),console.log(`TEST RUN: ${e} ${h}`),l=new Response(c,{status:i,headers:p})}else l=await fetch(h.toString(),{method:e,body:a,mode:"cors",credentials:"include"});if(l.ok)if(e==="DELETE"&&n){await o.del(this.#e("readwrite"),n);return}else{let c=await l.json(),i=this.#t(c,"none","synced");return await o.put(this.#e("readwrite"),i),i}else l.status===404?n&&await o.del(this.#e("readwrite"),n):console.log("read/write/delete entry failed",l)}};export{w as SyncedDB};
//# sourceMappingURL=synceddb.js.map
