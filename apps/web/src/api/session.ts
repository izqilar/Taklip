/**
 * 会话存储层 —— 登录令牌与本地用户快照的唯一读写口。
 *
 * 从 api/client.ts 抽出，目的是让「身份漂移守卫」（store/identityDrift.ts）能在
 * **不反向依赖 client.ts** 的情况下读取/清理登录态 —— client.ts 需要在响应拦截层
 * 调用漂移守卫，若守卫再 import client 就形成循环依赖（ESM 下会拿到未初始化的绑定）。
 */

import type { UserInfo } from './client';

export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_INFO_KEY = 'user_info';

/** 获取当前 access token（跨端桥接时携带登录态使用） */
export function getToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** getToken 的历史别名，语义为「本地已存的 access token」（跨端桥接处使用） */
export const getStoredToken = getToken;

/** 存储 token 到 localStorage */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** 清除 token */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** 从 localStorage 获取 refresh token */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** 获取当前用户信息（从 localStorage） */
export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserInfo): void {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}

/**
 * 清理本端全部登录态与角色/资质缓存快照。
 * 资质漂移、登出、以及任何「需要重新登录」的场景都应走这里，保证口径一致。
 */
export function clearSession(): void {
  clearTokens();
  localStorage.removeItem(USER_INFO_KEY);
}
