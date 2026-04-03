import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Save,
  Loader2,
  Tag,
  Plus,
  X,
  Clock,
  Sparkles,
  History,
  Link2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import MDEditor from "@uiw/react-md-editor";

export default function Editor() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const insightId = params.id ? parseInt(params.id) : null;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [category, setCategory] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [isEditorMode, setIsEditorMode] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const insightQuery = trpc.insights.get.useQuery(
    { id: insightId! },
    { enabled: !!insightId, refetchOnWindowFocus: false }
  );
  const tagsQuery = trpc.tags.list.useQuery();
  const historyQuery = trpc.insights.history.useQuery(
    { insightId: insightId! },
    { enabled: !!insightId && showHistory }
  );
  const categoriesQuery = trpc.insights.categories.useQuery();

  const updateMutation = trpc.insights.update.useMutation({
    onSuccess: () => {
      toast.success("נשמר");
      setHasUnsavedChanges(false);
      insightQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const createTagMutation = trpc.tags.create.useMutation({
    onSuccess: () => {
      tagsQuery.refetch();
      setShowNewTag(false);
      setNewTagName("");
      toast.success("תגית נוצרה");
    },
  });
  const suggestMutation = trpc.ai.suggestRelated.useMutation();

  // Load insight data
  useEffect(() => {
    if (insightQuery.data) {
      setTitle(insightQuery.data.title);
      setContent(insightQuery.data.content || "");
      setStatus(insightQuery.data.status as any);
      setCategory(insightQuery.data.category || "");
      setSelectedTagIds(insightQuery.data.tags?.map((t: any) => t.id) || []);
      setHasUnsavedChanges(false);
    }
  }, [insightQuery.data]);

  const handleSave = useCallback(() => {
    if (!insightId) return;
    updateMutation.mutate({
      id: insightId,
      title,
      content,
      status,
      category: category || null,
      tagIds: selectedTagIds,
    });
  }, [insightId, title, content, status, category, selectedTagIds]);

  // Keyboard shortcut: Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleSuggestRelated = () => {
    if (!insightId) return;
    setShowRelated(true);
    suggestMutation.mutate({ insightId });
  };

  if (!insightId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          בחר תובנה לעריכה
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          לחץ על תובנה מהרשימה או צור חדשה
        </p>
        <Button className="mt-4" onClick={() => setLocation("/")}>
          חזרה לתובנות
        </Button>
      </div>
    );
  }

  if (insightQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="text-lg font-bold border-none bg-transparent px-0 focus-visible:ring-0 max-w-md"
            placeholder="כותרת התובנה"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as any);
              setHasUnsavedChanges(true);
            }}
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">טיוטה</SelectItem>
              <SelectItem value="active">פעיל</SelectItem>
              <SelectItem value="archived">ארכיון</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(true)}
            className="gap-1"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">היסטוריה</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestRelated}
            className="gap-1"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">קשרים</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasUnsavedChanges}
            className="gap-1"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            שמירה
          </Button>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-3 py-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {tagsQuery.data?.map((tag) => (
            <Badge
              key={tag.id}
              variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
              className="text-[10px] cursor-pointer"
              onClick={() => {
                setSelectedTagIds((prev) =>
                  prev.includes(tag.id)
                    ? prev.filter((x) => x !== tag.id)
                    : [...prev, tag.id]
                );
                setHasUnsavedChanges(true);
              }}
            >
              {tag.name}
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setShowNewTag(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <Input
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setHasUnsavedChanges(true);
          }}
          placeholder="קטגוריה"
          className="h-7 text-xs w-[140px] bg-transparent"
          list="categories"
        />
        <datalist id="categories">
          {categoriesQuery.data?.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30">
          <Button
            variant={isEditorMode ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setIsEditorMode(true)}
          >
            עריכה
          </Button>
          <Button
            variant={!isEditorMode ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs"
            onClick={() => setIsEditorMode(false)}
          >
            תצוגה
          </Button>
        </div>
        <div className="h-[calc(100%-2.5rem)] overflow-auto" data-color-mode="dark">
          {isEditorMode ? (
            <MDEditor
              value={content}
              onChange={(val) => {
                setContent(val || "");
                setHasUnsavedChanges(true);
              }}
              height="100%"
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
              style={{ background: "transparent" }}
            />
          ) : (
            <div className="p-6 prose prose-invert max-w-none" dir="rtl">
              <Streamdown>{content || "*אין תוכן עדיין*"}</Streamdown>
            </div>
          )}
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              היסטוריית שינויים
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {historyQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : historyQuery.data?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                אין היסטוריה עדיין
              </p>
            ) : (
              <div className="space-y-4 p-1">
                {historyQuery.data?.map((entry: any) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{entry.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.createdAt).toLocaleString("he-IL")}
                      </div>
                    </div>
                    {entry.changeNote && (
                      <Badge variant="secondary" className="text-[10px] mb-2">
                        {entry.changeNote}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {entry.content?.substring(0, 300) || "(ריק)"}
                    </p>
                    {entry.tagsSnapshot && (entry.tagsSnapshot as string[]).length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {(entry.tagsSnapshot as string[]).map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Related Insights Dialog */}
      <Dialog open={showRelated} onOpenChange={setShowRelated}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              תובנות קשורות
            </DialogTitle>
          </DialogHeader>
          {suggestMutation.isPending ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">מחפש קשרים...</p>
            </div>
          ) : suggestMutation.data ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {suggestMutation.data.explanation}
              </p>
              {suggestMutation.data.relatedIds.length > 0 && (
                <div className="space-y-2">
                  {suggestMutation.data.relatedIds.map((id: number) => (
                    <Button
                      key={id}
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        setShowRelated(false);
                        setLocation(`/editor/${id}`);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      תובנה #{id}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New Tag Dialog */}
      <Dialog open={showNewTag} onOpenChange={setShowNewTag}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>תגית חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>שם</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="שם התגית"
              />
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createTagMutation.mutate({ name: newTagName, color: newTagColor })
              }
              disabled={!newTagName.trim() || createTagMutation.isPending}
            >
              צור תגית
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
