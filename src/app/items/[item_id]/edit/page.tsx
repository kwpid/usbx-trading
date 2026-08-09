import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { requireEditor } from "@/lib/roles";
import EditItemForm from "./EditItemForm";

export default async function EditItemPage(props: { params: Promise<{ item_id: string }> }) {
  const editor = await requireEditor();
  if (!editor) {
    return (
      <div className="card" style={{ padding: '2rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center' }}>
        <p>Editors only.</p>
      </div>
    );
  }

  const params = await props.params;
  const itemId = params.item_id;

  const { data: item, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error || !item) {
    notFound();
  }

  return (
    <div className="container" style={{ maxWidth: '800px', paddingTop: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Edit Item: {item.name}</h1>
      <EditItemForm item={item} canEditBasic={editor.role === 'admin'} />
    </div>
  );
}
