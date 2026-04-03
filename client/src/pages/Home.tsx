import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  FileText,
  Mic,
  Download,
  Loader2,
  Filter,
  X,
  Lightbulb,
  Clock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  archived: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  active: "פעיל",
  archived: "ארכיון",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newStatus, setNewStatus] = useState<"draft" | "active">("draft");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const insightsQuery = trpc.insights.list.useQuery(
    {
      status: statusFilter !== "all" ? (statusFilter as any) : undefined,
      search: search || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    },
    { refetchOnWindowFocus: false }
  );
  const tagsQuery = trpc.tags.list.useQuery();
  const createMutation = trpc.insights.create.useMutation({
    onSuccess: (data) => {
      toast.success("תובנה חדשה נוצרה");
      setShowCreateDialog(false);
      setNewTitle("");
      setNewContent("");
      insightsQuery.refetch();
      setLocation(`/editor/${data.id}`);
    },
  });
  const deleteMutation = trpc.insights.delete.useMutation({
    onSuccess: () => {
      toast.success("תובנה נמחקה");
      insightsQuery.refetch();
    },
  });
  const exportMutation = trpc.insights.export.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "insights-export.md";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("הייצוא הושלם");
      setSelectedIds([]);
    },
  });
  const voiceMutation = trpc.voice.uploadAndTranscribe.useMutation({
    onSuccess: (data) => {
      setNewTitle(data.text.substring(0, 80));
      setNewContent(data.text);
      setShowVoiceDialog(false);
      setShowCreateDialog(true);
      toast.success("התמלול הושלם");
    },
    onError: (err) => {
      toast.error(`שגיאה בתמלול: ${err.message}`);
    },
  });

  const insights = insightsQuery.data ?? [];

  const stats = useMemo(() => {
    return {
      total: insights.length,
      draft: insights.filter((i) => i.status === "draft").length,
      active: insights.filter((i) => i.status === "active").length,
      archived: insights.filter((i) => i.status === "archived").length,
    };
  }, [insights]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          voiceMutation.mutate({ audioBase64: base64, mimeType: "audio/webm", language: "he" });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch {
      toast.error("לא ניתן לגשת למיקרופון");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">תובנות</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} תובנות — {stats.active} פעילות, {stats.draft} טיוטות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVoiceDialog(true)}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">הקלטה</span>
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">תובנה חדשה</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש תובנות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <Filter className="h-3.5 w-3.5 ml-2" />
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="draft">טיוטה</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="archived">ארכיון</SelectItem>
          </SelectContent>
        </Select>
        {tagsQuery.data && tagsQuery.data.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {tagsQuery.data.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() =>
                  setSelectedTagIds((prev) =>
                    prev.includes(tag.id)
                      ? prev.filter((x) => x !== tag.id)
                      : [...prev, tag.id]
                  )
                }
              >
                {tag.name}
              </Badge>
            ))}
            {selectedTagIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTagIds([])}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Export bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-sm text-primary font-medium">
            {selectedIds.length} נבחרו
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportMutation.mutate({ ids: selectedIds })}
            disabled={exportMutation.isPending}
            className="gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            ייצוא
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            ביטול
          </Button>
        </div>
      )}

      {/* Insights Grid */}
      {insightsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            אין תובנות עדיין
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            צור תובנה חדשה או הקלט מחשבה קולית
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((insight) => (
            <Card
              key={insight.id}
              className={`p-4 hover:border-primary/30 transition-all cursor-pointer group relative ${
                selectedIds.includes(insight.id) ? "border-primary ring-1 ring-primary/30" : ""
              }`}
              onClick={() => setLocation(`/editor/${insight.id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                    {insight.title}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusColors[insight.status]}`}
                >
                  {statusLabels[insight.status]}
                </Badge>
              </div>

              {insight.content && (
                <p className="text-xs text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
                  {insight.content.replace(/[#*_`]/g, "").substring(0, 200)}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {insight.tags?.slice(0, 3).map((tag: any) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {(insight.tags?.length ?? 0) > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{(insight.tags?.length ?? 0) - 3}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(insight.updatedAt).toLocaleDateString("he-IL")}
                </div>
              </div>

              {/* Selection checkbox */}
              <button
                className="absolute top-2 left-2 h-5 w-5 rounded border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(insight.id);
                }}
              >
                {selectedIds.includes(insight.id) && (
                  <div className="h-3 w-3 rounded-sm bg-primary" />
                )}
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>תובנה חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>כותרת</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="מה התובנה?"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>תוכן ראשוני (אופציונלי)</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="פרט את המחשבה..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">טיוטה</SelectItem>
                  <SelectItem value="active">פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ביטול
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  title: newTitle,
                  content: newContent,
                  status: newStatus,
                })
              }
              disabled={!newTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "צור תובנה"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Recording Dialog */}
      <Dialog open={showVoiceDialog} onOpenChange={setShowVoiceDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>הקלטת מחשבה</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-8">
            <div
              className={`h-24 w-24 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-destructive/20 animate-pulse"
                  : voiceMutation.isPending
                    ? "bg-primary/20"
                    : "bg-muted"
              }`}
            >
              {voiceMutation.isPending ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : (
                <Mic
                  className={`h-10 w-10 ${isRecording ? "text-destructive" : "text-muted-foreground"}`}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {voiceMutation.isPending
                ? "מתמלל..."
                : isRecording
                  ? "מקליט... לחץ לעצירה"
                  : "לחץ להתחלת הקלטה"}
            </p>
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={voiceMutation.isPending}
            >
              {isRecording ? "עצור הקלטה" : "התחל הקלטה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
