// Shim minimal de vitest (Vitest natif crashe SIGBUS dans ce sandbox)
let suites = [];
let cur = null;
export function describe(name, fn){ const s={name,tests:[]}; const prev=cur; cur=s; fn(); cur=prev; suites.push(s); }
export function it(name, fn){ (cur?cur.tests:(suites.find(x=>x.name==='__top')||(()=>{const t={name:'__top',tests:[]};suites.push(t);return t;})()).tests).push({name,fn}); }
export const test = it;
function eq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
export function expect(actual){
  const mk=(neg)=>({
    toBe:(e)=>{ const ok=Object.is(actual,e); if(ok===neg) throw new Error(`expected ${JSON.stringify(actual)} ${neg?'not ':''}toBe ${JSON.stringify(e)}`); },
    toEqual:(e)=>{ const ok=eq(actual,e); if(ok===neg) throw new Error(`expected ${JSON.stringify(actual)} ${neg?'not ':''}toEqual ${JSON.stringify(e)}`); },
    toContain:(e)=>{ const ok=Array.isArray(actual)?actual.includes(e):String(actual).includes(e); if(ok===neg) throw new Error(`expected ${neg?'not ':''}toContain ${JSON.stringify(e)}`); },
    toBeGreaterThanOrEqual:(e)=>{ const ok=actual>=e; if(ok===neg) throw new Error(`expected ${actual} ${neg?'not ':''}>= ${e}`); },
    toBeTruthy:()=>{ const ok=!!actual; if(ok===neg) throw new Error(`expected ${neg?'not ':''}truthy`); },
  });
  const o=mk(false); o.not=mk(true); return o;
}
export async function __run(){
  let pass=0, fail=0; const fails=[];
  for(const s of suites){ for(const t of s.tests){ try{ await t.fn(); pass++; }catch(e){ fail++; fails.push(`${s.name} > ${t.name}: ${e.message}`); } } }
  return {pass, fail, fails};
}
