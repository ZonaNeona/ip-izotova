import { NextResponse } from "next/server";
import {
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";
import {
  buildTelegramReport,
  telegramReportCodes,
  type TelegramReportCode,
} from "@/lib/telegram-reports";

type RouteRow = {
  id: string;
  code: TelegramReportCode;
  name: string;
  report_type: string;
  topic_id: number | null;
  enabled: boolean;
  sort_order: number;
  schedule_hint: string | null;
  last_sent_at: string | null;
};

type DeliveryRow = {
  id: string;
  route_id: string | null;
  status: string;
  report_type: string;
  payload_preview: string | null;
  error: string | null;
  sent_at: string;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type ForumTopic = {
  message_thread_id: number;
  name: string;
};

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return {
    token,
    chatId,
    connected: Boolean(token && chatId),
  };
}

async function telegramCall<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.description ?? `Telegram API: ${response.status}`);
  }

  return data.result as T;
}

function plainPreview(html: string) {
  return html
    .replaceAll("<b>", "")
    .replaceAll("</b>", "")
    .replaceAll("<i>", "")
    .replaceAll("</i>", "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"');
}

async function routes() {
  return (
    (await supabaseSelect<RouteRow>("telegram_report_routes", {
      order: "sort_order.asc",
    })) ?? []
  );
}

async function sendRoute(route: RouteRow, dryRun: boolean) {
  const config = telegramConfig();
  const report = await buildTelegramReport(route.code);
  const preview = plainPreview(report);

  if (
    dryRun ||
    !config.connected ||
    !route.topic_id ||
    !route.enabled
  ) {
    return {
      ok: true,
      mode: "preview" as const,
      sent: false,
      code: route.code,
      preview,
      warning: !route.enabled
        ? "Маршрут отключён."
        : !config.connected
          ? "Telegram ещё не подключён. Показан предпросмотр."
          : !route.topic_id
            ? "Для маршрута ещё не создана тема. Показан предпросмотр."
            : null,
    };
  }

  try {
    const message = await telegramCall<{ message_id: number }>(
      config.token!,
      "sendMessage",
      {
        chat_id: config.chatId!,
        message_thread_id: Number(route.topic_id),
        text: report.slice(0, 4096),
        parse_mode: "HTML",
        disable_notification: false,
      },
    );

    const sentAt = new Date().toISOString();
    await Promise.all([
      supabasePatch(
        "telegram_report_routes",
        { id: route.id },
        { last_sent_at: sentAt },
      ),
      supabaseInsert("telegram_delivery_log", {
        route_id: route.id,
        status: "sent",
        report_type: route.report_type,
        payload_preview: preview.slice(0, 1000),
        error: null,
        sent_at: sentAt,
      }),
    ]);

    return {
      ok: true,
      mode: "live" as const,
      sent: true,
      code: route.code,
      messageId: message.message_id,
      preview,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка Telegram.";

    await supabaseInsert("telegram_delivery_log", {
      route_id: route.id,
      status: "error",
      report_type: route.report_type,
      payload_preview: preview.slice(0, 1000),
      error: message.slice(0, 1000),
    });

    return {
      ok: false,
      mode: "live" as const,
      sent: false,
      code: route.code,
      preview,
      error: message,
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") as TelegramReportCode | null;
  const config = telegramConfig();
  const reportRoutes = await routes();
  const deliveries =
    (await supabaseSelect<DeliveryRow>("telegram_delivery_log", {
      order: "sent_at.desc",
    })) ?? [];

  const selected = code
    ? reportRoutes.find((route) => route.code === code)
    : undefined;

  const preview =
    selected && telegramReportCodes.includes(selected.code)
      ? plainPreview(await buildTelegramReport(selected.code))
      : null;

  return NextResponse.json({
    connected: config.connected,
    botConfigured: Boolean(config.token),
    chatConfigured: Boolean(config.chatId),
    readyRoutes: reportRoutes.filter(
      (route) => route.enabled && route.topic_id,
    ).length,
    routes: reportRoutes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      enabled: route.enabled,
      topicId: route.topic_id,
      scheduleHint: route.schedule_hint,
      lastSentAt: route.last_sent_at,
    })),
    recentDeliveries: deliveries.slice(0, 12).map((row) => ({
      id: row.id,
      routeId: row.route_id,
      status: row.status,
      reportType: row.report_type,
      error: row.error,
      sentAt: row.sent_at,
    })),
    preview,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "preview" | "send" | "send_all" | "setup_topics" | "test";
    code?: TelegramReportCode;
  };

  const action = body.action ?? "preview";
  const reportRoutes = await routes();
  const config = telegramConfig();

  if (action === "test") {
    if (!config.connected) {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        connected: false,
        message:
          "Для живой проверки задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.",
      });
    }

    try {
      const [bot, chat] = await Promise.all([
        telegramCall<{ username?: string; first_name: string }>(
          config.token!,
          "getMe",
          {},
        ),
        telegramCall<{ id: number; title?: string; is_forum?: boolean }>(
          config.token!,
          "getChat",
          { chat_id: config.chatId! },
        ),
      ]);

      return NextResponse.json({
        ok: true,
        mode: "live",
        connected: true,
        botName: bot.username ? `@${bot.username}` : bot.first_name,
        chatTitle: chat.title ?? String(chat.id),
        isForum: Boolean(chat.is_forum),
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось проверить Telegram.",
        },
        { status: 502 },
      );
    }
  }

  if (action === "setup_topics") {
    if (!config.connected) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Сначала задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в окружении.",
        },
        { status: 412 },
      );
    }

    const colors = [
      7322096,
      16766590,
      13338331,
      9367192,
      16749490,
      16478047,
    ];
    const results: Array<{
      code: string;
      ok: boolean;
      topicId?: number;
      error?: string;
    }> = [];

    for (let index = 0; index < reportRoutes.length; index += 1) {
      const route = reportRoutes[index];

      if (route.topic_id) {
        results.push({
          code: route.code,
          ok: true,
          topicId: Number(route.topic_id),
        });
        continue;
      }

      try {
        const topic = await telegramCall<ForumTopic>(
          config.token!,
          "createForumTopic",
          {
            chat_id: config.chatId!,
            name: route.name,
            icon_color: colors[index % colors.length],
          },
        );

        await supabasePatch(
          "telegram_report_routes",
          { id: route.id },
          { topic_id: topic.message_thread_id },
        );

        results.push({
          code: route.code,
          ok: true,
          topicId: topic.message_thread_id,
        });
      } catch (error) {
        results.push({
          code: route.code,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось создать тему.",
        });
      }
    }

    return NextResponse.json({
      ok: results.every((result) => result.ok),
      mode: "live",
      results,
    });
  }

  if (action === "send_all") {
    const enabled = reportRoutes.filter((route) => route.enabled);
    const results = [];
    for (const route of enabled) {
      results.push(await sendRoute(route, false));
    }

    return NextResponse.json({
      ok: results.every((result) => result.ok),
      results,
    });
  }

  if (!body.code || !telegramReportCodes.includes(body.code)) {
    return NextResponse.json(
      { error: "Не выбран тип отчёта." },
      { status: 400 },
    );
  }

  const route = reportRoutes.find((item) => item.code === body.code);
  if (!route) {
    return NextResponse.json(
      { error: "Маршрут отчёта не найден." },
      { status: 404 },
    );
  }

  const result = await sendRoute(route, action === "preview");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    code?: TelegramReportCode;
    topicId?: number | null;
    enabled?: boolean;
  };

  if (!body.code || !telegramReportCodes.includes(body.code)) {
    return NextResponse.json(
      { error: "Не выбран маршрут." },
      { status: 400 },
    );
  }

  const reportRoutes = await routes();
  const route = reportRoutes.find((item) => item.code === body.code);
  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.topicId !== undefined) patch.topic_id = body.topicId;
  if (body.enabled !== undefined) patch.enabled = body.enabled;

  const updated = await supabasePatch<RouteRow>(
    "telegram_report_routes",
    { id: route.id },
    patch,
  );

  return NextResponse.json({
    ok: Boolean(updated?.[0]),
    route: updated?.[0] ?? null,
  });
}
