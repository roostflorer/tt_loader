import { Bot, Context, session, Keyboard, InlineKeyboard, SessionFlavor, InputFile } from "grammy";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import ffmpeg from "fluent-ffmpeg";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import axios from "axios";
import crypto from "crypto";
import { promisify } from "util";
import { pipeline } from "stream";

const streamPipeline = promisify(pipeline);

// --- Keyboards ---

const mainKeyboardRU = (isAdmin: boolean) => {
  const k = new Keyboard()
    .text("📥 Инструкция").text("💎 Стать PRO").row()
    .text("👤 Мой Профиль").text("📖 Справочник").row()
    .text("🌐 Сменить Язык");
  return k.resized();
};

const mainKeyboardEN = (isAdmin: boolean) => {
  const k = new Keyboard()
    .text("📥 Instructions").text("💎 Get PRO").row()
    .text("👤 My Profile").text("📖 Handbook").row()
    .text("🌐 Change Language");
  return k.resized();
};

const mainKeyboardPL = (isAdmin: boolean) => {
  const k = new Keyboard()
    .text("📥 Instrukcja").text("💎 Kup PRO").row()
    .text("👤 Mój Profil").text("📖 Przewodnik").row()
    .text("🌐 Zmień Język");
  return k.resized();
};

const languageKeyboard = new InlineKeyboard()
  .text("🇷🇺 Русский", "set_lang_ru")
  .text("🇺🇸 English", "set_lang_en")
  .text("🇵🇱 Polski", "set_lang_pl");

const upgradeInlineRU = new InlineKeyboard()
  .url("💳 Оформить PRO подписку", "https://t.me/TeleLoadd")
  .row()
  .text("🔄 Проверить оплату", "refresh_status");

const upgradeInlineEN = new InlineKeyboard()
  .url("💳 Get PRO Subscription", "https://t.me/TeleLoadd")
  .row()
  .text("🔄 Verify Payment", "refresh_status");

const upgradeInlinePL = new InlineKeyboard()
  .url("💳 Kup subskrypcję PRO", "https://t.me/TeleLoadd")
  .row()
  .text("🔄 Sprawdź status", "refresh_status");

const adminMenuKeyboard = new InlineKeyboard()
  .text("📊 Общая Статистика", "admin_stats")
  .text("👥 Управление Юзерами", "admin_users")
  .row()
  .text("❌ Закрыть Меню", "admin_close");

// --- Types & Context ---

interface SessionData {
  step?: "idle" | "awaiting_link" | "awaiting_broadcast";
  language?: "ru" | "en" | "pl";
}

type MyContext = Context & SessionFlavor<SessionData> & {
  dbUser?: User;
};

// --- Bot Logic ---

export async function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log('Telegram token (raw):', JSON.stringify(token));
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set. Bot will not start.");
    return;
  }

  const bot = new Bot<MyContext>(token);

  // Simple in-memory store mapping short IDs -> video URL for audio extraction
  const audioStore = new Map<string, { videoUrl: string; createdAt: number }>();

  // Detect ffmpeg availability. Prefer bundled ffmpeg-static if installed.
  let ffmpegAvailable = false;
  try {
    // Try ffmpeg in PATH
    const which = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (which.status === 0) {
      ffmpegAvailable = true;
    } else {
      // try ffmpeg-static if present
      try {
        // dynamic import; if package missing this will throw
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ffmpegStatic = await import("ffmpeg-static");
        const ffmpegPath = (ffmpegStatic && (ffmpegStatic.default || ffmpegStatic)) as any;
        if (ffmpegPath) {
          ffmpeg.setFfmpegPath(ffmpegPath as string);
          ffmpegAvailable = true;
        }
      } catch (e) {
        ffmpegAvailable = false;
      }
    }
  } catch (e) {
    ffmpegAvailable = false;
  }
  // Expose a setter for testing/dev to inject entries into the store
  // (exported setter will be assigned when bot starts)
  try {
    // @ts-ignore
    if (typeof globalThis.__setAudioStoreEntry === "function") {
      // noop if already set
    } else {
      // @ts-ignore
      globalThis.__setAudioStoreEntry = (id: string, videoUrl: string) => {
        audioStore.set(id, { videoUrl, createdAt: Date.now() });
      };
    }
  } catch (e) {
    // ignore
  }
  // Periodically clean up old entries (older than 15 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of audioStore.entries()) {
      if (now - val.createdAt > 15 * 60 * 1000) audioStore.delete(key);
    }
  }, 5 * 60 * 1000);

  bot.use(session({ initial: (): SessionData => ({ step: "idle", language: "ru" }) }));

  // Middleware: Attach DB User
  bot.use(async (ctx, next) => {
      if (ctx.from?.id) {
      const telegramId = ctx.from.id.toString();
      const username = ctx.from.username || null;
      const firstName = ctx.from.first_name || null;
      
      let user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        user = await storage.createUser({
          telegramId,
          username,
          firstName,
          isPro: false,
          trialStart: new Date(),
          language: "ru"
        } as any);
      } else if (user.username !== username || user.firstName !== firstName) {
        // Update user info if it changed
        user = await storage.updateUser(user.id, {
          username,
          firstName
        });
      }
      ctx.dbUser = user;
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    const lang = (ctx.session.language as "ru" | "en" | "pl") || "ru";
    const trialEnds = new Date((ctx.dbUser?.trialStart?.getTime() || Date.now()) + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const isPro = !!(ctx.dbUser?.isPro && (!ctx.dbUser?.proEnd || new Date(ctx.dbUser.proEnd) > now));
    const isTrialActive = !isPro && now < trialEnds;
    const isAdmin = ctx.dbUser?.telegramId === "7248043928";

    // Handle referral
    const startPayload = ctx.match;
    if (startPayload && startPayload.startsWith("ref_")) {
      const referrerId = parseInt(startPayload.replace("ref_", ""));
      if (!isNaN(referrerId) && !ctx.dbUser?.referredBy && referrerId !== ctx.dbUser?.id) {
        await storage.addReferral(ctx.dbUser!.id, referrerId);
        const refMsg = lang === "ru" ? "🎉 *Вы присоединились по приглашению!*\n\nМы начислили бонус вашему другу, а вам желаем приятного пользования! ❤️" : 
                       lang === "pl" ? "🎉 *Dołączyłeś przez zaproszenie!*\n\nTwój znajomy otrzymał bonus, a my życzymy Ci miłego korzystania! ❤️" :
                       "🎉 *You've joined via an invitation!*\n\nYour friend received a bonus, and we wish you a pleasant experience! ❤️";
        await ctx.reply(refMsg, { parse_mode: "Markdown" });
      }
    }

    let msg = "";
    if (lang === "ru") {
      msg = `🌟 *Добро пожаловать в элитарный TeleLoad PRO!* 🌟\n\n`;
      msg += `Я — самый быстрый бот для загрузки контента из *TikTok* в высоком качестве и без лишних водяных знаков.\n\n`;
      msg += `📝 *Ваш текущий статус:*\n`;
      msg += `● Статус: ${isPro ? "💎 **PRO Аккаунт**" : isTrialActive ? "⏳ **Пробный период**" : "❌ **Срок действия истек**"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `● Действует до: \`${new Date(ctx.dbUser.proEnd).toLocaleString("ru-RU")}\`\n`;
      } else if (isTrialActive) {
        msg += `● Доступен до: \`${trialEnds.toLocaleString("ru-RU")}\`\n`;
      }
      msg += `\n🎯 *Готовы начать?*\nПросто пришлите мне ссылку на видео, и я мгновенно его обработаю!`;
    } else if (lang === "pl") {
      msg = `🌟 *Witaj w elitarnym TeleLoad PRO!* 🌟\n\n`;
      msg += `Jestem najszybszym botem do pobierania treści z *TikToka* w wysokiej jakości i bez znaków wodnych.\n\n`;
      msg += `📝 *Twój aktualny status:*\n`;
      msg += `● Status: ${isPro ? "💎 **Konto PRO**" : isTrialActive ? "⏳ **Okres próbny**" : "❌ **Subskrypcja wygasła**"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `● Ważne do: \`${new Date(ctx.dbUser.proEnd).toLocaleString("pl-PL")}\`\n`;
      } else if (isTrialActive) {
        msg += `● Dostępne do: \`${trialEnds.toLocaleString("pl-PL")}\`\n`;
      }
      msg += `\n🎯 *Gotowy?*\nPo prostu wyślij mi link do wideo, a ja zajmę się resztą!`;
    } else {
      msg = `🌟 *Welcome to the Elite TeleLoad PRO!* 🌟\n\n`;
      msg += `I am the fastest bot for downloading *TikTok* content in high quality without watermarks.\n\n`;
      msg += `📝 *Your Current Status:*\n`;
      msg += `● Status: ${isPro ? "💎 **PRO Account**" : isTrialActive ? "⏳ **Free Trial**" : "❌ **Access Expired**"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `● Active until: \`${new Date(ctx.dbUser.proEnd).toLocaleString()}\`\n`;
      } else if (isTrialActive) {
        msg += `● Valid until: \`${trialEnds.toLocaleString()}\`\n`;
      }
      msg += `\n🎯 *Ready to start?*\nJust send me a video link, and I'll process it instantly!`;
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: lang === "ru" ? mainKeyboardRU(isAdmin) : (lang === "pl" ? mainKeyboardPL(isAdmin) : mainKeyboardEN(isAdmin)),
    });
  });

  // Language Menu
  bot.hears(["🌐 Сменить Язык", "🌐 Change Language", "🌐 Zmień Język"], async (ctx) => {
    const lang = (ctx.session.language as "ru" | "en" | "pl") || "ru";
    const text = lang === "ru" ? "🌍 *Выберите предпочтительный язык для интерфейса:* " : 
                 lang === "pl" ? "🌍 *Wybierz preferowany język interfejsu:* " : 
                 "🌍 *Choose your preferred interface language:* ";
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: languageKeyboard,
    });
  });

  bot.callbackQuery("set_lang_ru", async (ctx) => {
    ctx.session.language = "ru";
    const isAdmin = ctx.dbUser?.telegramId === "7248043928";
    await ctx.answerCallbackQuery("Язык изменен на Русский 🇷🇺");
    await ctx.reply("🇷🇺 *Язык успешно изменен на Русский!*\n\nТеперь все меню и сообщения будут на вашем родном языке.", { 
      parse_mode: "Markdown",
      reply_markup: mainKeyboardRU(isAdmin) 
    });
  });

  bot.callbackQuery("set_lang_en", async (ctx) => {
    ctx.session.language = "en";
    const isAdmin = ctx.dbUser?.telegramId === "7248043928";
    await ctx.answerCallbackQuery("Language changed to English 🇺🇸");
    await ctx.reply("🇺🇸 *Language successfully changed to English!*\n\nFrom now on, all menus and messages will be in English.", { 
      parse_mode: "Markdown",
      reply_markup: mainKeyboardEN(isAdmin) 
    });
  });

  bot.callbackQuery("set_lang_pl", async (ctx) => {
    ctx.session.language = "pl";
    const isAdmin = ctx.dbUser?.telegramId === "7248043928";
    await ctx.answerCallbackQuery("Język zmieniony na Polski 🇵🇱");
    await ctx.reply("🇵🇱 *Język pomyślnie zmieniony na Polski!*\n\nTeraz wszystkie menu i wiadomości будут по polsku.", { 
      parse_mode: "Markdown",
      reply_markup: mainKeyboardPL(isAdmin) 
    });
  });

  // Instructions
  bot.hears(["📥 Инструкция", "📥 Instructions", "📥 Instrukcja"], async (ctx) => {
    const lang = ctx.session.language || "ru";
    let msg = "";
    if (lang === "ru") {
      msg = `📥 *КАК ПОЛЬЗОВАТЬСЯ БОТОМ:*\n\n`;
      msg += `1️⃣ Откройте приложение *TikTok*.\n`;
      msg += `2️⃣ Найдите видео, которое хотите скачать.\n`;
      msg += `3️⃣ Нажмите кнопку «Поделиться» и выберите «Копировать ссылку».\n`;
      msg += `4️⃣ Просто отправьте эту ссылку мне сообщением.\n\n`;
      msg += `✨ *Результат:* Я пришлю вам чистое видео без водяных знаков в течение нескольких секунд!`;
    } else if (lang === "pl") {
      msg = `📥 *JAK KORZYSTAĆ Z BOTA:*\n\n`;
      msg += `1️⃣ Otwórz aplikację *TikTok*.\n`;
      msg += `2️⃣ Znajdź wideo, które chcesz pobrać.\n`;
      msg += `3️⃣ Kliknij przycisk „Udostępnij” i wybierz „Kopiuj link”.\n`;
      msg += `4️⃣ Po prostu wyślij ten link do mnie w wiadomości.\n\n`;
      msg += `✨ *Wynik:* Prześlę Ci czyste wideo bez znaków wodnych w ciągu kilku sekund!`;
    } else {
      msg = `📥 *HOW TO USE THE BOT:*\n\n`;
      msg += `1️⃣ Open the *TikTok* app.\n`;
      msg += `2️⃣ Find the video you want to download.\n`;
      msg += `3️⃣ Tap the "Share" button and select "Copy Link".\n`;
      msg += `4️⃣ Just send that link to me as a message.\n\n`;
      msg += `✨ *Result:* I will send you a clean video without watermarks within seconds!`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // Upgrade / PRO
  bot.hears(["💎 Стать PRO", "💎 Get PRO", "💎 Kup PRO"], async (ctx) => {
    const lang = ctx.session.language || "ru";
    let msg = "";
    if (lang === "ru") {
      msg = `💎 *ПРЕИМУЩЕСТВА ПОДПИСКИ PRO:*\n\n`;
      msg += `✅ **Чистое видео:** Никаких водяных знаков TikTok.\n`;
      msg += `🚀 **Макс. скорость:** Мгновенная обработка и отправка.\n`;
      msg += `♾️ **Безлимит:** Качайте столько видео, сколько захотите.\n`;
      msg += `🌟 **Поддержка:** Прямая связь с разработчиками.\n\n`;
      msg += `💳 *Для оформления подписки свяжитесь с нами:* @TeleLoadd`;
    } else if (lang === "pl") {
      msg = `💎 *ZALETY SUBSKRYPCJI PRO:*\n\n`;
      msg += `✅ **Czyste wideo:** Brak znaków wodnych TikTok.\n`;
      msg += `🚀 **Maks. prędkość:** Błyskawiczne przetwarzanie i wysyłka.\n`;
      msg += `♾️ **Brak limitów:** Pobieraj tyle filmów, ile chcesz.\n`;
      msg += `🌟 **Wsparcie:** Bezpośredni kontakt z twórcami.\n\n`;
      msg += `💳 *Aby wykupić subskrypcję, skontaktuj się z nami:* @TeleLoadd`;
    } else {
      msg = `💎 *PRO SUBSCRIPTION BENEFITS:*\n\n`;
      msg += `✅ **Clean Video:** No TikTok watermarks.\n`;
      msg += `🚀 **Max Speed:** Instant processing and delivery.\n`;
      msg += `♾️ **Unlimited:** Download as many videos as you want.\n`;
      msg += `🌟 **Support:** Direct line to the developers.\n\n`;
      msg += `💳 *To subscribe, please contact us:* @TeleLoadd`;
    }
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: lang === "ru" ? upgradeInlineRU : (lang === "pl" ? upgradeInlinePL : upgradeInlineEN),
    });
  });

  // Stats / Profile
  bot.hears(["👤 Мой Профиль", "👤 My Profile", "👤 Mój Profil"], async (ctx) => {
    const lang = (ctx.session.language as "ru" | "en" | "pl") || "ru";
    const now = new Date();
    const trialEnds = new Date((ctx.dbUser?.trialStart?.getTime() || now.getTime()) + 24 * 60 * 60 * 1000);
    
    const isPro = !!(ctx.dbUser?.isPro && (!ctx.dbUser?.proEnd || new Date(ctx.dbUser.proEnd) > now));
    const isTrialActive = !isPro && now < trialEnds;
    
    let msg = "";
    if (lang === "ru") {
      msg = `👤 *ВАШ ПЕРСОНАЛЬНЫЙ ПРОФИЛЬ:*\n\n`;
      msg += `🆔 **Ваш ID:** \`${ctx.from?.id}\`\n`;
      msg += `🎭 **Статус:** ${isPro ? "🌟 PRO Пользователь" : isTrialActive ? "⏳ Пробный Период" : "❌ Срок Истек"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `📅 **Активен до:** \`${new Date(ctx.dbUser.proEnd).toLocaleString("ru-RU")}\`\n`;
      } else if (isTrialActive) {
        msg += `📅 **Закончится в:** \`${trialEnds.toLocaleString("ru-RU")}\`\n`;
      }
      if (!isPro) {
        msg += `\n🎁 *СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ:*\nПодпишитесь на наш канал и получите **+7 дней PRO** совершенно бесплатно!`;
      }
    } else if (lang === "pl") {
      msg = `👤 *TWÓJ PROFIL OSOBISTY:*\n\n`;
      msg += `🆔 **Twój ID:** \`${ctx.from?.id}\`\n`;
      msg += `🎭 **Status:** ${isPro ? "🌟 Użytkownik PRO" : isTrialActive ? "⏳ Okres Próbny" : "❌ Subskrypcja Wygasła"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `📅 **Ważne do:** \`${new Date(ctx.dbUser.proEnd).toLocaleString("pl-PL")}\`\n`;
      } else if (isTrialActive) {
        msg += `📅 **Kończy się o:** \`${trialEnds.toLocaleString("pl-PL")}\`\n`;
      }
      if (!isPro) {
        msg += `\n🎁 *OFERTA SPECJALNA:*\nZasubskrybuj nasz kanał i otrzymaj **+7 dni PRO** całkowicie za darmo!`;
      }
    } else {
      msg = `👤 *YOUR PERSONAL PROFILE:*\n\n`;
      msg += `🆔 **Your ID:** \`${ctx.from?.id}\`\n`;
      msg += `🎭 **Status:** ${isPro ? "🌟 PRO User" : isTrialActive ? "⏳ Free Trial" : "❌ Access Expired"}\n`;
      if (isPro && ctx.dbUser?.proEnd) {
        msg += `📅 **Active until:** \`${new Date(ctx.dbUser.proEnd).toLocaleString()}\`\n`;
      } else if (isTrialActive) {
        msg += `📅 **Ends at:** \`${trialEnds.toLocaleString()}\`\n`;
      }
      if (!isPro) {
        msg += `\n🎁 *SPECIAL OFFER:*\nSubscribe to our channel and get **+7 days of PRO** for free!`;
      }
    }
    
    if (!isPro) {
      const inlineKeyboard = new InlineKeyboard()
        .url(lang === "ru" ? "📢 Перейти в канал" : lang === "pl" ? "📢 Przejdź do kanału" : "📢 Go to Channel", "https://t.me/TeleLoadd")
        .row()
        .text(lang === "ru" ? "✅ Я подписался!" : lang === "pl" ? "✅ Zasubskrybowałem!" : "✅ I subscribed!", "check_subscription");
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: inlineKeyboard });
    } else {
      await ctx.reply(msg, { parse_mode: "Markdown" });
    }
  });

  bot.callbackQuery("check_subscription", async (ctx) => {
    const lang = (ctx.session.language as "ru" | "en" | "pl") || "ru";
    if (!ctx.dbUser?.isPro) {
      try {
        // First, try to check the user's membership in the channel
        const member = await ctx.api.getChatMember("@TeleLoadd", ctx.from.id);
        const isMember = ["creator", "administrator", "member"].includes(member.status);

        if (isMember) {
          await storage.setUserPro(ctx.from.id.toString(), true, 7);
          const successMsg = lang === "ru" ? "🎉 *Поздравляем!*\n\nМы проверили подписку. Вам начислено **7 дней PRO-статуса**. Наслаждайтесь!" : 
                             lang === "pl" ? "🎉 *Gratulacje!*\n\nZweryfikowaliśmy subskrypcję. Otrzymałeś **7 dni statusu PRO**. Miłego korzystania!" : 
                             "🎉 *Congratulations!*\n\nWe verified your subscription. You've been granted **7 days of PRO status**. Enjoy!";
          await ctx.answerCallbackQuery(lang === "ru" ? "Бонус начислен! 💎" : "Bonus przyznany! 💎");
          await ctx.editMessageText(successMsg, { parse_mode: "Markdown" });
        } else {
          const failMsg = lang === "ru" ? "❌ *Ошибка!*\n\nВы еще не подписаны на наш канал @TeleLoadd. Пожалуйста, подпишитесь и попробуйте снова." : 
                          lang === "pl" ? "❌ *Błąd!*\n\nNie jesteś jeszcze subskrybentem naszego kanału @TeleLoadd. Zasubskrybuj i spróbuj ponownie." : 
                          "❌ *Error!*\n\nYou are not subscribed to our channel @TeleLoadd yet. Please subscribe and try again.";
          await ctx.answerCallbackQuery(lang === "ru" ? "Подписка не найдена" : "Nie znaleziono subskrypcji");
          await ctx.editMessageText(failMsg, { 
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard()
              .url(lang === "ru" ? "📢 Перейти в канал" : lang === "pl" ? "📢 Przejdź do kanału" : "📢 Go to Channel", "https://t.me/TeleLoadd")
              .row()
              .text(lang === "ru" ? "✅ Я подписался!" : lang === "pl" ? "✅ Zasubskrybowałem!" : "✅ I subscribed!", "check_subscription")
          });
        }
      } catch (e: any) {
        console.error("Chat member check error:", e);
        // If getChatMember failed, try to determine whether the bot has sufficient rights
        try {
          const me = await ctx.api.getMe();
          // Try to get bot membership in the channel
          const botMember = await ctx.api.getChatMember("@TeleLoadd", me.id);
          const botIsAdmin = botMember && (botMember.status === "administrator" || botMember.status === "creator");
          if (!botIsAdmin) {
            const adminMsg = lang === "ru" ?
              "⚠️ Бот не имеет прав администратора в канале @TeleLoadd. Назначьте бота администратором, затем повторите проверку." :
              lang === "pl" ?
                "⚠️ Bot nie ma uprawnień administratora na kanale @TeleLoadd. Nadaj uprawnienia administracyjne i spróbuj ponownie." :
                "⚠️ The bot does not have administrator rights in @TeleLoadd. Please promote the bot to an admin and try again.";
            await ctx.reply(adminMsg);
          } else {
            // Bot is admin but check still failed — likely the user is not a member
            const failMsg = lang === "ru" ?
              "❌ *Ошибка!*\n\nВы еще не подписаны на наш канал @TeleLoadd. Пожалуйста, подпишитесь и попробуйте снова." :
              lang === "pl" ?
                "❌ *Błąd!*\n\nNie jesteś jeszcze subskrybentem naszego kanału @TeleLoadd. Zasubskrybuj i spróbuj ponownie." :
                "❌ *Error!*\n\nYou are not subscribed to our channel @TeleLoadd yet. Please subscribe and try again.";
            await ctx.reply(failMsg, { parse_mode: "Markdown" });
          }
        } catch (innerErr) {
          console.error("Bot membership check error:", innerErr);
          await ctx.answerCallbackQuery(lang === "ru" ? "Ошибка проверки" : "Błąd weryfikacji");
          await ctx.reply(lang === "ru" ? "⚠️ Не удалось проверить подписку. Убедитесь, что бот — администратор канала @TeleLoadd." : 
                           lang === "pl" ? "⚠️ Nie udało się zweryfikować subskrypcji. Upewnij się, że bot jest administratorem kanału @TeleLoadd." :
                           "⚠️ Could not verify subscription. Ensure the bot is an administrator of @TeleLoadd.");
        }
      }
    } else {
      await ctx.answerCallbackQuery(lang === "ru" ? "У вас уже есть PRO статус! ✨" : "Masz уже есть PRO статус! ✨");
    }
  });

  // Handbook / Change Log
  bot.hears(["📖 Справочник", "📖 Handbook", "📖 Przewodnik"], async (ctx) => {
    const lang = (ctx.session.language as "ru" | "en" | "pl") || "ru";
    let msg = "";
    if (lang === "ru") {
      msg = `📖 *СПРАВОЧНИК И ИСТОРИЯ ОБНОВЛЕНИЙ:*\n\n`;
      msg += `📍 **Версия 2.2.0 (Текущая)**\n`;
      msg += `● Улучшено именование аудиофайлов (теперь используются названия из видео).\n`;
      msg += `● Оптимизирован механизм отправки файлов (использование InputFile).\n`;
      msg += `● Исправлено отображение имен пользователей в админ-панели.\n`;
      msg += `● Оптимизировано хранение временных данных в памяти.\n\n`;
      msg += `📍 **Версия 2.1.0**\n`;
      msg += `● Полностью обновлен дизайн текстовых сообщений.\n`;
      msg += `● Добавлена поддержка польского языка.\n`;
      msg += `● Исправлена работа с мобильными ссылками (vm.tiktok).\n`;
      msg += `● Улучшена система выдачи бонусов за подписку.\n`;
      msg += `● Оптимизирована скорость загрузки тяжелых видео.\n\n`;
      msg += `💎 *Будущее:* Скоро добавим поддержку Reels и Shorts!`;
    } else if (lang === "pl") {
      msg = `📖 *PRZEWODNIK I HISTORIA ZMIAN:*\n\n`;
      msg += `📍 **Wersja 2.2.0 (Aktualna)**\n`;
      msg += `● Ulepszone nazewnictwo plików audio.\n`;
      msg += `● Zoptymalizowany mechanizm wysyłania plików.\n`;
      msg += `● Poprawione wyświetlanie nazw użytkowników w panelu.\n`;
      msg += `● Zoptymalizowane przechowywanie danych tymczasowych.\n\n`;
      msg += `📍 **Wersja 2.1.0**\n`;
      msg += `● Całkowicie odświeżono wygląd wiadomości tekstowych.\n`;
      msg += `● Dodano pełne wsparcie dla języka polskiego.\n`;
      msg += `● Naprawiono obsługę linków mobilnych (vm.tiktok).\n`;
      msg += `● Ulepszono system przyznawania bonusów za subskrypcję.\n`;
      msg += `● Zoptymalizowano prędkość pobierania dużych plików.\n\n`;
      msg += `💎 *Przyszłość:* Wkrótce dodamy obsługę Reels i Shorts!`;
    } else {
      msg = `📖 *HANDBOOK & CHANGE LOG:*\n\n`;
      msg += `📍 **Version 2.2.0 (Current)**\n`;
      msg += `● Improved audio file naming (titles from video).\n`;
      msg += `● Optimized file sending mechanism (InputFile).\n`;
      msg += `● Fixed user name display in admin dashboard.\n`;
      msg += `● Optimized memory storage for temporary data.\n\n`;
      msg += `📍 **Version 2.1.0**\n`;
      msg += `● Completely redesigned text message layouts.\n`;
      msg += `● Added full support for the Polish language.\n`;
      msg += `● Fixed issues with mobile links (vm.tiktok).\n`;
      msg += `● Enhanced the bonus system for channel subscribers.\n`;
      msg += `● Optimized download speeds for large video files.\n\n`;
      msg += `💎 *Future:* Reels and Shorts support coming soon!`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // Admin Panel (Bot)
  bot.command("admin", async (ctx) => {
    if (ctx.dbUser?.telegramId === "7248043928") {
       await ctx.reply("⚡️ *АДМИН-ПАНЕЛЬ TELELOAD PRO*\n\nВыберите раздел для управления:", {
         parse_mode: "Markdown",
         reply_markup: adminMenuKeyboard
       });
    } else {
       await ctx.reply("❌ *Ошибка:* Доступ к этой команде разрешен только администраторам.", { parse_mode: "Markdown" });
    }
  });

  bot.callbackQuery("admin_stats", async (ctx) => {
    if (ctx.dbUser?.telegramId !== "7248043928") return;
    const stats = await storage.getStats();
    let msg = `📊 *ДЕТАЛЬНАЯ СТАТИСТИКА СИСТЕМЫ:*\n\n`;
    msg += `👥 **Всего пользователей:** ${stats.totalUsers}\n`;
    msg += `🌟 **PRO-пользователей:** ${stats.proUsers}\n`;
    msg += `📥 **Всего загрузок:** ${stats.totalDownloads}\n`;
    msg += `⏳ **Активных триалов:** ${stats.activeTrials}\n\n`;
    msg += `_Данные обновлены в реальном времени._`;
    
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: adminMenuKeyboard });
  });

  bot.callbackQuery("admin_users", async (ctx) => {
    if (ctx.dbUser?.telegramId !== "7248043928") return;
    const users = await storage.getAllUsers();
    const last5 = users.slice(0, 5);
    
    let msg = `👥 *ПОСЛЕДНИЕ ЗАРЕГИСТРИРОВАННЫЕ ЮЗЕРЫ:*\n\n`;
    last5.forEach(u => {
      msg += `${u.isPro ? "🌟" : "👤"} ${u.firstName || "???"} (@${u.username || "нет"}) — \`${u.telegramId}\`\n`;
    });
    msg += `\n🎁 *Команда для выдачи PRO:*\n\`/setpro [ID] [дни]\``;
    
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(msg, { reply_markup: adminMenuKeyboard, parse_mode: "Markdown" });
  });

  bot.command("setpro", async (ctx) => {
    if (ctx.dbUser?.telegramId !== "7248043928") return;
    const args = ctx.match.split(" ");
    if (args.length < 2) {
      return ctx.reply("❓ *ИНФО:* /setpro [ID] [дни]\n💡 *Пример:* \`/setpro 12345678 30\`", { parse_mode: "Markdown" });
    }
    const [targetId, days] = args;
    try {
      await storage.setUserPro(targetId, true, parseInt(days));
      await ctx.reply(`✅ *Успех!* Пользователю \`${targetId}\` выдано PRO на ${days} дней.`, { parse_mode: "Markdown" });
      await ctx.api.sendMessage(targetId, "🎊 *УРА!* Вам активирована подписка **PRO**! Теперь вы можете качать любые видео без ограничений.", { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.reply("❌ *Ошибка:* Пользователь не найден или данные некорректны.", { parse_mode: "Markdown" });
    }
  });

  bot.callbackQuery("admin_close", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.deleteMessage();
    } catch (e) {
      console.warn("Could not delete message during close");
    }
  });

  // Audio download callback handler (simplified version)
  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (data && data.startsWith("dl_audio_")) {
      const id = data.replace("dl_audio_", "");
      const lang = ctx.session.language || "ru";
      await ctx.answerCallbackQuery(lang === "ru" ? "⏳ Подготовка аудио..." : lang === "pl" ? "⏳ Przygotowywanie dźwięku..." : "⏳ Preparing audio...");

      const entry = audioStore.get(id);
      if (!entry) {
        await ctx.reply(lang === "ru" ? "❌ Ссылка устарела. Попробуйте заново." : lang === "pl" ? "❌ Link wygasł. Spróbuj ponownie." : "❌ Link expired. Try again.");
        return;
      }

      const videoUrl = entry.videoUrl;
      const safeTitle = entry.title || id;
      const tmpDir = path.join(process.cwd(), "tmp");
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch (e) {
        // ignore
      }

      const videoPath = path.join(tmpDir, `${id}.mp4`);
      const audioPath = path.join(tmpDir, `${id}.mp3`);

      try {
        if (!ffmpegAvailable) {
          console.warn("ffmpeg not available; cannot create audio");
          await ctx.reply(lang === "ru" ? "⚠️ На сервере не установлен ffmpeg. Установите ffmpeg или добавьте пакет `ffmpeg-static` и попробуйте снова." : lang === "pl" ? "⚠️ Na serwerze nie ma ffmpeg. Zainstaluj ffmpeg lub dodaj pakiet `ffmpeg-static` i spróbuj ponownie." : "⚠️ ffmpeg is not installed on the server. Install ffmpeg or add `ffmpeg-static` and try again.");
          return;
        }

        const response = await axios.get(videoUrl, { responseType: "stream", timeout: 60000 });
        await streamPipeline(response.data, fs.createWriteStream(videoPath));

        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .noVideo()
            .audioCodec("libmp3lame")
            .audioBitrate(128)
            .format("mp3")
            .on("end", () => resolve())
            .on("error", (err: any) => reject(err))
            .save(audioPath);
        });

        const caption = lang === "ru" ? "🔊 Аудио из видео" : lang === "pl" ? "🔊 Dźwięк z filmu" : "🔊 Audio from video";
        const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.callbackQuery?.from?.id;
        
        if (!chatId) throw new Error("Could not find chat ID");

        await ctx.api.sendAudio(chatId, new InputFile(audioPath, `${safeTitle}.mp3`), { caption });
      } catch (err) {
        console.error("Audio extraction error:", err);
        await ctx.reply(lang === "ru" ? "❌ Ошибка при создании аудио. Попробуйте позже." : lang === "pl" ? "❌ Błąd podczas tworzenia dźwięku. Spróbuj później." : "❌ Failed to create audio. Try again later.");
      } finally {
        try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch (e) {}
        try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (e) {}
        audioStore.delete(id);
      }

      return;
    }
    await next();
  });

  // Main Message Handler (Downloads)
  bot.on("message:text", async (ctx) => {
    if (!ctx.dbUser || !ctx.chat) return;
    const lang = ctx.session.language || "ru";
    const text = ctx.message.text;

    const tiktokRegex = /https?:\/\/(www\.)?tiktok\.com\/[^\s]+|https?:\/\/vm\.tiktok\.com\/[^\s]+|https?:\/\/vt\.tiktok\.com\/[^\s]+/;
    const match = text.match(tiktokRegex);

    if (match) {
      const url = match[0];
      const isPro = !!(ctx.dbUser.isPro && (!ctx.dbUser.proEnd || new Date(ctx.dbUser.proEnd) > new Date()));
      const trialEnds = new Date((ctx.dbUser.trialStart?.getTime() || Date.now()) + 24 * 60 * 60 * 1000);
      const isTrialActive = new Date() < trialEnds;

      if (!isPro && !isTrialActive) {
        const expiredMsg = lang === "ru" ? "⚠️ *Ваш доступ ограничен.*\n\nПробный период закончился. Пожалуйста, приобретите PRO для продолжения работы." : 
                           lang === "pl" ? "⚠️ *Twój dostęp jest ograniczony.*\n\nOkres próbny się skończył. Proszę kupić PRO, aby kontynuować." :
                           "⚠️ *Your access is limited.*\n\nFree trial has expired. Please upgrade to PRO to continue.";
        await ctx.reply(expiredMsg, {
          parse_mode: "Markdown",
          reply_markup: lang === "ru" ? upgradeInlineRU : (lang === "pl" ? upgradeInlinePL : upgradeInlineEN)
        });
        return;
      }

      const processingMsg = await ctx.reply(
        lang === "ru" ? "🔗 *Ссылка обнаружена!* Начинаю магию..." : 
        lang === "pl" ? "🔗 *Link wykryty!* Rozpoczynam magię..." : 
        "🔗 *Link detected!* Starting the magic..."
      );
      
      try {
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, 
          lang === "ru" ? "⏳ *Получаю данные видео...*" : 
          lang === "pl" ? "⏳ *Pobieranie metadanych...*" : 
          "⏳ *Fetching metadata...*", 
          { parse_mode: "Markdown" }
        );
        
        const apis = [
          `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
          `https://tikwm.com/api/?url=${encodeURIComponent(url)}`
        ];
        
        let videoUrl = null;
        let images = null;
        let title = "";

        for (const api of apis) {
          try {
            const response = await axios.get(api, { timeout: 15000 });
            if (api.includes("tiklydown")) {
              if (response.data?.video?.noWatermark) {
                videoUrl = response.data.video.noWatermark;
                title = response.data.video.title || "";
                break;
              }
              if (response.data?.images) {
                images = response.data.images;
                title = response.data.title || "";
                break;
              }
            } else if (api.includes("tikwm")) {
              if (response.data?.data?.play) {
                videoUrl = response.data.data.play.startsWith("http") 
                  ? response.data.data.play 
                  : `https://tikwm.com${response.data.data.play}`;
                title = response.data.data.title || "";
                break;
              }
              if (response.data?.data?.images) {
                images = response.data.data.images;
                title = response.data.data.title || "";
                break;
              }
            }
          } catch (e) {
            console.warn(`API ${api} failed, trying next...`);
          }
        }
        
        if (images && images.length > 0) {
          await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, 
            lang === "ru" ? "📸 *Отправляю фото-карусель...*" : 
            lang === "pl" ? "📸 *Wysyłanie karuzeli zdjęć...*" : 
            "📸 *Sending photo carousel...*", 
            { parse_mode: "Markdown" }
          );
          const mediaGroup = images.map((img: any, idx: number) => ({
            type: "photo",
            media: typeof img === "string" ? img : (img.url || img),
            caption: idx === 0 ? title : undefined
          }));
          
          // Telegram media group limit is 10
          const chunks = [];
          for (let i = 0; i < mediaGroup.length; i += 10) {
            chunks.push(mediaGroup.slice(i, i + 10));
          }
          
          for (const chunk of chunks) {
            await ctx.replyWithMediaGroup(chunk);
          }
          
          await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
          return;
        }
        
        if (!videoUrl) throw new Error("Could not get video URL");

        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, 
          lang === "ru" ? "🚀 *Отправляю видеофайл...*" : 
          lang === "pl" ? "🚀 *Wysyłanie pliku wideo...*" : 
          "🚀 *Sending video file...*", 
          { parse_mode: "Markdown" }
        );
        
        const hashtags = title?.match(/#\w+/g)?.join(" ") || "";
        const cleanTitle = title?.replace(/#\w+/g, "").trim() || "";

        const caption = lang === "ru" ? `✅ *Скачано через @${bot.botInfo.username}*\n${cleanTitle ? `📝 ${cleanTitle}\n` : ""}${hashtags ? `${hashtags}\n` : ""}💎 *Статус:* ${isPro ? "PRO" : "Trial"}` : 
                        lang === "pl" ? `✅ *Pobrano przez @${bot.botInfo.username}*\n${cleanTitle ? `📝 ${cleanTitle}\n` : ""}${hashtags ? `${hashtags}\n` : ""}💎 *Status:* ${isPro ? "PRO" : "Okres próbny"}` : 
                        `✅ *Downloaded via @${bot.botInfo.username}*\n${cleanTitle ? `📝 ${cleanTitle}\n` : ""}${hashtags ? `${hashtags}\n` : ""}💎 *Status:* ${isPro ? "PRO" : "Trial"}`;

        const audioId = crypto.randomBytes(6).toString("hex");
        // sanitize title for filename
        const safeTitle = (cleanTitle || "audio")
          .replace(/[^\w\sа-яА-Я]/gi, "")
          .substring(0, 50)
          .trim() || "audio";
        
        audioStore.set(audioId, { videoUrl, createdAt: Date.now(), title: safeTitle });

        await ctx.replyWithVideo(videoUrl, {
          caption: caption.substring(0, 1024), // Telegram caption limit
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard().text(
            lang === "ru" ? "🎵 Извлечь музыку" : lang === "pl" ? "🎵 Pobierz dźwięk" : "🎵 Extract Music",
            `dl_audio_${audioId}`
          )
        });
        
        await storage.createDownload({
          userId: ctx.dbUser.id,
          videoUrl,
          isWatermarked: !isPro
        });

        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);

      } catch (err) {
        console.error("Download error:", err);
        const errorMsg = lang === "ru" ? "❌ *Ошибка!* Не удалось скачать видео. Попробуйте другую ссылку или позже." : 
                         lang === "pl" ? "❌ *Błąd!* Nie удалось pobrać wideo. Spróbuj innego linku lub spróbuj później." : 
                         "❌ *Error!* Could not download video. Try another link or later.";
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, errorMsg, { parse_mode: "Markdown" });
      }
    }
  });

  // initialize bot (fills bot.botInfo)
  try {
    await bot.init();
  } catch (e) {
    console.warn("Failed to init bot:", e);
  }

  const mode = (process.env.TELEGRAM_BOT_MODE || process.env.BOT_MODE || "polling").toLowerCase();
  if (mode === "polling") {
    try {
      try {
        await bot.api.setWebhook("", { drop_pending_updates: true });
      } catch (e) {
        try {
          await bot.api.setWebhook("");
        } catch (_) {
          // ignore
        }
      }
    } catch (e) {
      console.warn("Could not clear webhook before polling:", e);
    }

    // start polling but don't await so function can return the bot instance
    bot.start({ onStart: () => console.log("Bot started!") }).catch((e) => console.error("Bot polling error:", e));
  } else {
    console.log("Bot initialized in webhook mode; not starting polling.");
  }

  return bot;
}
