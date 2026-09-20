/**
 * 视察窗口 subject 存储：ADMIN 在服务商/代理商/用户视角下选中的「被视察对象」id。
 * layerContext 的 setObjectScope 会同步写入此处；dataProvider 在使用 ADMIN 令牌请求
 * provider/* 与 wallet/* 端点时读取并追加 ?subject=<id>，使总台视察窗口看到的数据
 * 与被视察账号登录后看到的数据严格一致。
 */
let _subject: string | null = null;

export function setSubject(id: string | null): void {
  _subject = id;
}

export function getSubject(): string | null {
  return _subject;
}
