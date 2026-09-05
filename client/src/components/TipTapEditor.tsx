'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Node, mergeAttributes } from '@tiptap/core';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Undo, Redo } from 'lucide-react';

const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      class: { default: null },
      'data-element-id': { default: null },
      'data-element-type': { default: null },
      'data-element-label': { default: null },
      'data-custom-replaced': { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return {};
          return {
            class: node.getAttribute('class'),
            'data-element-id': node.getAttribute('data-element-id'),
            'data-element-type': node.getAttribute('data-element-type'),
            'data-element-label': node.getAttribute('data-element-label'),
            'data-custom-replaced': node.getAttribute('data-custom-replaced'),
            style: node.getAttribute('style'),
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes), 0];
  },
});

const Figcaption = Node.create({
  name: 'figcaption',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figcaption',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return {};
          return {
            class: node.getAttribute('class'),
            style: node.getAttribute('style'),
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figcaption', mergeAttributes(HTMLAttributes), 0];
  },
});

const CustomImage = Node.create({
  name: 'customImage',
  group: 'block',
  inline: false,
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      class: { default: null },
      style: { default: null },
      loading: { default: 'lazy' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return {};
          return {
            src: node.getAttribute('src'),
            alt: node.getAttribute('alt'),
            class: node.getAttribute('class'),
            style: node.getAttribute('style'),
            loading: node.getAttribute('loading') || 'lazy',
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },
});

interface TipTapEditorProps {
  content: string;
  onChange?: (html: string) => void;
}

export default function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Figure, Figcaption, CustomImage],
    content: content || '<p>Start drafting your research paper outline or write observations here...</p>',
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden min-h-[400px]">
      {/* Editor Menu Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('bold') ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('italic') ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('bulletList') ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors ${editor.isActive('orderedList') ? 'bg-zinc-800 text-indigo-400' : ''}`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="flex-grow p-4 bg-zinc-950/40 text-zinc-200 min-h-[350px]">
        <EditorContent editor={editor} className="min-h-[350px]" />
      </div>
    </div>
  );
}
