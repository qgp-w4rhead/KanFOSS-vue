import type { CategoryId } from '../../domain/types.ts';

export interface Destination {
  id: CategoryId;
  title: string;
}

export interface DropRejection {
  categoryId: CategoryId;
  reason: string;
}
