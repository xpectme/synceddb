import*as i from"npm:idbx";var v=0,g=0;function E(S=1){let m=Date.now();return m===v?g++:(v=m,g=0),`${m}${g.toString().padStart(S,"0")}`}var w=class extends EventTarget{constructor(e,s,t){super();this.db=e;this.storeName=s;this.options={keyName:"id",url:location?.origin??"",autoSync:!1,createPath:"/api/create",readPath:"/api/read",updatePath:"/api/update",deletePath:"/api/delete",readAllPath:"/api/read_all",syncPath:"/api/sync",testRun:!1,...t},globalThis.addEventListener("online",()=>{this.syncState=new Promise(n=>{this.sync().then(()=>n("synced")).catch(console.error)})}),globalThis.addEventListener("offline",()=>{this.syncState=Promise.resolve("unsynced")})}static createStore(e,s,t){let n=e.createObjectStore(s,t??{keyPath:"id",autoIncrement:!1});return n.createIndex("syncState","sync_state",{unique:!1}),n.createIndex("syncAction","sync_action",{unique:!1}),n}options;syncState=Promise.resolve("unsynced");lastSync=0;async create(e){let s=this.#e("readwrite"),t=this.#t(e,"create","unsynced"),n;if(s.autoIncrement||(n="TMP-"+crypto.randomUUID(),t[this.options.keyName]=n),await i.add(s,t),navigator.onLine){let c=this.options.createPath,o=await this.#n("POST",c,e,n);return this.dispatchEvent(new MessageEvent("created",{data:o})),o}return t}async read(e,s=!1){let t=this.#e("readonly"),n=await i.get(t,e);if(n||(s=!0),navigator.onLine&&n?.sync_action==="create"||navigator.onLine&&s){let c=this.options.readPath,o=await this.#n("GET",c,void 0,e);return this.dispatchEvent(new MessageEvent("read",{data:o})),o}return this.dispatchEvent(new MessageEvent("read",{data:n})),n}async update(e){if(!e[this.options.keyName])throw new Error("Missing key");let s=e[this.options.keyName],t=this.#e("readwrite"),n=this.#t(e,"update","unsynced");if(await i.put(t,n),navigator.onLine){let c=this.options.updatePath,o=await this.#n("PUT",c,e,s);return this.dispatchEvent(new MessageEvent("updated",{data:o})),o}return n}async delete(e){let s=this.#e("readonly"),t=await i.get(s,e);if(t?.sync_action==="create"){let o=this.#e("readwrite");await i.del(o,e);return}let n=this.#e("readwrite"),c=this.#t(t,"delete","unsynced");if(await i.put(n,c),navigator.onLine){let o=this.options.deletePath;await this.#n("DELETE",o,void 0,e),this.dispatchEvent(new MessageEvent("deleted",{data:e}))}}async readAll(e=!1){let s=this.#e("readonly"),t=await i.getAll(s);if(navigator.onLine&&(t.length===0||e)){let n=new URL(this.options.url+this.options.readAllPath),c;if(this.options.testRun?(console.log(`TEST RUN: GET ${n}`),c=new Response(JSON.stringify(t),{status:200,headers:{"Content-Type":"application/json"}})):c=await fetch(n,{method:"GET",mode:"cors",credentials:"include"}),c.ok){let o=await c.json()??[],p=this.#e("readwrite"),d=(o??[]).map(a=>this.#t(a,"none","synced"));await i.putBulk(p,d);let u=t.filter(a=>a.sync_action==="create");t=[...d,...u]}else console.log("fetch entries failed",c)}return this.dispatchEvent(new MessageEvent("readAll",{data:t})),t}async sync(e=null){if(!navigator.onLine)return;e===null&&(e=this.lastSync);let c=this.#e("readonly").index("syncState").objectStore,p=(await i.getAll(c)).filter(r=>r.sync_state==="unsynced");if(p.length===0)return;let d=this.options.keyName,u=p.filter(r=>r.sync_action==="create").map(r=>r[d]),a=p.reduce((r,h)=>{if("sync_action"in h){let{sync_action:l}=h;l!==void 0&&(r[l]||(r[l]=[]),r[l].push(h))}return r},{}),y=new URL(this.options.url+this.options.syncPath);y.searchParams.set("t",e.toString());let f;if(this.options.testRun){let r=[];"delete"in a&&(r=a.delete.map(T=>T[d]));let h=[];"update"in a&&(h=JSON.parse(JSON.stringify(a.update)));let l=[];"create"in a&&(l=JSON.parse(JSON.stringify(a.create)).map(T=>(T[d]=E(3),T))),console.log(`TEST RUN: POST ${y}`),f=new Response(JSON.stringify({deleted:r,changed:[...h,...l],timestamp:Date.now()}),{status:200,headers:{"Content-Type":"application/json"}})}else f=await fetch(y,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a),mode:"cors",credentials:"include"});if(f.ok){let r=await f.json(),h=r.changed.map(l=>this.#t(l,"none","synced"));await i.batch(this.db,[{method:"del",storeName:this.storeName,keys:u},{method:"del",storeName:this.storeName,keys:r.deleted},{method:"put",storeName:this.storeName,data:h}],"readwrite").completed,this.dispatchEvent(new MessageEvent("synced",{data:r})),this.lastSync=new Date(r.timestamp).getTime()}else console.log("sync failed",f)}#t(e,s,t){return{...e,sync_action:s,sync_state:t}}#e(e){return this.db.transaction(this.storeName,e).objectStore(this.storeName)}#s(e,s=null){let t=new URL(this.options.url+e);return s&&t.searchParams.set(this.options.keyName,s),t}#n=async(e,s,t,n=null)=>{let o=e!=="GET"&&e!=="DELETE"?JSON.stringify(t):void 0,p=this.#s(s,n),d;if(this.options.testRun){let u=o?JSON.parse(o):"",a=200;if(e==="POST"){let y=E(3);u[this.options.keyName]=y,a=201}else e==="DELETE"?a=204:e==="PUT"&&(a=200);console.log(`TEST RUN: ${e} ${p}`),d=new Response(JSON.stringify(u),{status:a,headers:{"Content-Type":"application/json"}})}else d=await fetch(p,{method:e,body:o,mode:"cors",credentials:"include"});if(d.ok)if(e==="DELETE"&&n){await i.del(this.#e("readwrite"),n);return}else{let u=await d.json(),a=this.#t(u,"none","synced");return await i.put(this.#e("readwrite"),a),a}else d.status===404?n&&await i.del(this.#e("readwrite"),n):console.log("read/write/delete entry failed",d)}};export{w as SyncedDB};
//# sourceMappingURL=synceddb.js.map
