'use client';

import { NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useContext, useState } from 'react';

import EmbedResizeHandle, { BodyLockedContext, embedWidthOf } from './EmbedResizeHandle';

/** Whether the inline image at `pos` is the only thing in a paragraph at the top level of the body (D-283). */
function aloneInTopLevelParagraph(editor: ReactNodeViewProps['editor'], pos: number | undefined): boolean {
  if (pos === undefined) return false;
  try {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.depth === 1 && $pos.parent.type.name === 'paragraph' && $pos.parent.childCount === 1;
  } catch {
    return false;
  }
}

const paragraphOf = (handle: HTMLElement) => handle.closest('p');

/**
 * An uploaded picture in the editor (plan 017, D-277; D-283): drawn from `{MEDIA_PUBLIC_BASE_URL}/{key}` (never saved; with
 * no base URL it shows no picture). When it stands alone in a top-level paragraph, as the image button inserts it, and the
 * body is editable, it carries the corner resize handle (`EmbedResizeHandle`, measured against the paragraph): at a width
 * under 100% it is drawn centred at that width with its height following (`w-full h-auto` in the frame); at 100% it is
 * drawn at its own size up to the column, as before. Whether it stands alone is re-checked on every transaction, since
 * typing beside it does not redraw the view. An imported picture (no key) keeps the plain view in `editor-extensions.ts`.
 */
export default function ImageView({ node, selected, editor, getPos, extension, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('admin.news.editor');
  const locked = useContext(BodyLockedContext);
  // Subscribed for the redraw on every transaction; read again here, since the first selection can run before the view
  // has a position.
  useEditorState({ editor, selector: ({ editor: current }) => aloneInTopLevelParagraph(current, getPos()) });
  const alone = aloneInTopLevelParagraph(editor, getPos());
  const resizable = alone && editor.isEditable && !locked;
  const stored = alone ? embedWidthOf(node.attrs.embedWidth) : 100;
  const [draft, setDraft] = useState<number | null>(null);
  const width = draft ?? stored;
  const key = typeof node.attrs.mediaKey === 'string' ? node.attrs.mediaKey : null;
  const base = (extension.options as { mediaBaseUrl?: string | null }).mediaBaseUrl ?? null;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : undefined;
  const sized = width < 100;

  return (
    <NodeViewWrapper
      as="span"
      data-drag-handle=""
      style={sized ? { display: 'block', width: `${width}%`, marginInline: 'auto' } : undefined}
      className={`group/embed relative max-w-full ${sized ? '' : 'inline-block align-bottom'} ${selected ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
    >
      <img
        data-media-key={key ?? undefined}
        src={key !== null && base !== null ? `${base}/${key}` : undefined}
        alt={alt}
        className={sized ? 'block h-auto w-full' : undefined}
      />
      {resizable ? (
        <EmbedResizeHandle
          label={t('resize.image')}
          width={stored}
          selected={selected}
          columnOf={paragraphOf}
          onDraft={setDraft}
          onCommit={(next) => {
            if (editor.isEditable) updateAttributes({ embedWidth: next < 100 ? next : null });
          }}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
