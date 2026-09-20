# -*- coding: utf-8 -*-
import subprocess, re, os

# ═══ 1. 重建 index.html ═══
parts={}
for i in range(1,10):
    with open(f'p{i}.html',encoding='utf-8') as f: parts[i]=f.read()
p1=parts[1]; idx=p1.find('</style>')
html=parts[1][:idx]+parts[2]+parts[3]+'</style>\n</head>\n'+parts[4]+parts[5]+parts[6]+parts[7]+parts[8]+parts[9]
with open('index.html','w',encoding='utf-8') as f: f.write(html)
print(f'OK: index.html rebuilt, {len(html)} chars')

# ═══ 2. JS 语法检查 ═══
scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
alljs='\n'.join(scripts)
with open('_tmp_all.js','w',encoding='utf-8') as f: f.write(alljs)
r=subprocess.run(['node','--check','_tmp_all.js'],capture_output=True,text=True)
if r.returncode==0: print('JS语法检查通过')
else:
    print('JS语法错误:')
    print(r.stderr[:2000])
    os.remove('_tmp_all.js')
    exit(1)
os.remove('_tmp_all.js')

# ═══ 3. 从 MENU 提取所有菜单 id，验证每个 id 都有页面 ═══
menu=parts[7]
ids=re.findall(r"\{id:'([\w-]+)'",menu)
ids=list(dict.fromkeys(ids))
p8=parts[8]
static_pages=re.findall(r'id="(pg-[\w-]+)"',parts[5])
static_ids=[x[3:] for x in static_pages]  # pg-xxx -> xxx
missing=[]
for i in ids:
    has_page = f"'{i}':{{" in p8 or f"{i}:{{" in p8 or i in static_ids or i=='dashboard'
    if not has_page:
        missing.append(i)
print(f'\n菜单项总数(去重): {len(ids)}')
print('缺失页面的菜单项:', missing if missing else '无 ✓')

# ═══ 4. 四层分组结构断言 ═══
print('\n=== 四层菜单结构 ===')
checks=[
 ('console 数据看板','{g:\'数据看板\',items:[',menu),
 ('console 主体中心',"{g:'主体中心',items:[",menu),
 ('console 代理商中心子组','{group:\'代理商中心\'',menu),
 ('console 服务商中心子组','{group:\'服务商中心\'',menu),
 ('console 用户中心子组','{group:\'用户中心\'',menu),
 ('console 招商管理','{g:\'招商管理\'',menu),
 ('console 业务中心','{g:\'业务中心\'',menu),
 ('console 财务中心','{g:\'财务中心\'',menu),
 ('console 内容与营销','{g:\'内容与营销\'',menu),
 ('console 消息中心','{g:\'消息中心\'',menu),
 ('console 系统管理','{g:\'系统管理\'',menu),
 ('agent 辖区服务商','{group:\'辖区服务商\'',menu),
 ('agent 辖区运营','{g:\'辖区运营\'',menu),
 ('agent 招商拓展','{g:\'招商拓展\'',menu),
 ('provider 订单履约','{g:\'订单履约\'',menu),
 ('provider 服务与内容','{g:\'服务与内容\'',menu),
 ('provider 资质中心','{g:\'资质中心\'',menu),
 ('provider 团队与设置','{g:\'团队与设置\'',menu),
 ('user 评价与反馈','{g:\'评价与反馈\'',menu),
]
allok=True
for name,pat,src in checks:
    ok = pat in src
    if not ok: allok=False
    print(('✓' if ok else '✗'),name)

# ═══ 5. 关键页面与数据断言 ═══
print('\n=== 关键页面 ===')
p_checks=[
 ('新增 agent-kpi','\'agent-kpi\':{',p8),
 ('新增 provider-supervise','\'provider-supervise\':{',p8),
 ('新增 user-orders','\'user-orders\':{',p8),
 ('新增 complaints','\'complaints\':{',p8),
 ('新增 fin-overview','\'fin-overview\':{',p8),
 ('新增 settlements','\'settlements\':{',p8),
 ('新增 announcements','\'announcements\':{',p8),
 ('新增 coupons','\'coupons\':{',p8),
 ('新增 audit-logs','\'audit-logs\':{',p8),
 ('新增 a-apply','\'a-apply\':{',p8),
 ('新增 a-supervise','\'a-supervise\':{',p8),
 ('新增 a-invest','\'a-invest\':{',p8),
 ('新增 a-pool','\'a-pool\':{',p8),
 ('新增 a-settle','\'a-settle\':{',p8),
 ('新增 a-withdraw','\'a-withdraw\':{',p8),
 ('新增 a-notices','\'a-notices\':{',p8),
 ('新增 a-biz','\'a-biz\':{',p8),
 ('新增 p-schedule','\'p-schedule\':{',p8),
 ('新增 p-templates','\'p-templates\':{',p8),
 ('新增 p-complaints','\'p-complaints\':{',p8),
 ('新增 p-contract','\'p-contract\':{',p8),
 ('新增 p-income','\'p-income\':{',p8),
 ('新增 p-withdraw','\'p-withdraw\':{',p8),
 ('新增 p-notices','\'p-notices\':{',p8),
 ('新增 p-team','\'p-team\':{',p8),
 ('新增 p-clients','\'p-clients\':{',p8),
 ('provider-apply 为审批列表','\'provider-apply\':{t:\'服务商入驻审批\'',p8),
 ('a-qual 辖区服务商资质审核','\'a-qual\':{t:\'资质审核\'',p8),
 ('p-feedback 我的评价','\'p-feedback\':{t:\'我的评价\'',p8),
 ('业务申请静态页 pg-p-apply','id="pg-p-apply"',parts[5]),
 ('u-notices 动态页','\'u-notices\':{t:\'通知公告\'',parts[9]),
 ('u-complaints 动态页','\'u-complaints\':{t:\'我的反馈\'',parts[9]),
 ('openModal fallback 增强','f:r=>r,labels:(p.h||[]).map(c=>c.t)',parts[9]),
 ('saveModal 空值保护','mm=MODAL_META[MODAL_KEY]||{}',parts[9]),
 ('业务申请提交跳转工作台',"setTimeout(()=>goPage('dashboard'),600)",parts[9]),
 ('菜单无旧分组 总览与治理','总览与治理' not in menu,''),
 ('菜单无运营中心','运营中心' not in menu,''),
 ('菜单无 入住审批 错别字','入住审批' not in menu,''),
 ('菜单无 模版 错别字','模版' not in menu,''),
]
# 用户层 8 页由 userListMeta 动态生成（VIEW==='user' 时），属正常机制
dynamic_ok = all(i in parts[9] for i in ['u-orders','u-providers','u-feedback','u-complaints','u-notices','u-messages','u-wallet','u-coupons'])
print('用户层动态页(userListMeta)定义:', '✓' if dynamic_ok else '✗')
for name,pat,src in p_checks:
    ok = pat if src=='' else (pat in src)
    print(('✓' if ok else '✗'),name)
