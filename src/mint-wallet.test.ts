import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { mintScript } from './site.ts';
import type { ChainState } from './contract.ts';
const A='0x'+'2'.repeat(40),C='0x'+'1'.repeat(40),HASH='0x'+'a'.repeat(64);
function harness(mode: 'success'|'unknown'|'reject'|'changed'|'read-down', saved: string|null=null){
 let account=A,sends=0,reads=0,click!:()=>Promise<void>;const methods:string[]=[];
 const msg={textContent:'',insertAdjacentHTML(){}};
 const btn={disabled:false,addEventListener(_e:string,f:()=>Promise<void>){click=f}};
 const check={hidden:true,onclick:null};let reloads=0;
 runInNewContext(mintScript({address:C,chainId:8453} as ChainState,5).replace(/^<script>\s*/,'').replace(/<\/script>$/,''),{
 document:{getElementById:(id:string)=>id==='mint'?btn:id==='msg'?msg:check,hidden:false},
 localStorage:{getItem:()=>saved,setItem(_k:string,v:string){saved=v},removeItem(){saved=null}},
 window:{ethereum:{on(){},request:async({method}:{method:string})=>{methods.push(method);if(method==='eth_accounts'||method==='eth_requestAccounts')return[account];if(method==='eth_chainId')return mode==='changed'&&account===A?'0x1':'0x2105';if(method==='wallet_switchEthereumChain'){account=C;return null}if(method==='eth_sendTransaction'){sends++;if(mode==='unknown')throw new Error('timed out');if(mode==='reject')throw Object.assign(new Error('cancelled'),{code:4001});return HASH;}throw new Error('unsupported wallet RPC');}}},
 fetch:async()=>{reads++;return{ok:mode!=='read-down',json:async()=>({chainId:8453,contract:C,receipt:{status:'0x1',logs:[]}})}},AbortController,
 setTimeout:(f:()=>void,ms:number)=>{if(ms<10000)queueMicrotask(f);return 1},clearTimeout(){},confirm:()=>false,location:{reload(){reloads++}},
 });
 return {click:()=>click(),methods,msg,btn,get saved(){return saved},get sends(){return sends},get reads(){return reads},get reloads(){return reloads}};
}
test('confirmed saved claim resolves using API even when wallet RPC reads are unavailable',async()=>{const h=harness('success',HASH);await Bun.sleep(5);expect(h.reloads).toBe(1);expect(h.saved).toBeNull();expect(h.methods).not.toContain('eth_getTransactionReceipt');expect(h.sends).toBe(0)});
test('unknown send blocks repeat clicks and survives reload',async()=>{const h=harness('unknown');await h.click();await h.click();expect(h.sends).toBe(1);expect(h.saved).toBe('uncertain');const reload=harness('unknown',h.saved);await Bun.sleep(5);await reload.click();expect(reload.sends).toBe(0);expect(reload.msg.textContent).toContain('unknown result')});
test('wallet already on Base is not switched and rejected request releases marker',async()=>{const h=harness('reject');await h.click();expect(h.methods).not.toContain('wallet_switchEthereumChain');expect(h.saved).toBeNull();expect(h.btn.disabled).toBe(false)});
test('account change during network switch cannot submit a claim',async()=>{const h=harness('changed');await h.click();expect(h.sends).toBe(0)});
test('API failure retains saved transaction instead of sending again',async()=>{const h=harness('read-down',HASH);await Bun.sleep(5);expect(h.saved).toBe(HASH);expect(h.sends).toBe(0);expect(h.msg.textContent).toContain('cannot confirm')});
