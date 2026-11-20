'use client';

import { NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useContext, useState } from 'react';

import { IMAGE_ALIGN_LEFT, MAX_EMBED_WIDTH } from '@/server/adapters/wordpress/sanitize';
import EmbedResizeHandle, { BodyLockedContext, embedWidthOf } from './EmbedResizeHandle';

/**
 * Whether the inline image at `pos` is the only thing in a paragraph at the top level of the body (D-283): the one place
 * an uploaded picture can be resized, fills the column at 100% (D-285) and can be aligned (D-286).
 */
export function aloneInTopLevelParagraph(editor: Pick<ReactNodeViewProps['editor'], 'state'>, pos: number | undefined): boolean {
  if (pos === undefined) return false;
  try {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.depth === 1 && $pos.parent.type.name === 'paragraph' && $pos.parent.childCount === 1;
  } catch {
    return false;
  }
}

const paragraphOf = (handle: HTMLElement) => handle.closest('p');

/** A left picture's gap to the text beside and below it, as the admin mockup's `.ed-fig[data-align=left]` (D-286). */
const LEFT_MARGINS = { marginTop: '6px', marginRight: '24px', marginBottom: '12px' };

/**
 * An uploaded picture in the editor (plan 017, D-277; D-283, D-285, D-286): drawn from `{MEDIA_PUBLIC_BASE_URL}/{key}`
 * (never saved; with no base URL it shows no picture). When it stands alone in a top-level paragraph, as the image button
 * inserts it, it is drawn as wide as the column at 100% and centred at its width below that, its height following
 * (`w-full h-auto` in the frame); aligned left (`embedAlign`) it floats left at its width with a gap, so the text of the
 * following paragraphs wraps beside it. There, when the body is editable, it carries the corner resize handle
 * (`EmbedResizeHandle`, measured against the paragraph); resizing to 100% also centres it again, since a full-width
 * float has no text beside it. Anywhere else it is drawn at its own size up to the column, as an imported picture is.
 * Whether it stands alone is re-checked on every transaction, since typing beside it does not redraw the view. An
 * imported picture (no key) keeps the plain view in `editor-extensions.ts`.
 */
export default function ImageView({ node, selected, editor, getPos, extension, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('admin.news.editor');
  const locked = useContext(BodyLockedContext);
  // Subscribed for the redraw on every transaction; read again here, since the first selection can run before the view
  // has a position.
  useEditorState({ editor, selector: ({ editor: current }) => aloneInTopLevelParagraph(current, getPos()) });
  const alone = aloneInTopLevelParagraph(editor, getPos());
  const resizable = alone && editor.isEditable && !locked;
  const stored = alone ? embedWidthOf(node.attrs.embedWidth) : MAX_EMBED_WIDTH;
  const left = alone && node.attrs.embedAlign === IMAGE_ALIGN_LEFT;
  const [draft, setDraft] = useState<number | null>(null);
  const width = draft ?? stored;
  const key = typeof node.attrs.mediaKey === 'string' ? node.attrs.mediaKey : null;
  const base = (extension.options as { mediaBaseUrl?: string | null }).mediaBaseUrl ?? null;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : undefined;
  const style = left
    ? { display: 'block', float: 'left' as const, width: `${width}%`, ...LEFT_MARGINS }
    : alone && width < MAX_EMBED_WIDTH
      ? { display: 'block', width: `${width}%`, marginInline: 'auto' }
      : undefined;

  return (
    <NodeViewWrapper
      as="span"
      data-drag-handle=""
      style={style}
      className={`group/embed relative max-w-full ${alone ? 'block w-full' : 'inline-block align-bottom'} ${selected ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
    >
      <img
        data-media-key={key ?? undefined}
        src={key !== null && base !== null ? `${base}/${key}` : undefined}
        alt={alt}
        className={alone ? 'block h-auto w-full' : undefined}
      />
      {resizable ? (
        <EmbedResizeHandle
          label={t('resize.image')}
          width={stored}
          selected={selected}
          columnOf={paragraphOf}
          onDraft={setDraft}
          onCommit={(next) => {
            if (!editor.isEditable) return;
            updateAttributes(next < MAX_EMBED_WIDTH ? { embedWidth: next } : { embedWidth: null, embedAlign: null });
          }}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
