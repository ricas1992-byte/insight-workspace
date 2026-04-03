import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection as FlowConnection,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Save, Network } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "#d97706",
  active: "#059669",
  archived: "#9ca3af",
};

type InsightNodeData = {
  label: string;
  insightId: number;
  status: string;
  preview: string;
  tags: string[];
};

function InsightNode({ data }: { data: InsightNodeData } & Partial<NodeProps>) {
  const [, setLocation] = useLocation();
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 min-w-[190px] max-w-[260px] shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer"
      onDoubleClick={() => setLocation(`/editor/${data.insightId}`)}
    >
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: statusColors[data.status] || "#9ca3af" }}
        />
        <span className="text-xs font-semibold text-gray-800 truncate">{data.label}</span>
      </div>
      {data.preview && (
        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed mb-2">
          {data.preview}
        </p>
      )}
      {data.tags && data.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {data.tags.slice(0, 2).map((tag: string, i: number) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded-md text-gray-500">
              {tag}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-white" />
    </div>
  );
}

const nodeTypes = { insight: InsightNode };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const insightsQuery = trpc.insights.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const connectionsQuery = trpc.connections.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const createConnectionMutation = trpc.connections.create.useMutation({
    onSuccess: () => connectionsQuery.refetch(),
  });
  const deleteConnectionMutation = trpc.connections.delete.useMutation({
    onSuccess: () => connectionsQuery.refetch(),
  });
  const bulkUpdateMutation = trpc.insights.bulkUpdatePositions.useMutation({
    onSuccess: () => {
      toast.success("מיקומים נשמרו");
      setHasChanges(false);
    },
  });

  useEffect(() => {
    if (!insightsQuery.data) return;
    const COLS = 4;
    const GAP_X = 300;
    const GAP_Y = 200;

    const newNodes: Node[] = insightsQuery.data.map((insight, index) => ({
      id: `insight-${insight.id}`,
      type: "insight",
      position: {
        x: insight.positionX ?? (index % COLS) * GAP_X + 50,
        y: insight.positionY ?? Math.floor(index / COLS) * GAP_Y + 50,
      },
      data: {
        label: insight.title,
        insightId: insight.id,
        status: insight.status,
        preview: insight.content?.replace(/[#*_`]/g, "").substring(0, 100) || "",
        tags: insight.tags?.map((t: any) => t.name) || [],
      },
    }));
    setNodes(newNodes);
  }, [insightsQuery.data]);

  useEffect(() => {
    if (!connectionsQuery.data) return;
    const newEdges: Edge[] = connectionsQuery.data.map((conn) => ({
      id: `conn-${conn.id}`,
      source: `insight-${conn.sourceInsightId}`,
      target: `insight-${conn.targetInsightId}`,
      label: conn.label || "",
      style: { stroke: "#0d9488", strokeWidth: 2 },
      labelStyle: { fill: "#6b7280", fontSize: 11, fontFamily: "Rubik, sans-serif" },
      animated: true,
      data: { connectionId: conn.id },
    }));
    setEdges(newEdges);
  }, [connectionsQuery.data]);

  const onConnect = useCallback(
    (connection: FlowConnection) => {
      const sourceId = parseInt(connection.source?.replace("insight-", "") || "0");
      const targetId = parseInt(connection.target?.replace("insight-", "") || "0");
      if (sourceId && targetId) {
        createConnectionMutation.mutate({ sourceInsightId: sourceId, targetInsightId: targetId });
        setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#0d9488", strokeWidth: 2 } }, eds));
      }
    },
    [createConnectionMutation]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        const connId = edge.data?.connectionId;
        if (connId) deleteConnectionMutation.mutate({ id: connId as number });
      });
    },
    [deleteConnectionMutation]
  );

  const onNodeDragStop = useCallback(() => {
    setHasChanges(true);
  }, []);

  const handleSavePositions = () => {
    const positions = nodes.map((node) => ({
      id: parseInt(node.id.replace("insight-", "")),
      positionX: Math.round(node.position.x),
      positionY: Math.round(node.position.y),
    }));
    bulkUpdateMutation.mutate(positions);
  };

  if (insightsQuery.isLoading || connectionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
      </div>
    );
  }

  if (!insightsQuery.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center">
        <div className="h-20 w-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-5">
          <Network className="h-10 w-10 text-primary/30" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          הקנבס ריק
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          צור תובנות כדי לראות אותן כאן ולחבר ביניהן
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">קנבס קשרים</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            גרור תובנות, חבר ביניהן, ולחץ פעמיים לעריכה
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSavePositions}
          disabled={!hasChanges || bulkUpdateMutation.isPending}
          className="gap-1 rounded-xl"
        >
          {bulkUpdateMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          שמור מיקומים
        </Button>
      </div>
      <div className="flex-1 rounded-xl border border-border overflow-hidden bg-white" dir="ltr">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "#fafaf8" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e5e5e0" />
          <Controls
            position="bottom-left"
            style={{
              background: "white",
              border: "1px solid #e5e5e0",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          />
          <MiniMap
            nodeColor={() => "#0d9488"}
            maskColor="rgba(250,250,248,0.8)"
            style={{
              background: "white",
              border: "1px solid #e5e5e0",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
