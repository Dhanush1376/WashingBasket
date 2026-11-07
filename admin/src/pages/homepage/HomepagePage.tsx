import { useState } from 'react';

import { Tag } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { MiniSwitch } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { Skeleton } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/lib/query';
import { homepageApi } from '@/services';
import type { HomepageContent } from '@/types';
import { BookingEditor, PerksEditor } from './ContentEditors';
import { HomePreview } from './HomePreview';

export default function HomepagePage() {
  const home = useQuery('homepage', homepageApi.getHomepage);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="page">
      <PageHeader
        icon="layout"
        title="Home page"
        description="Control the sections and content visible in the customer app."
        actions={
          <Button className="show-mobile" icon="phoneDevice" onClick={() => setShowPreview((s) => !s)} aria-expanded={showPreview}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        }
      />
      <QueryView
        query={home}
        skeleton={
          <div className="home-split">
            <Skeleton height={520} radius={20} />
            <Skeleton height={640} radius={36} />
          </div>
        }
      >
        {(h) => (
          <div className={`home-split${showPreview ? ' home-split--preview' : ''}`}>
            <div className="stack">
              <SectionsCard home={h} />
              <BookingEditor home={h} />
              <PerksEditor home={h} />
            </div>
            <aside className="home-split__preview" aria-label="Live preview of the customer home page">
              <div className="sticky-preview">
                <p className="editor-preview__label">
                  <Icon name="eye" size={15} /> Live preview · sample customer
                </p>
                <HomePreview home={h} />
              </div>
            </aside>
          </div>
        )}
      </QueryView>
    </div>
  );
}

function SectionsCard({ home }: { home: HomepageContent }) {
  const { run, isBusy } = useAction();
  const movable = home.sections.filter((s) => !s.fixed);
  return (
    <Card>
      <CardHeader title="Sections and order" hint="Top to bottom, as on the phone. The greeting and summary always stay at the top." icon="list" />
      <ol className="section-list">
        {home.sections.map((s) => {
          const idx = movable.findIndex((m) => m.id === s.id);
          return (
            <li key={s.id} className={`section-row${s.visible ? '' : ' section-row--off'}`}>
              <span className="section-row__grip" aria-hidden>
                <Icon name={s.fixed ? 'lock' : 'dragHandle'} size={16} />
              </span>
              <span className="grow">
                <span className="row row--wrap">
                  <strong>{s.name}</strong>
                  {s.fixed ? <Tag>Always shown</Tag> : !s.visible ? <Tag tone="orange">Hidden</Tag> : null}
                </span>
                <span className="muted small block">{s.description}</span>
              </span>
              {!s.fixed ? (
                <span className="section-row__controls">
                  <IconButton icon="arrowUp" label={`Move ${s.name} up`} size={34} disabled={idx <= 0 || isBusy('move')} onClick={() => run('move', () => homepageApi.moveSection(s.id, -1), `${s.name} moved up`)} />
                  <IconButton icon="arrowDown" label={`Move ${s.name} down`} size={34} disabled={idx === movable.length - 1 || isBusy('move')} onClick={() => run('move', () => homepageApi.moveSection(s.id, 1), `${s.name} moved down`)} />
                  <MiniSwitch
                    checked={s.visible}
                    label={s.visible ? `Hide ${s.name}` : `Show ${s.name}`}
                    onChange={(v) => run(`vis-${s.id}`, () => homepageApi.setSectionVisible(s.id, v), v ? `${s.name} is shown` : `${s.name} is hidden`)}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
