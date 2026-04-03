import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Eye, Send, Lightbulb } from "lucide-react";
import { Streamdown } from "streamdown";

type AnalysisEntry = {
  question: string;
  analysis: string;
  timestamp: Date;
};

export default function Analysis() {
  const [question, setQuestion] = useState("");
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);

  const insightsQuery = trpc.insights.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const analyzeMutation = trpc.ai.analyze.useMutation({
    onSuccess: (data) => {
      setAnalyses((prev) => [
        {
          question: question || "מה האדם מבפנים לא רואה כאן?",
          analysis: data.analysis,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      setQuestion("");
    },
  });

  const handleAnalyze = (customQuestion?: string) => {
    analyzeMutation.mutate({
      question: customQuestion || question || undefined,
    });
  };

  const suggestedQuestions = [
    "מה האדם מבפנים לא רואה כאן?",
    "אילו סתירות מסתתרות בין התובנות?",
    "מה הדפוס החוזר שאני לא מודע אליו?",
    "איפה הנקודה העיוורת הגדולה ביותר?",
    "אילו קשרים בלתי צפויים קיימים בין הרעיונות?",
  ];

  const insightCount = insightsQuery.data?.length ?? 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">ניתוח AI</h1>
            <p className="text-xs text-muted-foreground">
              מה האדם מבפנים לא רואה כאן? — ניתוח {insightCount} תובנות
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 pt-4 overflow-hidden">
        {/* First-run empty state */}
        {analyses.length === 0 && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="h-20 w-20 rounded-2xl bg-primary/5 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary/30" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                שאל את ה-AI
              </h2>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                ה-AI קורא את כל התובנות שלך ומזהה דפוסים, נקודות עיוורות, וקשרים
                שאתה עלול לפספס מבפנים
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestedQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-colors"
                  onClick={() => handleAnalyze(q)}
                  disabled={analyzeMutation.isPending || insightCount === 0}
                >
                  {q}
                </Button>
              ))}
            </div>
            {insightCount === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                צור תובנות קודם כדי שה-AI יוכל לנתח אותן
              </p>
            )}
          </div>
        )}

        {/* Analysis results */}
        {analyses.length > 0 && (
          <ScrollArea className="flex-1">
            <div className="space-y-4 pb-4">
              {analyzeMutation.isPending && (
                <Card className="p-6 rounded-xl border-primary/15">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      מנתח את התובנות שלך...
                    </span>
                  </div>
                </Card>
              )}
              {analyses.map((entry, i) => (
                <Card key={i} className="p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {entry.question}
                    </span>
                    <Badge variant="secondary" className="text-[10px] mr-auto rounded-md">
                      {entry.timestamp.toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Badge>
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <Streamdown>{entry.analysis}</Streamdown>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Input area */}
        <div className="border-t border-border pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyze();
            }}
            className="flex gap-2 items-end"
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="שאל שאלה על התובנות שלך..."
              className="flex-1 max-h-24 resize-none min-h-10 rounded-xl"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={analyzeMutation.isPending || insightCount === 0}
              className="shrink-0 h-10 w-10 rounded-xl"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
