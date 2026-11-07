import type { HomepageContent, HomePerk, HomeSectionId } from '@/types';
import { db, nextId, respond } from './db';

export function getHomepage(): Promise<HomepageContent> {
  return respond(db.homepage, 'homepage');
}

type Editable = Pick<HomepageContent, 'booking' | 'promo' | 'emptyOrder' | 'tagline'>;

/** SIMULATED: saves the home page text in the sample data. */
export function updateHomepageContent(patch: Partial<Editable>): Promise<HomepageContent> {
  Object.assign(db.homepage, patch);
  return respond(db.homepage, '', 450);
}

/** SIMULATED */
export function setSectionVisible(id: HomeSectionId, visible: boolean): Promise<HomepageContent> {
  const s = db.homepage.sections.find((x) => x.id === id);
  if (s && !s.fixed) s.visible = visible;
  return respond(db.homepage, '', 250);
}

/** SIMULATED: moves a section up or down. The greeting and summary always stay on top. */
export function moveSection(id: HomeSectionId, direction: -1 | 1): Promise<HomepageContent> {
  const list = db.homepage.sections;
  const i = list.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length && !list[i].fixed && !list[j].fixed) {
    [list[i], list[j]] = [list[j], list[i]];
  }
  return respond(db.homepage, '', 250);
}

/** SIMULATED: the three short promises under the summary. */
export function savePerks(perks: (Omit<HomePerk, 'id'> & { id?: string })[]): Promise<HomepageContent> {
  const next: HomePerk[] = [];
  perks.forEach((p) => {
    const id = p.id || nextId([...next, ...db.homepage.perks].map((x) => x.id), 'pk-');
    next.push({ ...p, id, label: p.label.trim() });
  });
  db.homepage.perks = next;
  return respond(db.homepage, '', 400);
}
