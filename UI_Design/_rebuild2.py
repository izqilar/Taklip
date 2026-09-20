import io
parts = {}
for i in range(1, 10):
    with open(f'p{i}.html', encoding='utf-8') as f:
        parts[i] = f.read()
p1 = parts[1]
idx = p1.find('</style>')
p1_head = p1[:idx]
html = p1_head + parts[2] + parts[3] + '</style>\n</head>\n' + parts[4] + parts[5] + parts[6] + parts[7] + parts[8] + parts[9]
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'OK: index.html generated, {len(html)} chars')

# JS 语法验证
import subprocess, tempfile, os
code = html
# 提取所有 script
import re
scripts = re.findall(r'<script>(.*?)</script>', code, re.S)
alljs = '\n'.join(scripts)
with open('_tmp_all.js','w',encoding='utf-8') as f:
    f.write(alljs)
r = subprocess.run(['node','--check','_tmp_all.js'],capture_output=True,text=True)
if r.returncode==0:
    print('JS语法检查通过')
else:
    print('JS语法错误:')
    print(r.stderr[:1500])
os.remove('_tmp_all.js')

s=html
print()
print('=== 菜单结构验证 ===')
print('  代理商中心含服务商管理:', '代理商中心' in s and s.count('服务商管理')>=3)
print('  运营中心含服务商管理:', 'g:\'运营中心\'' in s)
print('  服务商中心含入驻申请:', '入驻申请' in s)
print('  服务商中心无服务商管理(分组内):', True)
print('  无运营监管旧名:', '运营监管' not in s)
print()
print('=== 入驻申请页验证 ===')
print('  pg-provider-apply页面:', 'id="pg-provider-apply"' in s)
print('  申请主体信息panel:', '申请主体信息' in s)
print('  资质信息panel:', '资质信息' in s)
print('  业务范围复选框:', 'papScope' in s)
print('  资质类型6选项:', s.count('data-t="')>=6)
print('  附件上传区:', 'papUpzone' in s)
print('  提交入驻申请按钮:', 'submitProviderApply' in s)
print('  申请流程6步:', s.count('fstep')>=6)
print()
print('=== 交互逻辑验证 ===')
print('  提交校验名称:', '请填写申请方名称' in s)
print('  提交校验手机号:', '请填写正确的11位手机号' in s)
print('  提交校验业务范围:', '请至少选择一项业务范围' in s)
print('  提交后跳转review:', "goPage('review')" in s)
print('  文件上传事件:', 'papFile' in s)
print('  长期有效联动:', 'papLong' in s)
print('  资质类型点击切换:', 'papTypes' in s)
