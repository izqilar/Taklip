"""
账户详情「身份认证资料 / 账号安全」文案同步（幂等、保行尾）。

⚠️ 两个坑（踩过一次，勿再犯）：
1. 读取 i18n 文件必须 `newline=''`：默认读取把 CRLF 翻译成 LF，写回会造成整文件 diff。
2. 运营端 `web-common.json` 含行内紧凑写法，**禁止整体 json.dump**；且 `userCenter` 之后
   第一个 `"account"` 可能是 `menu.account` 字符串，必须按「以 `{` 结尾的 account 成员行」定位对象。
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

KEY_RE = re.compile(r'^\s*"([^"]+)"\s*:')

ZH = {
    "identityGroup": "身份认证资料",
    "identityHint": "实名认证与证件影像",
    "certStatus": "认证状态",
    "certUnverified": "待完善",
    "certPending": "待审核",
    "certApproved": "已认证",
    "certRejected": "已驳回",
    "idCard": "身份证号",
    "idCardFront": "身份证 · 人像面",
    "idCardBack": "身份证 · 国徽面",
    "notUploaded": "未上传",
    "preview": "预览",
    "upload": "上传",
    "reupload": "重新上传",
    "incomplete": "待完善",
    "incompleteGuide": "资料待完善：请点击「编辑」补充身份证号与证件影像，提交后进入人工审核。",
    "invalidIdCard": "身份证号校验失败：应为 18 位，末位可为 X，校验位不正确",
    "invalidEmail": "邮箱格式不正确",
    "invalidPhone": "手机号格式不正确（11 位，1 开头）",
    "verifiedAt": "认证于",
    "securityGroup": "账号安全",
    "securityHint": "手机号 / 登录密码 / 第三方账号",
    "password": "登录密码",
    "passwordMask": "••••••••",
    "changePhone": "修改手机号",
    "currentPhone": "当前号码",
    "newPhone": "新手机号",
    "phoneUpdated": "手机号已更新",
    "phoneUpdateFailed": "手机号修改失败",
    "changePassword": "修改登录密码",
    "oldPassword": "原密码",
    "newPassword": "新密码",
    "confirmPassword": "确认新密码",
    "oldPasswordRequired": "请输入原密码",
    "pwdTooShort": "新密码至少 6 位",
    "pwdMismatch": "两次输入的新密码不一致",
    "pwdSuccess": "密码已修改，下次登录请使用新密码",
    "pwdFailed": "原密码不正确，修改失败",
    "wechat": "微信",
    "qq": "QQ",
    "alipay": "支付宝",
    "bound": "已绑定",
    "unbound": "未绑定",
    "bind": "绑定",
    "unbind": "解绑",
    "comingSoon": "该功能即将上线",
    "imageSelected": "证件影像已选择，保存后生效",
    "uploadFailed": "证件影像上传失败",
    "maskedHint": "非本人访问或账号状态异常，手机号已脱敏",
    "saveSuccess": "资料已保存",
}

EN = {
    "identityGroup": "Identity Verification",
    "identityHint": "Real-name status & ID images",
    "certStatus": "Verification status",
    "certUnverified": "Incomplete",
    "certPending": "Pending review",
    "certApproved": "Verified",
    "certRejected": "Rejected",
    "idCard": "ID number",
    "idCardFront": "ID card · portrait side",
    "idCardBack": "ID card · emblem side",
    "notUploaded": "Not uploaded",
    "preview": "Preview",
    "upload": "Upload",
    "reupload": "Re-upload",
    "incomplete": "Incomplete",
    "incompleteGuide": 'Incomplete: click "Edit" to fill in your ID number and ID images, then submit for review.',
    "invalidIdCard": "Invalid ID number: must be 18 digits (last may be X) with a valid check digit",
    "invalidEmail": "Invalid email format",
    "invalidPhone": "Invalid phone number (11 digits, starts with 1)",
    "verifiedAt": "Verified on",
    "securityGroup": "Account Security",
    "securityHint": "Phone / password / third-party accounts",
    "password": "Password",
    "passwordMask": "••••••••",
    "changePhone": "Change phone",
    "currentPhone": "Current number",
    "newPhone": "New phone number",
    "phoneUpdated": "Phone number updated",
    "phoneUpdateFailed": "Failed to update phone number",
    "changePassword": "Change password",
    "oldPassword": "Current password",
    "newPassword": "New password",
    "confirmPassword": "Confirm new password",
    "oldPasswordRequired": "Please enter your current password",
    "pwdTooShort": "New password must be at least 6 characters",
    "pwdMismatch": "The two new passwords do not match",
    "pwdSuccess": "Password changed. Use the new password next time you sign in",
    "pwdFailed": "Current password is incorrect",
    "wechat": "WeChat",
    "qq": "QQ",
    "alipay": "Alipay",
    "bound": "Linked",
    "unbound": "Not linked",
    "bind": "Link",
    "unbind": "Unlink",
    "comingSoon": "Coming soon",
    "imageSelected": "ID image selected — click Save to apply",
    "uploadFailed": "Failed to upload ID image",
    "maskedHint": "Phone is masked (not your own account or account is abnormal)",
    "saveSuccess": "Profile saved",
}


def eol_of(text: str) -> str:
    crlf = text.count('\r\n')
    return '\r\n' if crlf > text.count('\n') - crlf else '\n'


def read_raw(p: str) -> str:
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def write_raw(p: str, s: str) -> None:
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def key_of(line: str):
    m = KEY_RE.match(line)
    return m.group(1) if m else None


def sync_line_based(path: str, keys: dict) -> int:
    """运营端 web-common.json：文本级维护（保格式 + 保行尾）。"""
    raw = read_raw(path)
    eol = eol_of(raw)
    lines = raw.split(eol)

    # 1) 清理误插入到其他对象（如 userCenter.overview）的键
    while True:
        idx = next((i for i, l in enumerate(lines) if key_of(l) == 'identityGroup'), None)
        if idx is None:
            break
        j = idx
        while j < len(lines) and key_of(lines[j]) in keys:
            j += 1
        prev = lines[idx - 1].rstrip()
        if prev.endswith(','):
            prev = prev[:-1]
        lines = lines[: idx - 1] + [prev] + lines[j:]

    # 2) 定位 userCenter.account 对象并补齐缺失键
    u = next(i for i, l in enumerate(lines) if key_of(l) == 'userCenter')
    a = next(
        i
        for i in range(u, len(lines))
        if key_of(lines[i]) == 'account' and lines[i].rstrip().endswith('{')
    )
    close = next(i for i in range(a + 1, len(lines)) if lines[i].strip() in ('}', '},'))
    existing = {key_of(l) for l in lines[a + 1 : close]}
    missing = [k for k in keys if k not in existing]
    if not missing:
        return 0
    indent = ' ' * (len(lines[a]) - len(lines[a].lstrip()) + 2)
    prev = lines[close - 1].rstrip()
    if not prev.endswith(','):
        prev += ','
    # 末个成员不带逗号（JSON 禁止尾随逗号），成员之间以 ',' 分隔
    members = ['%s"%s": %s' % (indent, k, json.dumps(keys[k], ensure_ascii=False)) for k in missing]
    new = (',' + eol).join(members).split(eol)
    lines = lines[: close - 1] + [prev] + new + lines[close:]
    write_raw(path, eol.join(lines))
    return len(missing)


def sync_json(path: str, keys: dict) -> int:
    """web 端 locales：JSON 往返无损（已验证 identical），整体重写。"""
    raw = read_raw(path)
    eol = eol_of(raw)
    data = json.loads(raw)
    acc = data['userCenter']['account']
    missing = [k for k in keys if k not in acc]
    if not missing:
        return 0
    acc.update({k: keys[k] for k in missing})
    out = json.dumps(data, indent=2, ensure_ascii=False).replace('\n', eol)
    if raw.endswith(('\n', '\r')):
        out += eol
    write_raw(path, out)
    return len(missing)


targets = [
    ('apps/web/src/i18n/locales/zh-CN/common.json', ZH, sync_json),
    ('apps/web/src/i18n/locales/en/common.json', EN, sync_json),
    ('apps/admin/src/i18n/locales/zh-CN/web-common.json', ZH, sync_line_based),
    ('apps/admin/src/i18n/locales/en/web-common.json', EN, sync_line_based),
]

if __name__ == '__main__':
    for path, keys, fn in targets:
        n = fn(os.path.join(ROOT, path), keys)
        print('%-62s +%d' % (path, n))
    for path, keys, _ in targets:
        d = json.loads(read_raw(os.path.join(ROOT, path)))
        acc = d['userCenter']['account']
        miss = [k for k in keys if k not in acc]
        print('%-62s keys=%d missing=%s' % (path, len(acc), miss))
