
import React from 'react';
import type { Editor } from '@tiptap/react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Undo, 
  Redo 
} from 'lucide-react';

interface MenuBarProps {
  editor: Editor | null;
}

const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const setLink = () => {
    if (editor.state.selection.empty) {
      alert('Por favor, selecione um texto para aplicar o link.');
      editor.chain().focus().run();
      return;
    }
    const url = window.prompt('Digite a URL:');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const getButtonClass = (isActive: boolean) =>
    `inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
      isActive
        ? 'bg-tcepr-700 text-white shadow-2xs border border-tcepr-800'
        : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border border-slate-300 border-b-0 rounded-t-xl text-slate-700 select-none">
      {/* Text styles */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={getButtonClass(editor.isActive('bold'))}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only text-[11px]">N</span>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={getButtonClass(editor.isActive('italic'))}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only text-[11px]">I</span>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={getButtonClass(editor.isActive('underline'))}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only text-[11px]">S</span>
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Headings */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 1 }))}
        title="Título Principal"
      >
        <Heading1 className="h-3.5 w-3.5" />
        <span className="text-[11px]">T1</span>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 2 }))}
        title="Subtítulo"
      >
        <Heading2 className="h-3.5 w-3.5" />
        <span className="text-[11px]">T2</span>
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Lists */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={getButtonClass(editor.isActive('bulletList'))}
        title="Lista de Marcadores (•)"
      >
        <List className="h-3.5 w-3.5" />
        <span className="text-[11px]">Marcadores</span>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={getButtonClass(editor.isActive('orderedList'))}
        title="Lista Numerada (1, 2, 3)"
      >
        <ListOrdered className="h-3.5 w-3.5" />
        <span className="text-[11px]">Numerada</span>
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Blockquote & Link */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={getButtonClass(editor.isActive('blockquote'))}
        title="Citação em Bloco"
      >
        <Quote className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-[11px]">Citar</span>
      </button>

      <button
        type="button"
        onClick={setLink}
        className={getButtonClass(editor.isActive('link'))}
        title="Inserir Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-[11px]">Link</span>
      </button>

      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Undo & Redo */}
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="inline-flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 bg-white"
        title="Desfazer (Ctrl+Z)"
      >
        <Undo className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="inline-flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed border border-slate-200 bg-white"
        title="Refazer (Ctrl+Y)"
      >
        <Redo className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default MenuBar;

