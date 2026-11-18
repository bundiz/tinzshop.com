'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useContext, useState } from 'react';

import EmbedResizeHandle, { BodyLockedContext, embedFrameStyle, embedWidthOf } from './EmbedResizeHandle';

/** Whether the node at `pos` sits directly in the document: a video in a figure, list item or quote does not. */
function atTopLevel(editor: ReactNodeViewProps['editor'], pos: number | undefined): boolean {
  if (pos === undefined) return false;
  try {
    return editor.state.doc.resolve(pos).depth === 0;
  } catch {
    return false;
  }
}

/**
 * The YouTube video node in the editor (D-273): the stored iframe, in a frame drawn at the video's width and centred,
 * keeping 16:9 (the writing area's `[&_iframe]` rule). A video at the top level of the body carries the corner resize
 * handle (`EmbedResizeHandle`); one inside a figure is drawn full width with none, and keeps its stored attributes. A
 * locked body offers no handle. The saved HTML comes from the node's `renderHTML`, never from this view.
 */
export default function YoutubeView({ node, selected, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('admin.news.editor');
  const locked = useContext(BodyLockedContext);
  const topLevel = atTopLevel(editor, getPos());
  const stored = topLevel ? embedWidthOf(node.attrs.width) : 100;
  const [draft, setDraft] = useState<number | null>(null);
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';

  return (
    <NodeViewWrapper
      data-drag-handle=""
      style={embedFrameStyle(draft ?? stored)}
      className={`group/embed relative rounded-md ${selected ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
    >
      <iframe src={src} allowFullScreen={node.attrs.fullscreen === true} className="block" />
      {topLevel && editor.isEditable && !locked ? (
        <EmbedResizeHandle
          label={t('resize.video')}
          width={stored}
          selected={selected}
          onDraft={setDraft}
          onCommit={(width) => {
            if (editor.isEditable) updateAttributes({ width: width < 100 ? width : null });
          }}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
