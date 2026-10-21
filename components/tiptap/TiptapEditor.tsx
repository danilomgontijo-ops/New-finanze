
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import MenuBar from './MenuBar';
import FontSize from './FontSize';

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    minHeightClass?: string;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, minHeightClass = 'min-h-[160px]' }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            FontSize,
            Link.configure({ openOnClick: false, autolink: true }),
            Image,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `focus:outline-none p-3.5 sm:p-4 bg-white text-slate-800 placeholder:text-slate-400 font-sans text-xs sm:text-sm leading-relaxed ${minHeightClass}`,
            },
        },
    });

    React.useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    return (
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <MenuBar editor={editor} />
            <div className="bg-white text-slate-800">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default TiptapEditor;
