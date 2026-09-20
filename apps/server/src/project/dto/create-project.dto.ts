import type { Project } from '@h5design/core';

export class CreateProjectDto {
  title?: string;
  /** 完整工程 Schema（Project JSON） */
  schema?: Project;
}

export class UpdateProjectDto {
  title?: string;
  cover?: string;
  status?: 'draft' | 'published';
  schema?: Project;
  /** 是否为「手动保存」——为 true 时创建一份版本快照（自动保存不创建） */
  snapshot?: boolean;
}
