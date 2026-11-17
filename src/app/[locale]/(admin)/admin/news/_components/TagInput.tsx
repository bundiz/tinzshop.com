'use client';

import { useTranslations } from 'next-intl';
import { useState, type KeyboardEvent } from 'react';

import Icon from '@/components/ui/Icon';

export type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

/** A tag as the service stores it: runs of whitespace become one space and the ends are trimmed. */
const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * The tags field (the mockup's `.tagin` and `.tok`, D-257): one 28px grey token per tag with a 22px remove button, and a box where Enter or a comma adds
 * the typed one. Each tag is also a hidden `tag` field, so the form carries them. A tag already there (ignoring case) is
 * not added twice; the server normalises them again.
 */
export default function TagInput({ tags, onChange }: TagInputProps) {
  const t = useTranslations('admin.news.editor');
  const [draft, setDraft] = useState('');

  function add(): void {
    const name = clean(draft);
    setDraft('');
    if (name === '' || tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) return;
    onChange([...tags, name]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter must not submit the whole article.
      event.preventDefault();
      add();
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    // Below `sm` the rows are 16px apart, so each remove button's 44px tap target (D-221) stays clear of the next row's.
    <div className="flex min-h-11 flex-wrap items-center gap-x-1.5 gap-y-4 rounded-sm border-[1.5px] border-line-2 bg-surface px-2 py-[5px] focus-within:border-ink sm:gap-y-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-[6px] bg-sunk pr-1 pl-2.5 text-[13.5px] font-medium text-ink">
          {tag}
          <input type="hidden" name="tag" value={tag} />
          <button
            type="button"
            aria-label={t('tagRemove', { name: tag })}
            onClick={() => onChange(tags.filter((entry) => entry !== tag))}
            className="relative grid size-[22px] cursor-pointer place-items-center rounded-[4px] text-muted transition-colors hover:bg-line hover:text-ink max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[11px]"
          >
            <Icon name="x" className="size-[13px]" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        aria-label={t('tagLabel')}
        placeholder={t('tagPlaceholder')}
        maxLength={100}
        className="min-h-9 min-w-[100px] flex-1 bg-transparent px-1 text-[14.5px] text-ink outline-none sm:min-h-[30px]"
      />
    </div>
  );
}
