'use client';

import { useTranslations } from 'next-intl';
import { useState, type KeyboardEvent } from 'react';

export type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

/** A tag as the service stores it: runs of whitespace become one space and the ends are trimmed. */
const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * The tags field (the mockup's `.tagin`): one chip per tag with a remove button, and a box where Enter or a comma adds
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
    <div className="flex flex-wrap items-center gap-1.5 rounded-sm border-[1.5px] border-line-2 bg-surface p-2">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-sm font-medium text-brand-dark">
          {tag}
          <input type="hidden" name="tag" value={tag} />
          <button
            type="button"
            aria-label={t('tagRemove', { name: tag })}
            onClick={() => onChange(tags.filter((entry) => entry !== tag))}
            className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-white"
          >
            <span aria-hidden="true">×</span>
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
        className="min-h-9 min-w-[140px] flex-1 bg-transparent px-1 text-ink outline-none"
      />
    </div>
  );
}
