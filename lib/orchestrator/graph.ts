export type Node = { id:string; label:string; provider:string; };
export type Edge = { from:string; to:string; label?:string; };
export function toGraph(results:{provider:string, model:string, text:string}[]){
  const nodes:Node[] = results.map((r,i)=>({
    id: `n${i+1}`,
    label: r.text?.slice(0,140) || "(empty)",
    provider: r.provider
  }));
  const edges:Edge[] = [];
  // 간단 연결: 첫 노드를 root로, 나머지를 연결
  if(nodes.length>0){
    for(let i=1;i<nodes.length;i++){
      edges.push({ from:nodes[0].id, to:nodes[i].id, label:"evidence" });
    }
  }
  return { nodes, edges };
}
