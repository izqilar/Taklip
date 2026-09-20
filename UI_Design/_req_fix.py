# -*- coding: utf-8 -*-
import io

def load(p): return open(p,encoding='utf-8').read()
def save(p,s): open(p,'w',encoding='utf-8').write(s)

# ═══ A. p1.html :root 补 --bad（星号红色变量） ═══
p='p1.html'; s=load(p)
old="  --warn:#b77a16; --warn-ink:#7a4d07;"
new="  --warn:#b77a16; --warn-ink:#7a4d07;\n  --bad:#c02b33; --bad-ink:#8f1d24;"
assert old in s, 'p1 --warn anchor'
s=s.replace(old,new,1); save(p,s); print('OK A: p1 --bad added')

# ═══ B. p9 buildForm 支持 eReq ═══
p='p9.html'; s=load(p)
old_bf="""function buildForm(mm,r){
  const vals=mm.eF(r);
  return mm.eLabels.map((lbl,k)=>{
    const t=(mm.eTypes||[])[k]||'text';
    const opts=((mm.eOpts||{})[k])||[];
    const val=vals[k]===null||vals[k]===undefined?'':vals[k];
    if(t==='textarea')return `<div class="fd"><label>${lbl}</label><textarea class="field" data-ef="${k}" rows="2">${val}</textarea></div>`;
    if(t==='select')return `<div class="fd"><label>${lbl}</label><select class="field" data-ef="${k}">${opts.map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('')}</select></div>`;
    if(t==='perm'){
      const cur=Array.isArray(val)?val:[];
      return `<div class="fd"><label>${lbl}</label><div class="perm">${permGroups().map(g=>`<div class="pgrp"><div class="pgt">${g.g}</div>${g.items.map(it=>`<label class="pchk"><input type="checkbox" data-ef="${k}" data-perm="${it}"${cur.indexOf(it)>=0?' checked':''}>${it}</label>`).join('')}</div>`).join('')}</div></div>`;
    }
    return `<div class="fd"><label>${lbl}</label><input class="field" data-ef="${k}" value="${val}"></div>`;
  }).join('');
}"""
new_bf="""function buildForm(mm,r){
  const vals=mm.eF(r);
  return mm.eLabels.map((lbl,k)=>{
    const t=(mm.eTypes||[])[k]||'text';
    const opts=((mm.eOpts||{})[k])||[];
    const val=vals[k]===null||vals[k]===undefined?'':vals[k];
    const star=(mm.eReq&&mm.eReq.indexOf(k)>=0)?'<span class="req">*</span>':'';
    if(t==='textarea')return `<div class="fd"><label>${lbl}${star}</label><textarea class="field" data-ef="${k}" rows="2">${val}</textarea></div>`;
    if(t==='select')return `<div class="fd"><label>${lbl}${star}</label><select class="field" data-ef="${k}">${opts.map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('')}</select></div>`;
    if(t==='perm'){
      const cur=Array.isArray(val)?val:[];
      return `<div class="fd"><label>${lbl}${star}</label><div class="perm">${permGroups().map(g=>`<div class="pgrp"><div class="pgt">${g.g}</div>${g.items.map(it=>`<label class="pchk"><input type="checkbox" data-ef="${k}" data-perm="${it}"${cur.indexOf(it)>=0?' checked':''}>${it}</label>`).join('')}</div>`).join('')}</div></div>`;
    }
    return `<div class="fd"><label>${lbl}${star}</label><input class="field" data-ef="${k}" value="${val}"></div>`;
  }).join('');
}"""
assert old_bf in s, 'buildForm anchor'
s=s.replace(old_bf,new_bf,1); print('OK B: buildForm eReq')

# ═══ C. MODAL_META 各编辑对话框补 eReq ═══
pairs=[
 # regions
 ("eTypes:['text','select','text'],eOpts:{1:['省级','市级','区县级']}}",
  "eTypes:['text','select','text'],eOpts:{1:['省级','市级','区县级']},eReq:[0,1]}"),
 # agents
 ("eTypes:['text','text','select'],eOpts:{2:['正常','待复核','停用']}}",
  "eTypes:['text','text','select'],eOpts:{2:['正常','待复核','停用']},eReq:[0,1]}"),
 # review
 ("eTypes:['text','text','select'],eOpts:{2:['#ok 已通过','#bad 已驳回','#warn 待审核']}}",
  "eTypes:['text','text','select'],eOpts:{2:['#ok 已通过','#bad 已驳回','#warn 待审核']},eReq:[0,1]}"),
 # users
 ("eTypes:['select','text','select'],eOpts:{0:['客户','服务商','代理商','管理员'],2:['正常','停用']}}",
  "eTypes:['select','text','select'],eOpts:{0:['客户','服务商','代理商','管理员'],2:['正常','停用']},eReq:[0,1]}"),
 # feedback
 ("eTypes:['textarea','select'],eOpts:{1:['协商中','已关闭','升级仲裁']}}",
  "eTypes:['textarea','select'],eOpts:{1:['协商中','已关闭','升级仲裁']},eReq:[0]}"),
 # roles
 ("eF:r=>[r[0],r[3],r[7]],eCols:[0,3,7],eTypes:['text','text','perm']}}",
  "eF:r=>[r[0],r[3],r[7]],eCols:[0,3,7],eTypes:['text','text','perm']},eReq:[0]}"),
 # settings
 ("eF:r=>[r[0],r[1],r[2],r[3]],eCols:[0,1,2,3],eTypes:['text','text','text','text']}}",
  "eF:r=>[r[0],r[1],r[2],r[3]],eCols:[0,1,2,3],eTypes:['text','text','text','text']},eReq:[1,2]}"),
 # provider-contract (第一次出现)
 ("eTypes:['text','select','select'],eOpts:{1:['主合同','补充协议','续签合同','终止协议'],2:['已签订','审批中','待签订','已到期','已终止']}}",
  "eTypes:['text','select','select'],eOpts:{1:['主合同','补充协议','续签合同','终止协议'],2:['已签订','审批中','待签订','已到期','已终止']},eReq:[0]}"),
 # agent-contract (第二次出现)
 ("eTypes:['text','select','select'],eOpts:{1:['主合同','补充协议','续签合同','终止协议'],2:['已签订','审批中','待签订','已到期','已终止']},eReq:[0]}",
  "eTypes:['text','select','select'],eOpts:{1:['主合同','补充协议','续签合同','终止协议'],2:['已签订','审批中','待签订','已到期','已终止']},eReq:[0]}"),
 # agent-invest
 ("eTypes:['select','textarea'],eOpts:{0:['新申请','跟进中','已转化','已放弃']}}",
  "eTypes:['select','textarea'],eOpts:{0:['新申请','跟进中','已转化','已放弃']},eReq:[1]}"),
 # agent-pool
 ("eTypes:['select','textarea'],eOpts:{0:['高意向','中意向','低意向']}}",
  "eTypes:['select','textarea'],eOpts:{0:['高意向','中意向','低意向']},eReq:[0]}"),
 # a-feedback
 ("eTypes:['textarea','select'],eOpts:{1:['协商中','已处理','可升级']}}",
  "eTypes:['textarea','select'],eOpts:{1:['协商中','已处理','可升级']},eReq:[0]}"),
 # a-roles
 ("eF:r=>[r[0],r[3],r[6]],eCols:[0,3,6],eTypes:['text','text','perm']}}",
  "eF:r=>[r[0],r[3],r[6]],eCols:[0,3,6],eTypes:['text','text','perm']},eReq:[0]}"),
 # p-services
 ("eTypes:['text','text','text','select'],eOpts:{3:['在售','草稿','已下架']}}",
  "eTypes:['text','text','text','select'],eOpts:{3:['在售','草稿','已下架']},eReq:[0,1,2]}"),
 # p-qualification
 ("eTypes:['text','text','select'],eOpts:{2:['有效','待审核','已过期']}}",
  "eTypes:['text','text','select'],eOpts:{2:['有效','待审核','已过期']},eReq:[0,1]}"),
]
done=0
for old,new in pairs:
    if old in s:
        s=s.replace(old,new,1); done+=1
    else:
        print('  WARN miss:', old[:60])
print(f'OK C: eReq applied {done}/{len(pairs)}')

# ═══ D. openModal inlineEdits 的 label 统一加红色星号（资质类型/证照编号/有效期等） ═══
old_ie="""    if(editing&&mm.inlineEdits){
      const ie=mm.inlineEdits.find(x=>x.col===k);
      if(ie){"""
new_ie="""    if(editing&&mm.inlineEdits){
      const ie=mm.inlineEdits.find(x=>x.col===k);
      if(ie){
        const lr=lbl+'<span class="req">*</span>';"""
assert old_ie in s, 'inlineEdits anchor'
s=s.replace(old_ie,new_ie,1)
# 将 inlineEdits 分支内 4 处 ${lbl} 替换为 ${lr}
subs=[
 ('<dt style="vertical-align:top;padding-top:10px">${lbl}</dt>','<dt style="vertical-align:top;padding-top:10px">${lr}</dt>'),
 ('return `<dt>${lbl}</dt><dd><select class="field" data-inline-edit="${k}"','return `<dt>${lr}</dt><dd><select class="field" data-inline-edit="${k}"'),
 ('return `<dt>${lbl}</dt><dd><input type="date" class="field" data-inline-edit="${k}"','return `<dt>${lr}</dt><dd><input type="date" class="field" data-inline-edit="${k}"'),
 ('return `<dt>${lbl}</dt><dd><input class="field" data-inline-edit="${k}"','return `<dt>${lr}</dt><dd><input class="field" data-inline-edit="${k}"'),
]
for o,n in subs:
    assert o in s, 'ie sub: '+o[:40]
    s=s.replace(o,n,1)
print('OK D: inlineEdits labels starred')

# ═══ E. ACCOUNT_META 必填字段 req 标记 ═══
acc=[
 # console 姓名/手机号
 ("{l:'姓名',v:'张敏',edit:'text'}", "{l:'姓名',v:'张敏',edit:'text',req:1}"),
 ("{l:'手机号',v:'189****9001',edit:'text'}", "{l:'手机号',v:'189****9001',edit:'text',req:1}"),
 # agent 代理商名称/手机号
 ("{l:'代理商名称',v:'乌鲁木齐天山区',edit:'text'}", "{l:'代理商名称',v:'乌鲁木齐天山区',edit:'text',req:1}"),
 ("{l:'手机号',v:'138****2210',edit:'text'}", "{l:'手机号',v:'138****2210',edit:'text',req:1}"),
 # provider 姓名/手机号
 ("{l:'姓名',v:'麦麦提·艾力',edit:'text'}", "{l:'姓名',v:'麦麦提·艾力',edit:'text',req:1}"),
 # user 姓名/手机号
 ("{l:'姓名',v:'买买提·艾山',edit:'text'}", "{l:'姓名',v:'买买提·艾山',edit:'text',req:1}"),
 ("{l:'手机号',v:'137****5521',edit:'text'}", "{l:'手机号',v:'137****5521',edit:'text',req:1}"),
]
# 注意：agent 手机号与 provider 手机号相同文本，按顺序 replace 会先替换 agent 的；
# provider 的手机号需要二次处理（用 unique 上下文）
n=0
for o,nw in acc:
    if o in s:
        s=s.replace(o,nw,1); n+=1
    else:
        print('  WARN acc miss:', o[:36])
# provider 手机号（agent 已带 req:1，现在剩下 provider 的那一处无 req）
old_pm="""   {title:'基础数据',hint:'身份与联系信息',fields:[
    {l:'服务商 ID',v:'SP001'},
    {l:'姓名',v:'麦麦提·艾力',edit:'text',req:1},
    {l:'昵称',v:'喜事管家',edit:'text'},
    {l:'手机号',v:'138****2210',edit:'text'},"""
new_pm="""   {title:'基础数据',hint:'身份与联系信息',fields:[
    {l:'服务商 ID',v:'SP001'},
    {l:'姓名',v:'麦麦提·艾力',edit:'text',req:1},
    {l:'昵称',v:'喜事管家',edit:'text'},
    {l:'手机号',v:'138****2210',edit:'text',req:1},"""
if old_pm in s:
    s=s.replace(old_pm,new_pm,1); n+=1
else:
    print('  WARN provider phone context')
print(f'OK E: ACCOUNT_META req {n}')

# ═══ F. renderAccount label 渲染必填星号 ═══
old_ra="return `<div class=\"pfield\"><label>${f.l}</label><div class=\"val ${f.mut?'mut':''} ${f.num?'num':''}\">${val}</div></div>`;"
new_ra="return `<div class=\"pfield\"><label>${f.l}${f.req?'<span class=\"req\">*</span>':''}</label><div class=\"val ${f.mut?'mut':''} ${f.num?'num':''}\">${val}</div></div>`;"
assert old_ra in s, 'renderAccount anchor'
s=s.replace(old_ra,new_ra,1); print('OK F: renderAccount req star')

save(p,s)
print('DONE all')
