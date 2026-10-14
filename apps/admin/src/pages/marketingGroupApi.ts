import { apiGet, apiPost, apiDelete } from './user/invitationShared';

export type MemberType = 'CLIENT' | 'GUEST_LIST' | 'BATCH_PROJECT';

export interface MarketingGroup {
  id: string;
  name: string;
  description?: string;
  scene?: string;
  sortOrder: number;
  memberCount: number;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  memberType: MemberType;
  memberId: string;
  label?: string;
  sortOrder: number;
}

export interface Candidate {
  id: string;
  label: string;
}

/** 把监督态 subject 拼到 query（与 invitationShared 的 useSubjectScope.q 同口径） */
function withSubj(path: string, subject?: string) {
  return subject ? `${path}${path.includes('?') ? '&' : '?'}subject=${encodeURIComponent(subject)}` : path;
}

export const listGroups = (subject?: string) =>
  apiGet<MarketingGroup[]>(withSubj('/marketing-groups', subject));

export const getGroup = (id: string, subject?: string) =>
  apiGet<{
    id: string;
    name: string;
    description?: string;
    scene?: string;
    sortOrder: number;
    memberCount: number;
    updatedAt: string;
    members: GroupMember[];
  }>(withSubj(`/marketing-groups/${id}`, subject));

export const createGroup = (body: Partial<MarketingGroup>, subject?: string) =>
  apiPost<MarketingGroup>('/marketing-groups', { ...body, ...(subject ? { subject } : {}) });

export const updateGroup = (id: string, body: Partial<MarketingGroup>, subject?: string) =>
  apiPost<MarketingGroup>(`/marketing-groups/${id}`, { ...body, ...(subject ? { subject } : {}) });

export const deleteGroup = (id: string, subject?: string) =>
  apiDelete<{ ok: boolean }>(`/marketing-groups/${id}`, subject ? { subject } : {});

export const addMembers = (
  id: string,
  members: { memberType: MemberType; memberId: string }[],
  subject?: string,
) =>
  apiPost<{ count: number }>(`/marketing-groups/${id}/members`, {
    members,
    ...(subject ? { subject } : {}),
  });

export const removeMembers = (id: string, memberIds: string[], subject?: string) =>
  apiDelete<{ count: number }>(`/marketing-groups/${id}/members`, {
    memberIds,
    ...(subject ? { subject } : {}),
  });

export const listCandidates = (memberType: MemberType, subject?: string) =>
  apiGet<Candidate[]>(withSubj(`/marketing-groups/candidates?memberType=${memberType}`, subject));
