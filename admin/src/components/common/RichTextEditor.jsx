import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const MODULES = {
  toolbar: [
    [{ header: [2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link', 'image'],
    [{ align: [] }],
    ['clean'],
  ],
};

export default function RichTextEditor({ value, onChange, placeholder }) {
  return (
    <div className="rounded-sm border border-night-900/15 bg-white">
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={MODULES}
        placeholder={placeholder}
      />
    </div>
  );
}
