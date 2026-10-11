import type { DragSource, DropTarget, Zone } from '../domain/drop.ts';

export const DROP_ATTRIBUTE = 'data-drop';

export interface InsertionCandidate {
  target: DropTarget;
  element: Element;
}

export const attributeOf = (element: Element): string => element.getAttribute(DROP_ATTRIBUTE) ?? '';

export const idOf = (element: Element): string => attributeOf(element).split(':').slice(1).join(':');

const isKind = (element: Element, kind: string): boolean => attributeOf(element).startsWith(`${kind}:`);

export const isWithinCategory = (element: Element, categoryId: string): boolean => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (attributeOf(node) === `category:${categoryId}`) return true;
  }
  return false;
};

const boardRootOf = (element: Element): Element => {
  let lanes: Element | null = null;
  let top = element;
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (attributeOf(node) === 'lanes') lanes = node;
    top = node;
  }
  return lanes ?? top;
};

const sourcePanelOf = (anchor: Element, sourceId: string): Element | null => {
  const root = boardRootOf(anchor);
  const wanted = `category:${sourceId}`;
  const scope = [root, ...Array.from(root.querySelectorAll(`[${DROP_ATTRIBUTE}]`))];
  return scope.find((element) => attributeOf(element) === wanted) ?? null;
};

const parentCategoryOf = (element: Element): string | null => {
  const parent = element.parentElement;
  return parent && isKind(parent, 'category') ? idOf(parent) : null;
};

const siblingsOf = (element: Element, kind: string): Element[] =>
  Array.from(element.parentElement?.children ?? []).filter((child) => isKind(child, kind));

const isBlocked = (target: DropTarget, anchor: Element, source: DragSource | undefined): boolean => {
  if (!source) return false;
  if (source.kind === 'card') return target.kind === 'card' && target.cardId === source.cardId;
  if (target.kind === 'category') {
    if (target.categoryId === source.categoryId || isWithinCategory(anchor, source.categoryId)) return true;
    const sourcePanel = sourcePanelOf(anchor, source.categoryId);
    if (target.zone === 'center') {
      return sourcePanel !== null && parentCategoryOf(sourcePanel) === target.categoryId;
    }
    if (sourcePanel === null) return false;
    const sibling = target.zone === 'after' ? anchor.nextElementSibling : anchor.previousElementSibling;
    return sibling === sourcePanel;
  }
  return target.kind === 'card' && isWithinCategory(anchor, source.categoryId);
};

const promotedOwner = (anchor: Element, source: DragSource | undefined): Element => {
  if (source?.kind !== 'category' || parentCategoryOf(anchor) === null) return anchor;
  const sourcePanel = sourcePanelOf(anchor, source.categoryId);
  return sourcePanel && parentCategoryOf(sourcePanel) !== parentCategoryOf(anchor) ? (anchor.parentElement ?? anchor) : anchor;
};

const normalizeCategory = (categoryId: string, zone: Zone, anchor: Element, source: DragSource | undefined): DropTarget | null => {
  const owner = promotedOwner(anchor, source);
  const group = siblingsOf(owner, 'category');
  const at = group.indexOf(owner);
  const ownerId = owner === anchor ? categoryId : idOf(owner);
  if (zone === 'after' || at <= 0) return { kind: 'category', categoryId: ownerId, zone };
  const previous = idOf(group[at - 1]);
  return source?.kind === 'category' && source.categoryId === previous
    ? null
    : { kind: 'category', categoryId: previous, zone: 'after' };
};

export const areSiblingSubcategories = (anchor: Element, source?: DragSource): boolean => {
  if (source?.kind !== 'category') return false;
  const targetParent = parentCategoryOf(anchor);
  if (targetParent === null) return false;
  const sourcePanel = sourcePanelOf(anchor, source.categoryId);
  return sourcePanel !== null && parentCategoryOf(sourcePanel) === targetParent;
};

export const normalizeInsertionTarget = (
  target: DropTarget,
  anchor: Element,
  source?: DragSource,
): DropTarget | null => {
  if (isBlocked(target, anchor, source)) return null;
  if (target.kind === 'category' && source?.kind !== 'card') {
    if (target.zone === 'center') {
      const owner = promotedOwner(anchor, source);
      return { kind: 'category', categoryId: owner === anchor ? target.categoryId : idOf(owner), zone: 'center' };
    }
    if (!areSiblingSubcategories(anchor, source)) return normalizeCategory(target.categoryId, target.zone, anchor, source);
  }
  return target;
};
