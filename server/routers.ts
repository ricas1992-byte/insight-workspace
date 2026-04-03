import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import {
  createInsight, getInsightById, updateInsight, deleteInsight, listInsights,
  getInsightCategories, createTag, listTags, deleteTag, getInsightTags,
  setInsightTags, createConnection, listConnections, deleteConnection,
  updateConnection, createHistorySnapshot, getInsightHistory,
  getInsightsWithTags,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Insights ───────────────────────────────────────────────────
  insights: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["draft", "active", "archived"]).optional(),
        search: z.string().optional(),
        category: z.string().optional(),
        tagIds: z.array(z.number()).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const filters = input ? {
          ...input,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        } : undefined;
        const result = await listInsights(ctx.user.id, filters);
        // Attach tags to each insight
        const withTags = await Promise.all(result.map(async (insight) => ({
          ...insight,
          tags: await getInsightTags(insight.id),
        })));
        return withTags;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const insight = await getInsightById(input.id, ctx.user.id);
        if (!insight) throw new TRPCError({ code: "NOT_FOUND", message: "Insight not found" });
        const insightTags = await getInsightTags(insight.id);
        return { ...insight, tags: insightTags };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        category: z.string().optional(),
        tagIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const insight = await createInsight({
          userId: ctx.user.id,
          title: input.title,
          content: input.content ?? "",
          status: input.status ?? "draft",
          category: input.category ?? null,
        });
        if (input.tagIds && input.tagIds.length > 0) {
          await setInsightTags(insight.id, input.tagIds);
        }
        await createHistorySnapshot(insight.id, "Created");
        return insight;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        category: z.string().nullable().optional(),
        tagIds: z.array(z.number()).optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, tagIds, ...data } = input;
        const existing = await getInsightById(id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const updated = await updateInsight(id, ctx.user.id, data);
        if (tagIds !== undefined) {
          await setInsightTags(id, tagIds);
        }
        // Create history snapshot if content or title changed
        if (data.title !== undefined || data.content !== undefined || data.status !== undefined) {
          await createHistorySnapshot(id, "Updated");
        }
        return updated;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteInsight(input.id, ctx.user.id);
        return { success: true };
      }),

    categories: protectedProcedure.query(async ({ ctx }) => {
      return getInsightCategories(ctx.user.id);
    }),

    history: protectedProcedure
      .input(z.object({ insightId: z.number() }))
      .query(async ({ input }) => {
        return getInsightHistory(input.insightId);
      }),

    bulkUpdatePositions: protectedProcedure
      .input(z.array(z.object({
        id: z.number(),
        positionX: z.number(),
        positionY: z.number(),
      })))
      .mutation(async ({ ctx, input }) => {
        await Promise.all(input.map(item =>
          updateInsight(item.id, ctx.user.id, { positionX: item.positionX, positionY: item.positionY })
        ));
        return { success: true };
      }),

    export: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const results = await Promise.all(
          input.ids.map(id => getInsightById(id, ctx.user.id))
        );
        const validInsights = results.filter(Boolean);
        const markdownParts = await Promise.all(validInsights.map(async (insight) => {
          const itags = await getInsightTags(insight!.id);
          const tagStr = itags.length > 0 ? `\nTags: ${itags.map(t => t.name).join(", ")}` : "";
          const catStr = insight!.category ? `\nCategory: ${insight!.category}` : "";
          const statusStr = `\nStatus: ${insight!.status}`;
          return `# ${insight!.title}\n${statusStr}${catStr}${tagStr}\nDate: ${insight!.createdAt.toISOString().split("T")[0]}\n\n${insight!.content || ""}\n\n---\n`;
        }));
        return { markdown: markdownParts.join("\n") };
      }),
  }),

  // ─── Tags ───────────────────────────────────────────────────────
  tags: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listTags(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), color: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return createTag({ userId: ctx.user.id, name: input.name, color: input.color });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTag(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Connections ────────────────────────────────────────────────
  connections: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listConnections(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        sourceInsightId: z.number(),
        targetInsightId: z.number(),
        label: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createConnection({ userId: ctx.user.id, ...input });
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), label: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return updateConnection(input.id, ctx.user.id, { label: input.label });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteConnection(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── AI Analysis ───────────────────────────────────────────────
  ai: router({
    analyze: protectedProcedure
      .input(z.object({
        insightIds: z.array(z.number()).optional(),
        question: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const allInsights = await getInsightsWithTags(ctx.user.id);
        const targetInsights = input.insightIds && input.insightIds.length > 0
          ? allInsights.filter(i => input.insightIds!.includes(i.id))
          : allInsights;

        if (targetInsights.length === 0) {
          return { analysis: "No insights available for analysis. Create some insights first." };
        }

        const insightsText = targetInsights.map(i =>
          `Title: ${i.title}\nStatus: ${i.status}\nCategory: ${i.category || "none"}\nTags: ${i.tags.map((t: any) => t.name).join(", ") || "none"}\nContent: ${i.content || "(empty)"}\n`
        ).join("\n---\n");

        const userQuestion = input.question || "What does the insider not see here? Analyze these insights and identify hidden patterns, blind spots, or outsider perspectives that might be missed.";

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an analytical thinking partner for a piano teacher named Yotam Rix who has an outsider perspective on the conservatory system. Your role is to read his insights and identify what someone inside the system would not see — hidden patterns, blind spots, contradictions, and unexpected connections between ideas.

The guiding question is: "What does the insider not see here?" (מה האדם מבפנים לא רואה כאן?)

Be specific, reference actual insights by title, and provide concrete observations. Write in a thoughtful, direct style. You may respond in Hebrew or English based on the content language.`,
            },
            {
              role: "user",
              content: `Here are the insights to analyze:\n\n${insightsText}\n\nQuestion: ${userQuestion}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        const analysisText = typeof content === "string" ? content : Array.isArray(content) ? content.map(c => "text" in c ? c.text : "").join("") : "";
        return { analysis: analysisText };
      }),

    suggestRelated: protectedProcedure
      .input(z.object({ insightId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const currentInsight = await getInsightById(input.insightId, ctx.user.id);
        if (!currentInsight) throw new TRPCError({ code: "NOT_FOUND" });

        const allInsights = await listInsights(ctx.user.id);
        const others = allInsights.filter(i => i.id !== input.insightId);
        if (others.length === 0) return { relatedIds: [], explanation: "No other insights to compare." };

        const othersText = others.map(i => `[ID:${i.id}] ${i.title}: ${(i.content || "").substring(0, 200)}`).join("\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You analyze content similarity between insights. Return a JSON object with relatedIds (array of insight IDs most related) and explanation (brief text explaining the connections). Return at most 5 related insights.",
            },
            {
              role: "user",
              content: `Current insight:\nTitle: ${currentInsight.title}\nContent: ${currentInsight.content || "(empty)"}\n\nOther insights:\n${othersText}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "related_insights",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  relatedIds: { type: "array", items: { type: "number" }, description: "IDs of related insights" },
                  explanation: { type: "string", description: "Brief explanation of connections" },
                },
                required: ["relatedIds", "explanation"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : "";
        try {
          return JSON.parse(text);
        } catch {
          return { relatedIds: [], explanation: text || "Could not determine related insights." };
        }
      }),
  }),

  // ─── Voice ──────────────────────────────────────────────────────
  voice: router({
    uploadAndTranscribe: protectedProcedure
      .input(z.object({
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
        language: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Decode base64 to buffer
        const audioBuffer = Buffer.from(input.audioBase64, "base64");
        const ext = input.mimeType.split("/")[1] || "webm";
        const fileName = `voice/${ctx.user.id}-${Date.now()}.${ext}`;

        // Upload to S3
        const { url } = await storagePut(fileName, audioBuffer, input.mimeType);

        // Transcribe
        const result = await transcribeAudio({
          audioUrl: url,
          language: input.language || "he",
          prompt: "Transcribe this voice note about music education, piano teaching, and conservatory insights.",
        });

        if ("error" in result) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error, cause: result });
        }

        return { text: result.text, language: result.language, duration: result.duration };
      }),
  }),
});

export type AppRouter = typeof appRouter;
