import { useState, useCallback, useEffect, useMemo } from "react";
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
  draft: "#eab308",
  active: "#22c55e",
  archived: "#71717a",
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
      className="bg-card border border-border rounded-lg p-3 min-w-[180px] max-w-[250px] shadow-lg hover:border-primary/50 transition-colors cursor-pointer"
      onDoubleClick={() => setLocation(`/editor/${data.insightId}`)}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: statusColors[data.status] || "#71717a" }}
        />
        <span className="text-xs font-semibold text-foreground truncate">{data.label}</span>
      </div>
      {data.preview && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
          {data.preview}
        </p>
      )}
      {data.tags && data.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {data.tags.slice(0, 2).map((tag: string, i: number) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
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

  // Build nodes from insights
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

  // Build edges from connections
  useEffect(() => {
    if (!connectionsQuery.data) return;
    const newEdges: Edge[] = connectionsQuery.data.map((conn) => ({
      id: `conn-${conn.id}`,
      source: `insight-${conn.sourceInsightId}`,
      target: `insight-${conn.targetInsightId}`,
      label: conn.label || "",
      style: { stroke: "oklch(0.75 0.15 65)", strokeWidth: 2 },
      labelStyle: { fill: "oklch(0.65 0.015 260)", fontSize: 11 },
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
        setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "oklch(0.75 0.15 65)", strokeWidth: 2 } }, eds));
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!insightsQuery.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center">
        <Network className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          הקנבס ריק
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          צור תובנות כדי לראות אותן כאן ולחבר ביניהן
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">קנבס קשרים</h1>
          <p className="text-xs text-muted-foreground">
            גרור תובנות, חבר ביניהן, ולחץ פעמיים לעריכה
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSavePositions}
          disabled={!hasChanges || bulkUpdateMutation.isPending}
          className="gap-1"
        >
          {bulkUpdateMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          שמור מיקומים
        </Button>
      </div>
      <div className="flex-1 rounded-lg border border-border overflow-hidden" dir="ltr">
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
          style={{ background: "oklch(0.145 0.005 260)" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="oklch(0.25 0.005 260)" />
          <Controls
            position="bottom-left"
            style={{ background: "oklch(0.19 0.008 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: "8px" }}
          />
          <MiniMap
            nodeColor={() => "oklch(0.75 0.15 65)"}
            maskColor="oklch(0.145 0.005 260 / 80%)"
            style={{ background: "oklch(0.19 0.008 260)", border: "1px solid oklch(0.28 0.01 260)", borderRadius: "8px" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
