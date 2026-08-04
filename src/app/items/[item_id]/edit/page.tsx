import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EditItemForm from "./EditItemForm";

export default async function EditItemPage(props: { params: Promise<{ item_id: string }> }) {
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
      <EditItemForm item={item} />
    </div>
  );
}
