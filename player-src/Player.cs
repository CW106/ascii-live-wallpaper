// ASCII 桌布播放器：把網頁桌布放到桌面圖示後面，每個螢幕各自一張。
// 不需要安裝任何東西：用 Windows 內建的 .NET Framework 4.8 編譯器建置（見 build.bat），
// 用 Microsoft Edge 顯示桌布頁面，再把 Edge 視窗放進桌面的桌布層。
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AsciiWallpaper
{
    static class Program
    {
        public const int Port = 17321;
        public static readonly string Origin = "http://127.0.0.1:" + Port;
        public static string AppName { get { return I18n.T("ASCII 桌布播放器", "ASCII Wallpaper Player"); } }
        public const string ManagerFile = "ASCII動態桌布.html";
        // 管理介面網頁的標題（中文 / 英文），也是它的應用程式視窗標題、捷徑名稱
        public static readonly string[] ManagerTitles = { "ASCII 動態桌布", "ASCII Live Wallpaper" };
        public static string ManagerTitle { get { return I18n.T(ManagerTitles[0], ManagerTitles[1]); } }
        public static string DataDir, WallDir, EdgeProfile, AppProfile, SavedDir, LogPath, AppDir;
        static Mutex single;

        // 參數 /open：同時打開管理介面（桌面捷徑用）；沒有參數（開機自動啟動）時只在背景播放桌布
        [STAThread]
        static void Main(string[] args)
        {
            // 必須在建立任何視窗之前設定，座標才會是實際像素（多螢幕、縮放比例不同時才準）
            try { Native.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (Exception) { }
            AppDir = AppDomain.CurrentDomain.BaseDirectory;
            DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ASCIIWallpaper");
            WallDir = Path.Combine(DataDir, "walls");
            EdgeProfile = Path.Combine(DataDir, "edge-profile");
            AppProfile = Path.Combine(DataDir, "app-profile");   // 管理介面專用的瀏覽器設定檔（沒有擴充功能）
            SavedDir = Path.Combine(DataDir, "saved");           // 我的收藏
            LogPath = Path.Combine(DataDir, "player.log");
            bool open = args.Any(a => a.Equals("/open", StringComparison.OrdinalIgnoreCase) || a.Equals("--open", StringComparison.OrdinalIgnoreCase));
            bool autostart = args.Any(a => a.Equals("/autostart", StringComparison.OrdinalIgnoreCase));
            if (args.Any(a => a.Equals("/shortcuts", StringComparison.OrdinalIgnoreCase)))
            {
                // 建立（或更新）桌面與開始功能表的「ASCII 動態桌布」捷徑，然後結束（名稱跟著介面語言）
                LoadLang();
                string err = Shortcuts.Create();
                if (err != null) MessageBox.Show(I18n.T("建立捷徑失敗：", "Could not create the shortcuts: ") + err, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            bool created;
            single = new Mutex(true, "AsciiWallpaperPlayer.SingleInstance", out created);
            if (!created) { if (!autostart) RequestOpen(); return; } // 播放器已經在執行：請它打開（或叫出）管理介面（開機自動啟動時不必）
            Directory.CreateDirectory(WallDir);
            Directory.CreateDirectory(SavedDir);
            CleanLeftovers();
            StartWatchdog();
            Log("==== start " + Application.ExecutablePath);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => Log("UI exception: " + e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => Log("fatal: " + e.ExceptionObject);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Autostart.Refresh(); // 舊版寫入的自動啟動指令沒有 /autostart（或程式搬了位置）：更新成目前的
            var app = new PlayerApp(open, autostart);
            if (app.Ok) Application.Run(app);
            GC.KeepAlive(single);
        }

        // 第二次啟動（例如再點一次桌面捷徑）：請已經在執行的播放器打開管理介面。
        // 先允許它把視窗帶到最前面（使用者剛點的是我們，前景權限在我們這裡）
        static void RequestOpen()
        {
            try { Native.AllowSetForegroundWindow(-1 /* ASFW_ANY */); } catch (Exception) { }
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(Origin + "/api/open");
                req.Method = "POST";
                req.Proxy = null;
                req.Headers["X-ASCII-WP"] = "1";
                req.ContentLength = 0;
                req.Timeout = 20000;
                using (var res = (HttpWebResponse)req.GetResponse()) if (res.StatusCode == HttpStatusCode.OK) return;
            }
            catch (Exception e) { Log("open request failed: " + e.Message); }
            // 播放器沒回應：自己開。這個程序沒有建立 PlayerApp，先從設定檔讀出介面語言，視窗在工作列上的名稱才會對
            LoadLang();
            OpenCleanManager();
            TaskbarId.WaitPending(15000);
        }

        // 沒有 PlayerApp 的程序（/shortcuts、第二次啟動）用：介面語言照設定檔（讀不到就是自動）
        static void LoadLang() { I18n.SetPref(Settings.Load().Lang); }

        // 管理介面用自己的瀏覽器視窗開（專用設定檔、沒有擴充功能、沒有網址列和分頁，工作列上有自己的圖示）。
        // 已經開著就把那個視窗叫到前面，不會越開越多
        public static void OpenCleanManager()
        {
            try
            {
                IntPtr h = Browser.FindManagerWindow();
                if (h != IntPtr.Zero) { TaskbarId.Stamp(h); Native.BringToFront(h); return; }
                if (TaskbarId.Launching) return; // 剛啟動的視窗還在載入：出現後會自己跑到前面，不要再開一個
                if (Browser.LaunchCleanApp(Origin + "/")) { TaskbarId.StampWhenReady(); return; }
            }
            catch (Exception e) { Log("open manager window failed: " + e.Message); }
            try { Process.Start(Origin + "/"); } catch (Exception e) { Log("open manager failed: " + e.Message); }
        }

        // 記錄檔：拿不到鎖（別的執行緒卡在寫檔）時另外寫到 player.log.stuck；寫入失敗也留下痕跡，不會整段消失
        static readonly object logLock = new object();
        public static void Log(string msg)
        {
            if (LogPath == null) return;
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff ") + msg + Environment.NewLine;
            bool locked = false;
            try
            {
                Monitor.TryEnter(logLock, 3000, ref locked);
                if (!locked) { File.AppendAllText(LogPath + ".stuck", line, Encoding.UTF8); return; }
                // 超過 1 MB 就換一個新檔（保留上一份為 player.log.1），長時間執行也不會一直變大
                var fi = new FileInfo(LogPath);
                if (fi.Exists && fi.Length > 1024 * 1024)
                {
                    string old = LogPath + ".1";
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(LogPath, old);
                }
                File.AppendAllText(LogPath, line, Encoding.UTF8);
            }
            catch (Exception e) { try { File.AppendAllText(LogPath + ".err", line + "  (log write failed: " + e.Message + ")" + Environment.NewLine, Encoding.UTF8); } catch (Exception) { } }
            finally { if (locked) Monitor.Exit(logLock); }
        }

        // 上次寫到一半被中斷時留下的暫存檔（*.tmp）、只剩 .bin 沒有 .json 的收藏檔：啟動時清掉
        static void CleanLeftovers()
        {
            try
            {
                foreach (var dir in new[] { WallDir, SavedDir, DataDir })
                    foreach (var f in Directory.GetFiles(dir, "*.tmp")) { try { File.Delete(f); } catch (Exception) { } }
                foreach (var bin in Directory.GetFiles(SavedDir, "*.bin"))
                    if (!File.Exists(Path.ChangeExtension(bin, ".json"))) { try { File.Delete(bin); Log("removed orphan " + Path.GetFileName(bin)); } catch (Exception) { } }
            }
            catch (Exception e) { Log("cleanup failed: " + e.Message); }
        }

        // 看門狗：UI 執行緒卡住超過 20 秒就寫進記錄檔（附上卡住時正在做的事），恢復時也記一筆，方便之後查原因
        public static volatile string Op = "";
        static volatile int uiBeat = Environment.TickCount;
        public static void Beat() { uiBeat = Environment.TickCount; }
        static void StartWatchdog()
        {
            new Thread(() =>
            {
                bool stalled = false;
                while (true)
                {
                    int t0 = Environment.TickCount;
                    Thread.Sleep(5000);
                    // 睡了比預期久很多 = 電腦剛從睡眠 / 休眠回來（TickCount 在睡眠時照樣累加）：重新起算，不要誤報
                    if (unchecked(Environment.TickCount - t0) > 15000) { uiBeat = Environment.TickCount; stalled = false; continue; }
                    int age = unchecked(Environment.TickCount - uiBeat);
                    if (!stalled && age > 20000) { stalled = true; Log("UI thread stalled for " + age / 1000 + " s during: " + Op); }
                    else if (stalled && age < 5000) { stalled = false; Log("UI thread recovered"); }
                }
            }) { IsBackground = true, Name = "watchdog" }.Start();
        }
    }

    // ───────────────────────── 介面語言 ─────────────────────────
    // 設定 Lang：""＝自動（跟著 Windows 的顯示語言：中文 → zh，其他語言 → en），或固定 "zh" / "en"。
    // 系統匣、提示、對話框和回給管理介面的錯誤訊息都用「實際語言」（zh / en）；記錄檔維持中文
    static class I18n
    {
        static volatile string pref = "";     // "" / "zh" / "en"
        static volatile string lang = "zh";   // 實際使用的語言
        static volatile string system;        // Windows 顯示語言換算出來的 zh / en（快取；要登出才會變）

        [DllImport("kernel32.dll")] static extern ushort GetUserDefaultUILanguage();

        public static string Lang { get { return lang; } }
        public static string Pref { get { return pref; } }
        public static string PrefName { get { return pref == "" ? "auto" : pref; } }   // /api/status 的 langPref
        public static bool En { get { return lang == "en"; } }
        public static string T(string zh, string en) { return lang == "en" ? en : zh; }

        // 設定檔裡的值：不認得的（null、舊版沒有、手改壞了）一律當作自動
        public static string Normalize(string v) { return v == "zh" || v == "en" ? v : ""; }
        // /api/lang 的 v：auto / zh / en → "" / "zh" / "en"；其他值回傳 null（400）
        public static string ParsePref(string v) { return v == "auto" ? "" : v == "zh" || v == "en" ? v : null; }
        // 設定 + 系統語言 → 實際語言
        public static string Resolve(string p, string systemLang) { p = Normalize(p); return p != "" ? p : systemLang == "zh" ? "zh" : "en"; }
        // 語言名稱（zh-TW、zh-Hant-HK、en-US…）或 LANGID（主要語言 0x04 = 中文）→ zh / en
        public static string FromCultureName(string name) { return name != null && name.StartsWith("zh", StringComparison.OrdinalIgnoreCase) ? "zh" : "en"; }
        public static string FromLangId(int id) { return (id & 0x3FF) == 0x04 /* LANG_CHINESE */ ? "zh" : "en"; }

        public static string SystemLang()
        {
            string s = system;
            if (s != null) return s;
            try { int id = GetUserDefaultUILanguage(); if (id != 0) s = FromLangId(id); } catch (Exception) { }
            if (s == null) { try { s = FromCultureName(System.Globalization.CultureInfo.CurrentUICulture.Name); } catch (Exception) { s = "en"; } }
            return system = s;
        }

        // 套用設定；回傳實際語言有沒有改變
        public static bool SetPref(string p)
        {
            pref = Normalize(p);
            string old = lang;
            lang = Resolve(pref, SystemLang());
            return old != lang;
        }

        // 桌布標題：目前語言的那一個，沒有就用另一個
        public static string Pick(string zh, string en)
        {
            if (En) return string.IsNullOrEmpty(en) ? zh : en;
            return string.IsNullOrEmpty(zh) ? en : zh;
        }

        // /api/apply 收到的標題 → 要存的中文標題（一定有值：Walls 用它判斷螢幕有沒有桌布）和英文標題（"" = 沒有）
        public static void WallTitles(string title, string titleEn, out string zh, out string en)
        {
            zh = title ?? ""; en = titleEn ?? "";
            if (zh == "" && en == "") { zh = "動態桌布"; en = "Live Wallpaper"; }
            else if (zh == "") zh = en;
        }
    }

    // ───────────────────────── 設定 ─────────────────────────
    class Settings
    {
        public int Schema = 2;
        public Dictionary<string, string> Walls = new Dictionary<string, string>(); // 螢幕 id → 桌布標題
        public Dictionary<string, string> WallsEn = new Dictionary<string, string>(); // 螢幕 id → 桌布的英文標題（沒有就顯示 Walls 的標題）
        public string Lang = "";               // 介面語言：""＝自動、"zh"、"en"（舊設定檔沒有這一項 → 自動）
        public bool AutoPause = true;
        public bool Paused = false;
        public bool Sound = true;              // 桌布音效（舊設定檔沒有這一項 → 開）
        public bool ManagerMigrated = false;   // 舊版存在瀏覽器裡的收藏已經搬到播放器
        public Dictionary<string, string> WallBounds = new Dictionary<string, string>(); // 螢幕 id → 上次看到的位置大小（識別碼變了時用來對回原本的桌布）
        public List<string> KnownMonitors;     // 出現過的螢幕識別碼（null = 舊設定檔，第一次啟動時補上）
        public Dictionary<string, string> AdoptedFrom = new Dictionary<string, string>(); // 新識別碼 → 沿用了哪個舊識別碼的桌布

        static string FilePath { get { return Path.Combine(Program.DataDir, "settings.json"); } }

        public static Settings Load()
        {
            try
            {
                if (File.Exists(FilePath))
                {
                    string text = File.ReadAllText(FilePath, Encoding.UTF8);
                    var s = new JavaScriptSerializer().Deserialize<Settings>(text);
                    if (s != null)
                    {
                        if (s.Walls == null) s.Walls = new Dictionary<string, string>();
                        if (s.WallsEn == null) s.WallsEn = new Dictionary<string, string>();
                        s.Lang = I18n.Normalize(s.Lang);
                        if (s.WallBounds == null) s.WallBounds = new Dictionary<string, string>();
                        if (s.AdoptedFrom == null) s.AdoptedFrom = new Dictionary<string, string>();
                        if (!text.Contains("\"Schema\"")) s.Schema = 1; // 舊版設定檔
                        return s;
                    }
                }
            }
            catch (Exception e) { Program.Log("settings load failed: " + e.Message); }
            return new Settings();
        }

        public void Save()
        {
            try
            {
                Files.WriteAtomic(FilePath, Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(this)));
            }
            catch (Exception e) { Program.Log("settings save failed: " + e.Message); }
        }
    }

    // ───────────────────────── 螢幕 ─────────────────────────
    class Mon
    {
        public string Id;          // 穩定的螢幕識別碼（由螢幕硬體路徑算出，Windows 重新編號 DISPLAYn 也不會變）
        public string Device;      // 例如 \\.\DISPLAY1
        public int Index;          // 顯示用編號（主螢幕為 1）
        public bool Primary;
        public Rectangle Bounds;   // 實際像素
        public Rectangle Work;     // 扣掉工作列的範圍

        public string Label { get { return I18n.T("螢幕 " + Index + (Primary ? "（主）" : ""), "Monitor " + Index + (Primary ? " (primary)" : "")); } }

        public static List<Mon> All()
        {
            var list = new List<Mon>();
            var screens = Screen.AllScreens.OrderByDescending(s => s.Primary).ThenBy(s => s.Bounds.X).ThenBy(s => s.Bounds.Y).ToList();
            for (int i = 0; i < screens.Count; i++)
                list.Add(new Mon { Id = StableId(screens[i].DeviceName), Device = screens[i].DeviceName, Index = i + 1, Primary = screens[i].Primary, Bounds = screens[i].Bounds, Work = screens[i].WorkingArea });
            // 極少數情況兩個螢幕算出同一個 id（例如兩台同型號、沒有序號）：加上編號區分
            foreach (var g in list.GroupBy(m => m.Id).Where(g => g.Count() > 1).ToList())
                foreach (var m in g.Skip(1)) m.Id += "x" + m.Index;
            return list;
        }

        static string StableId(string device)
        {
            string key = device;
            var dd = new Native.DISPLAY_DEVICE { cb = Marshal.SizeOf(typeof(Native.DISPLAY_DEVICE)) };
            if (Native.EnumDisplayDevices(device, 0, ref dd, 1 /* EDD_GET_DEVICE_INTERFACE_NAME */) && !string.IsNullOrEmpty(dd.DeviceID)) key = dd.DeviceID;
            using (var sha = SHA1.Create())
            {
                var h = sha.ComputeHash(Encoding.UTF8.GetBytes(key.ToUpperInvariant()));
                return "M" + BitConverter.ToString(h, 0, 5).Replace("-", "");
            }
        }
    }

    // 一個螢幕上的動態桌布（一個 Edge 視窗 + 一個容器視窗）
    class Surface
    {
        public Mon Mon;
        public IntPtr Hwnd = IntPtr.Zero;   // Edge 視窗
        public double FitLeft = -1, FitTop = -1; // 頁面回報的邊框寬、標題列高度（DIP）；-1 = 還沒回報
        public HostWindow Host;             // 和螢幕一樣大的容器：裁掉 Edge 自己畫的標題列與邊框
        public bool Embedded;
        public bool Pending;                // 已經叫 Edge 開視窗、還在等它出現
        public bool GaveUp;
        public DateTime LaunchedAt, CheckedAt;
        public int Fails;
        public bool AutoPaused;
        public bool Covered;                // 被最大化 / 全螢幕視窗蓋住超過 PauseAfterSec（自動暫停關掉時也算：照常播放，但不發聲）
        public DateTime CoveredSince = DateTime.MinValue; // 從何時開始一直被蓋住（防抖）；MinValue = 目前沒被蓋住
        public string Title = "";
        public string Token { get { return "ASCIIWP-" + Mon.Id; } }
        public string WallFile { get { return Files.WallPath(Mon.Id); } }
        public bool HostAlive { get { return Host != null && Host.Handle != IntPtr.Zero && Native.IsWindow(Host.Handle); } }
    }

    static class Files
    {
        public static string WallPath(string id) { return Path.Combine(Program.WallDir, id + ".html"); }

        // 以「先寫暫存檔再取代」的方式更新，讀取中的請求不會讀到一半的檔案
        public static void ReplaceInto(string tmp, string dest)
        {
            for (int i = 0; ; i++)
            {
                try
                {
                    if (File.Exists(dest)) File.Replace(tmp, dest, null, true); else File.Move(tmp, dest);
                    return;
                }
                catch (IOException) { if (i >= 8) throw; Thread.Sleep(120); }
                catch (UnauthorizedAccessException) { if (i >= 8) throw; Thread.Sleep(120); }
            }
        }

        public static void WriteAtomic(string dest, byte[] data) { WriteAtomic(dest, data, 0, data.Length); }
        public static void WriteAtomic(string dest, byte[] data, int off, int len)
        {
            string tmp = dest + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                using (var fs = new FileStream(tmp, FileMode.CreateNew, FileAccess.Write)) { fs.Write(data, off, len); fs.Flush(true); } // 確實寫進磁碟，當機也不會留下空檔案
                ReplaceInto(tmp, dest);
            }
            finally { try { if (File.Exists(tmp)) File.Delete(tmp); } catch (Exception) { } }
        }

        public static byte[] ReadShared(string path)
        {
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                var buf = new byte[fs.Length];
                int off = 0;
                while (off < buf.Length) { int n = fs.Read(buf, off, buf.Length - off); if (n <= 0) break; off += n; }
                return buf;
            }
        }

        public static string Version(string id)
        {
            string p = WallPath(id);
            return File.Exists(p) ? File.GetLastWriteTimeUtc(p).Ticks.ToString() : "0";
        }
    }

    // ───────────────────────── 主程式 ─────────────────────────
    class PlayerApp : ApplicationContext
    {
        public bool Ok = true;
        readonly NotifyIcon tray = new NotifyIcon();
        readonly ContextMenuStrip menu = new ContextMenuStrip();
        readonly MsgForm msg;
        readonly Dictionary<string, Surface> surfaces = new Dictionary<string, Surface>();
        readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer displayDebounce = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer checkSoon = new System.Windows.Forms.Timer();   // 視窗事件之後馬上重新判斷要不要暫停
        readonly List<IntPtr> winHooks = new List<IntPtr>();
        Native.WinEventProc winEventProc;   // 留著參考，回呼函式才不會被回收
        Dictionary<string, IntPtr> coverBy = new Dictionary<string, IntPtr>(); // 螢幕 → 目前蓋住它的視窗
        IntPtr lastUserFg;                  // 使用者最後在用的視窗（不含我們的 Edge 和桌面）
        readonly Settings settings;
        readonly HttpServer server;
        List<Mon> monitors = new List<Mon>();
        int tickCount;
        bool exiting;
        uint shellPid;

        public PlayerApp(bool openManager, bool autostart)
        {
            msg = new MsgForm(this);
            settings = Settings.Load();
            I18n.SetPref(settings.Lang);
            Hub.SetSound(settings.Sound); // 在 HTTP 伺服器開始接受請求之前就定好，頁面第一次詢問就拿到正確的值
            Hub.SetLang(I18n.Lang);
            Program.Log("lang = " + I18n.PrefName + " -> " + I18n.Lang);
            server = new HttpServer(this);
            if (!server.Start())
            {
                MessageBox.Show(I18n.T("無法啟動：連接埠 " + Program.Port + " 已被其他程式使用。", "Cannot start: port " + Program.Port + " is already in use by another program."),
                    Program.AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Ok = false;
                return;
            }
            if (!File.Exists(Edge.ExePath()))
            {
                MessageBox.Show(I18n.T("找不到 Microsoft Edge，播放器需要 Edge 來顯示桌布。", "Microsoft Edge was not found. The player needs Edge to show wallpapers."),
                    Program.AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                server.Stop();
                Ok = false;
                return;
            }
            shellPid = Native.ShellPid();
            tray.Icon = MakeIcon();
            tray.Text = Program.AppName;
            tray.ContextMenuStrip = menu;
            menu.Opening += (s, e) => BuildMenu();
            tray.DoubleClick += (s, e) => Safe("OpenManager", OpenManager);
            tray.Visible = true;

            monitors = Mon.All();
            MigrateIds();
            BuildMenu();
            Desktop.SpawnLayer(true);

            SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
            msg.WatchAway(); // 鎖定 / 解鎖、螢幕關閉 / 開啟的通知（見 SetAway）；註冊後系統會馬上送一次目前的螢幕狀態
            displayDebounce.Interval = 1500;
            displayDebounce.Tick += (s, e) => { displayDebounce.Stop(); Safe("SyncMonitors", SyncMonitors); };
            timer.Interval = 250;
            timer.Tick += (s, e) => Safe("Tick", Tick);
            timer.Start();
            HookWindowEvents();
            InputForward.Start();
            Safe("SyncMonitors", SyncMonitors);
            if (openManager || (settings.Walls.Count == 0 && !autostart)) Safe("OpenManager", OpenManager);
            if (settings.Walls.Count == 0)
                tray.ShowBalloonTip(5000, Program.AppName, I18n.T("已在系統匣執行。在管理介面按「🖥 設為桌布」就能套用動態桌布。",
                    "Running in the system tray. Click \"🖥 Set as Wallpaper\" in the manager to apply a live wallpaper."), ToolTipIcon.Info);
        }

        static void Safe(string what, Action a)
        {
            Program.Op = what;
            try { a(); } catch (Exception e) { Program.Log(what + " failed: " + e); }
            finally { Program.Op = "idle"; }
        }

        // ── 由 HTTP 執行緒呼叫：切回 UI 執行緒執行（有逾時，UI 卡住時不會拖垮伺服器） ──
        public T Ui<T>(Func<T> f)
        {
            Func<T> run = () => { Program.Op = "http request"; try { return f(); } finally { Program.Op = "idle"; } };
            IAsyncResult ar = msg.BeginInvoke(run);
            if (!ar.AsyncWaitHandle.WaitOne(15000)) throw new TimeoutException(I18n.T("播放器忙碌中，請稍後再試", "The player is busy, please try again later"));
            return (T)msg.EndInvoke(ar);
        }

        // 舊版用 DISPLAYn 當 id；改成穩定 id 時把設定和檔案搬過去
        void MigrateIds()
        {
            if (settings.Schema >= 2) return;
            foreach (var key in settings.Walls.Keys.ToList())
            {
                var m = monitors.FirstOrDefault(x => x.Device.EndsWith("\\" + key, StringComparison.OrdinalIgnoreCase));
                if (m == null || m.Id == key) continue;
                try
                {
                    string from = Files.WallPath(key), to = Files.WallPath(m.Id);
                    if (File.Exists(from)) { if (File.Exists(to)) File.Delete(to); File.Move(from, to); }
                    settings.Walls[m.Id] = settings.Walls[key];
                    settings.Walls.Remove(key);
                    string en;
                    if (settings.WallsEn.TryGetValue(key, out en)) { settings.WallsEn[m.Id] = en; settings.WallsEn.Remove(key); }
                    Program.Log("migrated " + key + " -> " + m.Id);
                }
                catch (Exception e) { Program.Log("migrate " + key + " failed: " + e.Message); }
            }
            settings.Schema = 2;
            settings.Save();
        }

        void OnDisplayChanged(object sender, EventArgs e)
        {
            // Explorer 也會因為同一個事件移動桌面視窗：等一下再重新排版，順序才不會錯
            msg.BeginInvoke(new Action(() => { Program.Log("display settings changed"); displayDebounce.Stop(); displayDebounce.Start(); }));
        }

        // 打開管理介面。舊版把收藏存在瀏覽器裡：還沒搬過的話，先用那個瀏覽器設定檔開一次（網址帶 #migrate），
        // 頁面把收藏搬到播放器後會呼叫 /api/saved/migrated，之後就一律用乾淨、沒有擴充功能的應用程式視窗
        int legacyLaunches;
        DateTime legacyAt = DateTime.MinValue;
        public void OpenManager()
        {
            Program.Op = "open-manager";
            if (!settings.ManagerMigrated)
            {
                // 搬家用的瀏覽器視窗剛開過（還在載入、搬移中）：不要再開一個
                if ((DateTime.Now - legacyAt).TotalSeconds < 60) return;
                bool launched = false, failed = false;
                if (legacyLaunches < 2)
                {
                    try { launched = Browser.LaunchLegacyForMigration(Program.Origin + "/#migrate"); }
                    catch (Exception e) { failed = true; Program.Log("open old browser to move saved items failed: " + e.Message); }
                }
                if (launched) { legacyLaunches++; legacyAt = DateTime.Now; return; }
                if (!failed && legacyLaunches == 0) { settings.ManagerMigrated = true; settings.Save(); } // 沒有舊收藏要搬
            }
            Program.OpenCleanManager();
        }

        public string MigrationDone()
        {
            Program.Log("saved items moved to the player");
            if (settings.ManagerMigrated) return null; // 已經處理過（例如重複通知）
            settings.ManagerMigrated = true;
            settings.Save();
            Program.OpenCleanManager();
            return null;
        }

        // 螢幕的硬體識別碼偶爾會變（重新接線、驅動程式更新、睡眠喚醒後重新偵測）：
        // 同一個位置、同樣大小的螢幕沿用原本的桌布，不用重新設定
        static string BoundsKey(Rectangle b) { return b.X + "," + b.Y + "," + b.Width + "," + b.Height; }
        // 只處理「從沒見過的新識別碼」：關掉某個螢幕、切換投影模式時，其他螢幕移到同一個位置也不會被誤認。
        // 用複製的：舊識別碼的桌布設定保留著，那台螢幕回來時還是它自己的桌布
        void AdoptMovedWalls()
        {
            bool changed = false;
            if (settings.KnownMonitors == null) { settings.KnownMonitors = settings.Walls.Keys.Concat(monitors.Select(m => m.Id)).Distinct().ToList(); changed = true; }
            var absent = settings.Walls.Keys.Where(id => !monitors.Any(m => m.Id == id) && !settings.AdoptedFrom.ContainsValue(id)).ToList();
            foreach (var m in monitors)
            {
                string key = BoundsKey(m.Bounds), b;
                if (settings.Walls.ContainsKey(m.Id))
                {
                    if (!settings.WallBounds.TryGetValue(m.Id, out b) || b != key) { settings.WallBounds[m.Id] = key; changed = true; }
                    continue;
                }
                if (settings.KnownMonitors.Contains(m.Id)) continue;
                var match = absent.Where(id => settings.WallBounds.TryGetValue(id, out b) && b == key).ToList();
                if (match.Count != 1) continue;
                string old = match[0];
                try
                {
                    string from = Files.WallPath(old), to = Files.WallPath(m.Id);
                    if (!File.Exists(from)) continue;
                    File.Copy(from, to, true);
                    settings.Walls[m.Id] = settings.Walls[old];
                    string en;
                    if (settings.WallsEn.TryGetValue(old, out en)) settings.WallsEn[m.Id] = en; else settings.WallsEn.Remove(m.Id);
                    settings.WallBounds[m.Id] = key;
                    settings.AdoptedFrom[m.Id] = old;
                    absent.Remove(old);
                    changed = true;
                    Program.Log("new monitor id " + m.Id + " at the same place as " + old + "：沿用它的桌布");
                }
                catch (Exception e) { Program.Log("adopt wall failed: " + e.Message); }
            }
            foreach (var m in monitors) if (!settings.KnownMonitors.Contains(m.Id)) { settings.KnownMonitors.Add(m.Id); changed = true; }
            if (changed) settings.Save();
        }

        // 依目前接上的螢幕建立 / 調整 / 收起桌布
        void SyncMonitors()
        {
            Program.Op = "sync-monitors";
            monitors = Mon.All();
            AdoptMovedWalls();
            foreach (var id in surfaces.Keys.ToList())
            {
                var m = monitors.FirstOrDefault(x => x.Id == id);
                var s = surfaces[id];
                if (m == null) { CloseSurface(s); surfaces.Remove(id); continue; }
                s.Mon = m;
                if (s.Embedded && s.Hwnd != IntPtr.Zero && Native.IsWindow(s.Hwnd)) EmbedAndShow(s);
            }
            foreach (var m in monitors)
            {
                if (surfaces.ContainsKey(m.Id) || !settings.Walls.ContainsKey(m.Id)) continue;
                var s = new Surface { Mon = m, Title = settings.Walls[m.Id] };
                if (!File.Exists(s.WallFile)) { settings.Walls.Remove(m.Id); settings.WallsEn.Remove(m.Id); settings.Save(); continue; }
                surfaces[m.Id] = s;
                Launch(s);
            }
            PublishState();
        }

        void Launch(Surface s)
        {
            if (s.Pending && (DateTime.Now - s.LaunchedAt).TotalSeconds < 25) return; // 已經在等了，新內容會在視窗載入時一起讀到
            Program.Op = "launch " + s.Mon.Id;
            Edge.CloseToken(s.Token, IntPtr.Zero); // 先關掉之前沒接上的視窗，避免一直累積
            s.Hwnd = IntPtr.Zero;
            s.Embedded = false;
            s.Pending = true;
            s.FitLeft = s.FitTop = -1;
            s.LaunchedAt = DateTime.Now;
            Program.Log("launch " + s.Mon.Id + " (" + s.Title + ")");
            try { Edge.Launch(Program.Origin + "/w/" + s.Mon.Id + "#wpid=" + s.Mon.Id, s.Mon.Bounds); }
            catch (Exception e) { Program.Log("edge launch failed: " + e.Message); }
        }

        void CloseSurface(Surface s)
        {
            if (s.Hwnd != IntPtr.Zero && Native.IsWindow(s.Hwnd))
            {
                Native.ShowWindowAsync(s.Hwnd, Native.SW_HIDE);
                Native.PostMessage(s.Hwnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            Edge.CloseToken(s.Token, IntPtr.Zero);
            s.Hwnd = IntPtr.Zero;
            s.Embedded = false;
            s.Pending = false;
            if (s.Host != null)
            {
                var host = s.Host;
                s.Host = null;
                if (host.Handle != IntPtr.Zero) Native.ShowWindow(host.Handle, Native.SW_HIDE);
                // 等 Edge 自己關掉視窗之後再拆容器（直接拆會連帶強制摧毀 Edge 的視窗）
                var t = new System.Windows.Forms.Timer { Interval = 3000 };
                t.Tick += (a, b) => { t.Stop(); t.Dispose(); try { host.DestroyHandle(); } catch (Exception) { } };
                t.Start();
            }
        }

        void Tick()
        {
            Program.Beat();
            if (exiting) return;
            Program.Op = "tick";
            tickCount++;
            foreach (var s in surfaces.Values.ToList())
            {
                if (s.Hwnd == IntPtr.Zero)
                {
                    if (!s.Pending) continue;
                    IntPtr h = Edge.FindOurWindow(s.Token);
                    if (h != IntPtr.Zero)
                    {
                        s.Hwnd = h;
                        s.Pending = false;
                        Program.Log("found window for " + s.Mon.Id + " hwnd=0x" + h.ToInt64().ToString("X"));
                        TryEmbed(s);
                    }
                    else if ((DateTime.Now - s.LaunchedAt).TotalSeconds > 25)
                    {
                        s.Pending = false;
                        Retry(s, "window did not appear");
                    }
                }
                else if (!Native.IsWindow(s.Hwnd))
                {
                    s.Hwnd = IntPtr.Zero;
                    s.Embedded = false;
                    Retry(s, "window gone");
                }
                else if (!s.Embedded)
                {
                    if (tickCount % 4 == 0) TryEmbed(s); // 桌布層還沒準備好：稍後再試
                }
                else if ((DateTime.Now - s.CheckedAt).TotalSeconds > 2)
                {
                    s.CheckedAt = DateTime.Now;
                    if (!Desktop.InPlace(s)) { Program.Log("re-embed " + s.Mon.Id); EmbedAndShow(s); }
                    else
                    {
                        Desktop.Fit(s);
                        if (!Desktop.Shown(s)) { Program.Log("re-show " + s.Mon.Id); ShowSurface(s); }
                    }
                    Edge.CloseToken(s.Token, s.Hwnd); // 多出來的同名視窗（例如重複啟動）一律關掉
                }
            }
            if (tickCount % 4 == 0 || CoverGone()) CheckPause();
            if (tickCount % 4 == 2) UpdateInputTargets();
            // 保險：鎖定超過 10 秒後每 2 秒確認一次，萬一漏掉「解鎖 / 重新連上」的通知，桌布也不會一直停著
            // （剛鎖定時先不問：免得系統記錄的狀態比通知慢一步，誤以為已經解鎖）
            if (locked && tickCount % 8 == 4 && (DateTime.Now - lockedAt).TotalSeconds > 10 && Native.SessionAway() == false)
            {
                Program.Log("session active and unlocked again");
                SetAway(false, null);
            }
        }

        void Retry(Surface s, string why)
        {
            if (s.GaveUp) return;
            s.Fails++;
            Program.Log(why + " for " + s.Mon.Id + " (attempt " + s.Fails + ")");
            if (s.Fails > 5)
            {
                s.GaveUp = true;
                Edge.CloseToken(s.Token, IntPtr.Zero);
                tray.ShowBalloonTip(6000, Program.AppName, I18n.T(s.Mon.Label + " 的桌布一直無法顯示，已停止重試。重新套用一次桌布即可再試。",
                    "The wallpaper on " + s.Mon.Label + " keeps failing to show, so the player stopped retrying. Apply the wallpaper again to retry."), ToolTipIcon.Warning);
                return;
            }
            Launch(s);
        }

        void TryEmbed(Surface s)
        {
            Program.Op = "embed " + s.Mon.Id;
            bool ok = Desktop.Embed(s);
            if (!ok)
            {
                Native.ShowWindowAsync(s.Hwnd, Native.SW_HIDE); // 別讓還沒放好的視窗蓋住使用者的程式
                Program.Log("embed " + s.Mon.Id + " not ready, will retry");
                return;
            }
            s.Embedded = true;
            s.Fails = 0;
            s.CheckedAt = DateTime.Now;
            Program.Log("embedded " + s.Mon.Id);
            ShowSurface(s);
            UpdateInputTargets();
            // Edge 開視窗時會搶走焦點：放好之後還給使用者最後在用的視窗（例如剛打開的管理介面）
            IntPtr back = lastUserFg;
            if (Native.IsUnderDesktop(Native.GetForegroundWindow()) && back != IntPtr.Zero && Native.IsWindow(back) && Native.IsWindowVisible(back))
                Native.GiveFocusTo(back);
        }

        void EmbedAndShow(Surface s)
        {
            if (Desktop.Embed(s)) { s.Embedded = true; ShowSurface(s); }
            else { s.Embedded = false; Native.ShowWindowAsync(s.Hwnd, Native.SW_HIDE); }
        }

        // 自動暫停：螢幕被最大化 / 全螢幕視窗蓋住時（反正看不到桌布）就暫停；使用者在看桌面時一律播放。
        // 被蓋住要持續一小段時間才暫停（切換視窗時不會一直停停走走）；沒被蓋住就立刻繼續。
        const double PauseAfterSec = 1.2;
        void CheckPause()
        {
            if (exiting) return;
            Program.Op = "check-pause";
            if (surfaces.Count == 0) { coverBy.Clear(); return; }
            var by = new Dictionary<string, IntPtr>();
            // 自動暫停關掉時也要知道哪些螢幕被蓋住：那些桌布照常播放，但不發聲（看不到的桌布不該一直響）
            HashSet<string> covered = Native.CoveredMonitors(monitors, by);
            coverBy = by;
            var now = DateTime.Now;
            bool changed = false;
            foreach (var s in surfaces.Values)
            {
                bool c = covered.Contains(s.Mon.Id);
                if (!c) s.CoveredSince = DateTime.MinValue;
                else if (s.CoveredSince == DateTime.MinValue) s.CoveredSince = now;
                bool hid = c && (now - s.CoveredSince).TotalSeconds >= PauseAfterSec;
                bool auto = hid && settings.AutoPause;
                if (hid == s.Covered && auto == s.AutoPaused) continue;
                changed = true;
                IntPtr w;
                string why = hid && by.TryGetValue(s.Mon.Id, out w) ? "（" + Native.Describe(w) + "）" : "";
                if (auto != s.AutoPaused) Program.Log("auto-pause " + s.Mon.Id + " = " + auto + why);
                else Program.Log("covered " + s.Mon.Id + " = " + hid + "（自動暫停關閉：只靜音）" + why);
                s.Covered = hid;
                s.AutoPaused = auto;
            }
            if (changed) PublishState();
        }

        void UpdateInputTargets()
        {
            InputForward.SetTargets(surfaces.Values.Where(s => s.Embedded && s.Hwnd != IntPtr.Zero)
                .Select(s => new InputForward.Target { Bounds = s.Mon.Bounds, Hwnd = s.Hwnd }));
        }

        // 之前蓋住螢幕的視窗是不是已經不再蓋住了（不用列舉所有視窗，很便宜）
        bool CoverGone()
        {
            foreach (var kv in coverBy)
            {
                var m = monitors.FirstOrDefault(x => x.Id == kv.Key);
                if (m == null || !Native.StillCovers(kv.Value, m)) return true;
            }
            return false;
        }

        // 暫停時桌布視窗仍然顯示：只是通知頁面停止繪製（畫面停在最後一格、影片暫停），幾乎不耗 CPU / GPU，
        // 而且不會露出 Windows 原本的桌布——就算判斷有誤，看到的也是靜止的動態桌布而不是桌布不見
        void ShowSurface(Surface s)
        {
            if (s.Hwnd == IntPtr.Zero || !s.Embedded) return;
            if (s.HostAlive) Native.ShowWindow(s.Host.Handle, Native.SW_SHOWNA);
            Native.ShowWindowAsync(s.Hwnd, Native.SW_SHOWNA);
        }

        // 沒有人看得到桌布：工作階段鎖定或切換到別的使用者（locked）、螢幕因為省電關掉（displayOff）。
        // 這時全部暫停：頁面停在最後一格、不發聲，音效裝置也會被放開（不然電腦不會自動進入睡眠）
        bool locked, displayOff;
        DateTime lockedAt;
        public void SetAway(bool? lockState, bool? displayState)
        {
            bool was = locked || displayOff;
            if (lockState.HasValue)
            {
                if (lockState.Value && !locked) lockedAt = DateTime.Now;
                locked = lockState.Value;
            }
            if (displayState.HasValue) displayOff = displayState.Value;
            if ((locked || displayOff) != was) Program.Log("away = " + (locked || displayOff) + "（locked=" + locked + ", displayOff=" + displayOff + "）");
            PublishState();
        }

        // 把每個螢幕「該不該暫停」「能不能發聲」交給 HTTP 執行緒，叫醒等待中的桌布頁面（/api/wait）
        void PublishState()
        {
            var next = new Dictionary<string, bool>();
            var hush = new HashSet<string>();
            bool away = locked || displayOff;
            foreach (var s in surfaces.Values)
            {
                next[s.Mon.Id] = settings.Paused || s.AutoPaused || away;
                if (s.Covered) hush.Add(s.Mon.Id); // 自動暫停關掉時，被蓋住的螢幕照常播放、但不發聲
            }
            Hub.Publish(next, hush);
        }

        // 視窗切換、最小化 / 還原、拖曳結束、顯示 / 隱藏、切換虛擬桌面時由系統通知，不必等下一次定期檢查。
        // （取消最大化、離開全螢幕這類只改變位置的情況，由 Tick 每 250 ms 檢查蓋住的視窗來處理）
        void HookWindowEvents()
        {
            winEventProc = OnWinEvent;
            uint[][] ranges = {
                new[] { Native.EVENT_SYSTEM_FOREGROUND, Native.EVENT_SYSTEM_FOREGROUND },
                new[] { Native.EVENT_SYSTEM_MOVESIZEEND, Native.EVENT_SYSTEM_MOVESIZEEND },
                new[] { Native.EVENT_SYSTEM_MINIMIZESTART, Native.EVENT_SYSTEM_MINIMIZEEND },
                new[] { Native.EVENT_OBJECT_SHOW, Native.EVENT_OBJECT_HIDE },
                new[] { Native.EVENT_OBJECT_CLOAKED, Native.EVENT_OBJECT_UNCLOAKED },
            };
            foreach (var r in ranges)
            {
                IntPtr h = Native.SetWinEventHook(r[0], r[1], IntPtr.Zero, winEventProc, 0, 0, Native.WINEVENT_OUTOFCONTEXT | Native.WINEVENT_SKIPOWNPROCESS);
                if (h != IntPtr.Zero) winHooks.Add(h);
                else Program.Log("SetWinEventHook 0x" + r[0].ToString("X") + " failed");
            }
            // 事件連續發生時合併成每 80 ms 最多判斷一次
            checkSoon.Interval = 80;
            checkSoon.Tick += (s, e) => { checkSoon.Stop(); Safe("CheckPause", CheckPause); };
            NoteForeground(Native.GetForegroundWindow());
        }

        void OnWinEvent(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
        {
            if (exiting || hwnd == IntPtr.Zero || idObject != 0 /* OBJID_WINDOW */ || idChild != 0) return;
            if (ev == Native.EVENT_SYSTEM_FOREGROUND) NoteForeground(hwnd);
            else
            {
                // 只關心頂層視窗；已經銷毀的視窗（找不到上層，GetAncestor 回傳 0）也要算，例如蓋住螢幕的視窗被關掉
                IntPtr root = Native.GetAncestor(hwnd, 2 /* GA_ROOT */);
                if (root != IntPtr.Zero && root != hwnd) return;
            }
            if (!checkSoon.Enabled) checkSoon.Start();
        }

        // 記下使用者最後在用的視窗：桌布的 Edge 開視窗時會搶走焦點，放好之後要還給它
        void NoteForeground(IntPtr h)
        {
            Program.Op = "foreground";
            try
            {
                if (h == IntPtr.Zero || Native.IsUnderDesktop(h) || Native.IsShellWindow(h) || Native.TextOf(h).StartsWith("ASCIIWP-")) return;
                if (Edge.IsOurWindow(h)) return;
                lastUserFg = h;
            }
            finally { Program.Op = "idle"; }
        }

        // ── API（UI 執行緒） ──
        public List<string> ResolveTargets(string mon)
        {
            return mon == "all" ? monitors.Select(m => m.Id).ToList() : monitors.Where(m => m.Id == mon).Select(m => m.Id).ToList();
        }

        // 檔案已經由 HTTP 執行緒寫好；這裡只更新狀態
        // 桌布頁面回報自己的標題列和邊框大小（DIP），用來把網頁內容區剛好對齊螢幕
        public string ReportFit(string mon, double left, double top)
        {
            Surface s;
            if (!surfaces.TryGetValue(mon, out s)) return null;
            if (left < 0 || top < 0 || left > 64 || top > 160) return null;
            if (Math.Abs(s.FitLeft - left) < 0.01 && Math.Abs(s.FitTop - top) < 0.01) return null;
            s.FitLeft = left; s.FitTop = top;
            if (s.Embedded) Desktop.Fit(s); // 還沒放進桌面的話，放好時的 Fit 會用到
            return null;
        }

        // title：中文標題（X-WP-Title）；titleEn：英文標題（X-WP-Title-En，可省略，舊版管理介面不會送）
        public string Applied(List<string> ids, string title, string titleEn)
        {
            string zh, en;
            I18n.WallTitles(title, titleEn, out zh, out en);
            foreach (var id in ids)
            {
                var m = monitors.FirstOrDefault(x => x.Id == id);
                if (m == null) continue;
                Surface s;
                if (!surfaces.TryGetValue(id, out s)) { s = new Surface { Mon = m }; surfaces[id] = s; }
                s.Title = zh;
                s.GaveUp = false;
                s.Fails = 0;
                settings.Walls[id] = zh;
                if (en != "") settings.WallsEn[id] = en; else settings.WallsEn.Remove(id); // 新桌布沒有英文標題：別留著上一張的
                settings.WallBounds[id] = BoundsKey(m.Bounds);
                Program.Log("apply " + id + ": " + s.Title);
                // 已經有視窗的話，頁面會發現檔案版本變了而自己重新載入
                if (s.Hwnd == IntPtr.Zero || !Native.IsWindow(s.Hwnd)) Launch(s);
            }
            settings.Save();
            PublishState();
            Hub.Poke(); // 叫醒等待中的頁面去比對新版本
            return null;
        }

        public string Clear(string mon)
        {
            var ids = mon == "all" ? settings.Walls.Keys.Union(surfaces.Keys).ToList() : new List<string> { mon };
            foreach (var id in ids)
            {
                Surface s;
                if (surfaces.TryGetValue(id, out s)) { CloseSurface(s); surfaces.Remove(id); }
                else Edge.CloseToken("ASCIIWP-" + id, IntPtr.Zero);
                settings.Walls.Remove(id);
                settings.WallsEn.Remove(id);
                settings.WallBounds.Remove(id);
                settings.AdoptedFrom.Remove(id);
                try { string p = Files.WallPath(id); if (File.Exists(p)) File.Delete(p); } catch (Exception e) { Program.Log("delete wall failed: " + e.Message); }
                Program.Log("clear " + id);
            }
            settings.Save();
            PublishState();
            if (surfaces.Count == 0) new Thread(Edge.CloseAll) { IsBackground = true }.Start();
            return null;
        }

        public void SetPaused(bool p)
        {
            settings.Paused = p;
            settings.Save();
            PublishState();
        }

        // 桌布音效開關（所有螢幕共用）：存進設定、叫醒等待中的桌布頁面（/api/wait 的 s），系統匣的勾勾也跟著變
        public void SetSound(bool on)
        {
            settings.Sound = on;
            settings.Save();
            Hub.SetSound(on);
            if (soundItem != null) soundItem.Checked = on; // 選單開著時也立刻更新
            Program.Log("sound = " + on);
        }

        // 介面語言（"" 自動 / "zh" / "en"）：存進設定，系統匣選單和圖示提示立刻換成新語言；
        // 實際語言（zh / en）有變才叫醒等待中的桌布頁面（/api/wait 的 l），例如「自動（中文）→ 中文」不會
        public void SetLang(string pref)
        {
            bool changed = I18n.SetPref(pref);
            settings.Lang = I18n.Pref;
            settings.Save();
            Hub.SetLang(I18n.Lang);
            tray.Text = Program.AppName;
            BuildMenu();
            if (changed) RestampManager();
            Program.Log("lang = " + I18n.PrefName + " -> " + I18n.Lang);
        }

        // 管理介面已經開著（通常就是它送來 /api/lang）：工作列上的名稱（跳躍清單、釘選到工作列時的名稱）也換成新語言。
        // 還沒出現的視窗不用管：TaskbarId.StampWhenReady 等到它出現時才讀目前的語言
        static void RestampManager()
        {
            try { IntPtr h = Browser.FindManagerWindow(); if (h != IntPtr.Zero) TaskbarId.Stamp(h); }
            catch (Exception e) { Program.Log("restamp manager failed: " + e.Message); }
        }

        string WallTitle(string id)
        {
            string zh, en;
            settings.Walls.TryGetValue(id, out zh);
            settings.WallsEn.TryGetValue(id, out en);
            return I18n.Pick(zh, en);
        }

        public object Status(bool full)
        {
            var r = new Dictionary<string, object> { { "ok", true }, { "app", "ascii-wallpaper-player" }, { "version", "1.2" } };
            if (!full) return r;
            r["paused"] = settings.Paused;
            r["autoPause"] = settings.AutoPause;
            r["sound"] = settings.Sound;
            r["lang"] = I18n.Lang;          // 實際語言：zh / en
            r["langPref"] = I18n.PrefName;  // 設定：auto / zh / en
            r["away"] = locked || displayOff;
            r["monitors"] = monitors.Select(m =>
            {
                Surface s; surfaces.TryGetValue(m.Id, out s);
                string title, titleEn; settings.Walls.TryGetValue(m.Id, out title); settings.WallsEn.TryGetValue(m.Id, out titleEn);
                return new Dictionary<string, object> {
                    { "id", m.Id }, { "index", m.Index }, { "primary", m.Primary },
                    { "x", m.Bounds.X }, { "y", m.Bounds.Y }, { "w", m.Bounds.Width }, { "h", m.Bounds.Height },
                    { "title", title }, { "titleEn", titleEn },
                    { "running", s != null && s.Embedded }, { "autoPaused", s != null && s.AutoPaused }, { "failed", s != null && s.GaveUp } };
            }).ToList();
            // 存著但目前沒接上的螢幕，讓管理介面可以移除
            r["absent"] = settings.Walls.Where(kv => !monitors.Any(m => m.Id == kv.Key))
                .Select(kv =>
                {
                    string titleEn; settings.WallsEn.TryGetValue(kv.Key, out titleEn);
                    return new Dictionary<string, object> { { "id", kv.Key }, { "title", kv.Value }, { "titleEn", titleEn } };
                }).ToList();
            return r;
        }

        // ── 系統匣 ──
        ToolStripMenuItem soundItem;        // 「桌布音效」：從管理介面切換時也要更新它的勾勾
        void BuildMenu()
        {
            menu.Items.Clear();
            var open = new ToolStripMenuItem(I18n.T("開啟管理介面", "Open Manager"), null, (s, e) => Safe("OpenManager", OpenManager));
            open.Font = new Font(open.Font, FontStyle.Bold);
            menu.Items.Add(open);
            menu.Items.Add(new ToolStripSeparator());
            foreach (var m in monitors)
            {
                bool has = settings.Walls.ContainsKey(m.Id);
                var item = new ToolStripMenuItem(m.Label + I18n.T("：", ": ") + MenuText(has ? WallTitle(m.Id) : I18n.T("原本的桌布", "Original wallpaper")));
                if (has) { string id = m.Id; item.DropDownItems.Add(I18n.T("移除這個螢幕的動態桌布", "Remove the live wallpaper from this monitor"), null, (a, b) => Clear(id)); }
                else item.Enabled = false;
                menu.Items.Add(item);
            }
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(new ToolStripMenuItem(settings.Paused ? I18n.T("▶ 繼續播放", "▶ Resume") : I18n.T("⏸ 暫停全部", "⏸ Pause All"), null, (s, e) => SetPaused(!settings.Paused)));
            var auto = new ToolStripMenuItem(I18n.T("被視窗蓋住或全螢幕時自動暫停（省電）", "Auto-pause when covered or full screen (saves power)"), null, (s, e) => { settings.AutoPause = !settings.AutoPause; settings.Save(); CheckPause(); });
            auto.Checked = settings.AutoPause;
            menu.Items.Add(auto);
            soundItem = new ToolStripMenuItem(I18n.T("桌布音效", "Wallpaper Sound"), null, (s, e) => SetSound(!settings.Sound));
            soundItem.Checked = settings.Sound;
            menu.Items.Add(soundItem);
            menu.Items.Add(new ToolStripMenuItem(I18n.T("建立桌面與開始功能表捷徑", "Create Desktop and Start Menu Shortcuts"), null, (s, e) =>
            {
                string err = Shortcuts.Create();
                tray.ShowBalloonTip(4000, Program.AppName, err == null
                    ? I18n.T("已在桌面和開始功能表建立「" + Program.ManagerTitle + "」捷徑。", "Created the \"" + Program.ManagerTitle + "\" shortcut on the desktop and in the Start menu.")
                    : I18n.T("建立捷徑失敗：", "Could not create the shortcuts: ") + err, err == null ? ToolTipIcon.Info : ToolTipIcon.Warning);
            }));
            var boot = new ToolStripMenuItem(I18n.T("開機時自動啟動", "Start with Windows"), null, (s, e) => Autostart.Set(!Autostart.IsOn()));
            boot.Checked = Autostart.IsOn();
            menu.Items.Add(boot);
            // 語言選單一律中英並列：看不懂目前語言的人也找得到
            var langMenu = new ToolStripMenuItem("語言 / Language");
            foreach (var opt in new[] { new[] { "", "自動 (Auto)" }, new[] { "zh", "中文" }, new[] { "en", "English" } })
            {
                string p = opt[0];
                // 等點擊處理完、選單關上之後才換（換語言會重建整個選單，不能在選單項目自己的點擊事件裡拆掉它）
                var it = new ToolStripMenuItem(opt[1], null, (s, e) => msg.BeginInvoke(new Action(() => Safe("SetLang", () => SetLang(p)))));
                it.Checked = I18n.Pref == p;
                langMenu.DropDownItems.Add(it);
            }
            menu.Items.Add(langMenu);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(new ToolStripMenuItem(I18n.T("結束（恢復原本的桌布）", "Exit (restore the original wallpaper)"), null, (s, e) => Quit()));
        }

        // 選單文字裡單獨的 & 會被當成快速鍵記號而消失（「Day & Night」會變成「Day  Night」）：寫成 && 才會照原樣顯示。
        // 只在放進選單時處理，存起來的標題和 /api/status 不變
        static string MenuText(string s) { return (s ?? "").Replace("&", "&&"); }

        static Icon MakeIcon()
        {
            try { var ic = Icon.ExtractAssociatedIcon(Application.ExecutablePath); if (ic != null) return new Icon(ic, SystemInformation.SmallIconSize); }
            catch (Exception) { }
            return SystemIcons.Application;
        }

        // 工作列重新建立：explorer 重新啟動，或只是 DPI 改變（工作列程序沒變就不用處理）
        public void OnTaskbarCreated()
        {
            uint pid = Native.ShellPid();
            if (pid == shellPid || pid == 0) return;
            shellPid = pid;
            Program.Log("explorer restarted");
            int tries = 0;
            var t = new System.Windows.Forms.Timer { Interval = 500 };
            t.Tick += (a, b) =>
            {
                tries++;
                IntPtr progman = Native.FindWindow("Progman", null);
                bool ready = progman != IntPtr.Zero && (Native.FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero || tries > 10);
                if (!ready && tries < 40) return;
                t.Stop(); t.Dispose();
                Desktop.SpawnLayer(true);
                foreach (var s in surfaces.Values)
                {
                    if (s.Host != null && !s.HostAlive) s.Host = null; // 容器跟著舊的桌面一起消失了
                    if (s.Hwnd != IntPtr.Zero && Native.IsWindow(s.Hwnd)) EmbedAndShow(s);
                    else if (!s.Pending) { s.Hwnd = IntPtr.Zero; s.Embedded = false; Launch(s); }
                }
            };
            t.Start();
        }

        public void QuitSoon() { msg.BeginInvoke(new Action(() => { var t = new System.Windows.Forms.Timer { Interval = 300 }; t.Tick += (a, b) => { t.Stop(); Quit(); }; t.Start(); })); }

        void Quit()
        {
            if (exiting) return;
            exiting = true;
            timer.Stop();
            displayDebounce.Stop();
            checkSoon.Stop();
            foreach (var h in winHooks) Native.UnhookWinEvent(h);
            winHooks.Clear();
            msg.UnwatchAway();
            Program.Log("quit");
            foreach (var s in surfaces.Values)
            {
                if (s.Hwnd != IntPtr.Zero && Native.IsWindow(s.Hwnd)) Native.PostMessage(s.Hwnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                Edge.CloseToken(s.Token, IntPtr.Zero);
            }
            server.Stop();
            Edge.CloseAll();
            foreach (var s in surfaces.Values) if (s.Host != null) { try { s.Host.DestroyHandle(); } catch (Exception) { } }
            tray.Visible = false;
            tray.Dispose();
            SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
            ExitThread();
        }
    }

    // 隱藏的頂層視窗：讓 HTTP 執行緒能切回 UI 執行緒，並接收「工作列重新建立」（explorer 重啟）的廣播，
    // 以及工作階段鎖定 / 解鎖、螢幕關閉 / 開啟的通知
    class MsgForm : Form
    {
        readonly PlayerApp app;
        readonly int taskbarCreated = Native.RegisterWindowMessage("TaskbarCreated");
        IntPtr powerReg;
        public MsgForm(PlayerApp app)
        {
            this.app = app;
            ShowInTaskbar = false;
            FormBorderStyle = FormBorderStyle.None;
            var h = Handle; // 建立視窗但不顯示
        }
        protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }

        public void WatchAway()
        {
            if (!Native.WTSRegisterSessionNotification(Handle, 0 /* NOTIFY_FOR_THIS_SESSION */))
                Program.Log("WTSRegisterSessionNotification failed: " + Marshal.GetLastWin32Error());
            Guid g = Native.GUID_CONSOLE_DISPLAY_STATE;
            powerReg = Native.RegisterPowerSettingNotification(Handle, ref g, 0 /* DEVICE_NOTIFY_WINDOW_HANDLE */);
            if (powerReg == IntPtr.Zero) Program.Log("RegisterPowerSettingNotification failed: " + Marshal.GetLastWin32Error());
        }

        public void UnwatchAway()
        {
            try
            {
                Native.WTSUnRegisterSessionNotification(Handle);
                if (powerReg != IntPtr.Zero) Native.UnregisterPowerSettingNotification(powerReg);
                powerReg = IntPtr.Zero;
            }
            catch (Exception) { }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == taskbarCreated) BeginInvoke(new Action(app.OnTaskbarCreated));
            else if (m.Msg == Native.WM_WTSSESSION_CHANGE)
            {
                int w = m.WParam.ToInt32();
                // 7 鎖定、2 / 4 本機 / 遠端連線中斷（例如切換到別的使用者）→ 沒人看得到；8 解鎖 → 回來了；
                // 1 / 3 重新連上：畫面可能還停在鎖定畫面，所以實際問一次（查不到就當作回來了）
                if (w == 7 || w == 2 || w == 4) BeginInvoke(new Action(() => app.SetAway(true, null)));
                else if (w == 8) BeginInvoke(new Action(() => app.SetAway(false, null)));
                else if (w == 1 || w == 3) BeginInvoke(new Action(() => app.SetAway(Native.SessionAway() ?? false, null)));
            }
            else if (m.Msg == Native.WM_POWERBROADCAST && m.WParam.ToInt64() == Native.PBT_POWERSETTINGCHANGE && m.LParam != IntPtr.Zero)
            {
                var ps = (Native.POWERBROADCAST_SETTING)Marshal.PtrToStructure(m.LParam, typeof(Native.POWERBROADCAST_SETTING));
                if (ps.PowerSetting == Native.GUID_CONSOLE_DISPLAY_STATE && ps.DataLength >= 4)
                {
                    bool off = ps.Data == 0; // 0 關閉、1 開啟、2 變暗（還看得到，算開著）
                    BeginInvoke(new Action(() => app.SetAway(null, off)));
                }
            }
            base.WndProc(ref m);
        }
    }

    // ───────────────────────── 開機自動啟動 ─────────────────────────
    static class Autostart
    {
        const string Key = @"Software\Microsoft\Windows\CurrentVersion\Run", Name = "ASCIIWallpaperPlayer";
        public static bool IsOn()
        {
            using (var k = Registry.CurrentUser.OpenSubKey(Key)) return k != null && k.GetValue(Name) != null;
        }
        static string Command { get { return "\"" + Application.ExecutablePath + "\" /autostart"; } }
        public static void Refresh()
        {
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(Key, true))
                {
                    var v = k == null ? null : k.GetValue(Name) as string;
                    if (v != null && v != Command) { k.SetValue(Name, Command); Program.Log("autostart command updated"); }
                }
            }
            catch (Exception e) { Program.Log("autostart refresh failed: " + e.Message); }
        }
        public static void Set(bool on)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(Key))
            {
                if (on) k.SetValue(Name, Command);
                else k.DeleteValue(Name, false);
            }
            Program.Log("autostart = " + on);
        }
    }

    // ───────────────────────── Edge ─────────────────────────
    static class Edge
    {
        public static string ExePath()
        {
            foreach (var p in new[] {
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) + @"\Microsoft\Edge\Application\msedge.exe",
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles) + @"\Microsoft\Edge\Application\msedge.exe" })
                if (File.Exists(p)) return p;
            try
            {
                using (var k = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"))
                    if (k != null && k.GetValue(null) != null) return k.GetValue(null).ToString();
            }
            catch (Exception) { }
            return "msedge.exe";
        }

        public static string Args(string url, Rectangle b)
        {
            var a = new List<string> {
                "--user-data-dir=\"" + Program.EdgeProfile + "\"",
                "--app=\"" + url + "\"",
                "--window-position=" + b.X + "," + b.Y,
                "--window-size=" + b.Width + "," + b.Height,
                "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-extensions",
                "--hide-crash-restore-bubble", "--noerrdialogs", "--disable-component-update",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
                // 只能有一個 --disable-features（重複時只有最後一個有效）
                "--disable-features=CalculateNativeWinOcclusion,Translate,msEdgeTranslate,msEdgeSidebarV2,msUndersideButton,msHubApps,msImplicitSignin",
                "--autoplay-policy=no-user-gesture-required",
            };
            // 除錯用：設定環境變數 ASCIIWP_DEBUG_PORT 時開啟遠端除錯埠
            string dbg = Environment.GetEnvironmentVariable("ASCIIWP_DEBUG_PORT");
            int port;
            if (!string.IsNullOrEmpty(dbg) && int.TryParse(dbg, out port)) a.Add("--remote-debugging-port=" + port);
            return string.Join(" ", a);
        }

        public static void Launch(string url, Rectangle b)
        {
            // UseShellExecute = true：Edge 不會繼承播放器的連線埠等控制代碼
            Process.Start(new ProcessStartInfo(ExePath(), Args(url, b)) { UseShellExecute = true });
        }

        // ── 「我們的」Edge：用專用的 user-data-dir 判斷，絕不碰使用者平常開的瀏覽器 ──
        // 直接讀行程的命令列（很快）。以前用 WMI 查，WMI 服務慢或卡住時整個播放器會跟著卡住
        static bool CmdHas(uint pid, string dir)
        {
            string cmd = Native.CommandLine(pid);
            return cmd != null && cmd.IndexOf(dir, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        static List<Process> OurProcesses()
        {
            var list = new List<Process>();
            foreach (var p in Process.GetProcessesByName("msedge"))
            {
                if (CmdHas((uint)p.Id, Program.EdgeProfile)) list.Add(p);
                else p.Dispose();
            }
            return list;
        }

        // 這個視窗是不是用指定設定檔資料夾執行的 Edge（例如管理介面專用的設定檔）。
        // 先看程式名稱，只有 msedge 才讀命令列，結果依 PID 快取
        static readonly Dictionary<string, bool> profileCache = new Dictionary<string, bool>();
        public static bool HasProfile(IntPtr h, string profileDir)
        {
            uint pid;
            Native.GetWindowThreadProcessId(h, out pid);
            if (pid == 0) return false;
            string key = pid + "|" + profileDir;
            bool v;
            lock (profileCache) if (profileCache.TryGetValue(key, out v)) return v;
            string name = "";
            try { using (var p = Process.GetProcessById((int)pid)) name = p.ProcessName; } catch (Exception) { }
            v = false;
            if (name.Equals("msedge", StringComparison.OrdinalIgnoreCase))
            {
                string cmd = Native.CommandLine(pid);
                if (cmd == null) return false; // 讀不到就不快取，下次再試
                v = cmd.IndexOf(profileDir, StringComparison.OrdinalIgnoreCase) >= 0;
            }
            lock (profileCache) { if (profileCache.Count > 256) profileCache.Clear(); profileCache[key] = v; }
            return v;
        }

        static readonly Dictionary<uint, bool> pidIsOurs = new Dictionary<uint, bool>();
        public static bool IsOurWindow(IntPtr h)
        {
            uint pid;
            Native.GetWindowThreadProcessId(h, out pid);
            if (pid == 0) return false;
            bool v;
            if (pidIsOurs.TryGetValue(pid, out v)) return v;
            string name = "";
            try { using (var p = Process.GetProcessById((int)pid)) name = p.ProcessName; } catch (Exception) { }
            v = name.Equals("msedge", StringComparison.OrdinalIgnoreCase) && IsOurs(h);
            if (pidIsOurs.Count > 256) pidIsOurs.Clear();
            pidIsOurs[pid] = v;
            return v;
        }

        static bool IsOurs(IntPtr h)
        {
            uint pid;
            Native.GetWindowThreadProcessId(h, out pid);
            return pid != 0 && CmdHas(pid, Program.EdgeProfile);
        }

        // 頂層（還沒放進桌面）、標題剛好是 token、而且屬於我們 Edge 的視窗
        static List<IntPtr> TopLevel(string token)
        {
            var found = new List<IntPtr>();
            Native.EnumWindows((h, l) =>
            {
                if (Native.TextOf(h) == token && Native.ClassOf(h).StartsWith("Chrome_WidgetWin_")) found.Add(h);
                return true;
            }, IntPtr.Zero);
            return found.Where(IsOurs).ToList();
        }

        public static IntPtr FindOurWindow(string token)
        {
            var list = TopLevel(token);
            return list.Count > 0 ? list[0] : IntPtr.Zero;
        }

        public static void CloseToken(string token, IntPtr keep)
        {
            foreach (var h in TopLevel(token))
                if (h != keep) { Native.ShowWindowAsync(h, Native.SW_HIDE); Native.PostMessage(h, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero); Program.Log("closed stray window " + token); }
        }

        // 先請它們自己關閉，再結束剩下的；拿著 Process 物件操作，不會因為 PID 被重複使用而誤殺別的程式
        public static void CloseAll()
        {
            try
            {
                var ours = OurProcesses();
                foreach (var p in ours) { try { p.CloseMainWindow(); } catch (Exception) { } }
                var until = DateTime.Now.AddMilliseconds(2500);
                foreach (var p in ours)
                {
                    try
                    {
                        int left = (int)Math.Max(0, (until - DateTime.Now).TotalMilliseconds);
                        if (!p.WaitForExit(left)) p.Kill();
                    }
                    catch (Exception) { }
                    finally { p.Dispose(); }
                }
                Program.Log("closed " + ours.Count + " edge processes");
            }
            catch (Exception e) { Program.Log("CloseAll failed: " + e.Message); }
        }
    }

    // ───────────────────────── 管理介面視窗 ─────────────────────────
    // 管理介面用 Edge 以專用設定檔、應用程式模式開：沒有擴充功能（例如翻譯、擷取網頁的擴充功能會改動畫布內容），
    // 收藏存在播放器裡。舊版的收藏存在使用者自己的瀏覽器（Chrome 或 Edge）裡，第一次要用那個設定檔開一次來搬家
    static class Browser
    {
        [DllImport("shlwapi.dll", CharSet = CharSet.Unicode)]
        static extern int AssocQueryString(uint flags, uint str, string assoc, string extra, StringBuilder outBuf, ref uint outLen);

        public static bool LaunchCleanApp(string url)
        {
            string edge = Edge.ExePath();
            if (!File.Exists(edge)) return false;
            bool first = !Directory.Exists(Program.AppProfile);
            var a = new List<string> {
                "--user-data-dir=\"" + Program.AppProfile + "\"",
                "--app=\"" + url + "\"",
                "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-extensions",
                "--hide-crash-restore-bubble", "--noerrdialogs", "--disable-component-update",
                "--disable-features=Translate,msEdgeTranslate,msEdgeSidebarV2,msUndersideButton,msHubApps,msImplicitSignin",
            };
            if (first) a.Add("--window-size=1440,960");
            // 除錯用：設定環境變數 ASCIIWP_DEBUG_PORT 時，管理介面用「那個埠 + 1」開遠端除錯
            int port;
            if (int.TryParse(Environment.GetEnvironmentVariable("ASCIIWP_DEBUG_PORT") ?? "", out port)) a.Add("--remote-debugging-port=" + (port + 1));
            Process.Start(new ProcessStartInfo(edge, string.Join(" ", a)) { UseShellExecute = true });
            Program.Log("open manager window");
            return true;
        }

        // 管理介面的視窗：標題剛好是管理介面的標題（中文或英文都算：頁面的語言可能和播放器不同步）、
        // 而且是專用設定檔的 Edge（使用者自己瀏覽器裡的舊視窗不算）
        public static IntPtr FindManagerWindow()
        {
            var candidates = new List<IntPtr>();
            Native.EnumWindows((h, l) =>
            {
                if (Native.IsWindowVisible(h) && Program.ManagerTitles.Contains(Native.TextOf(h)) && Native.ClassOf(h).StartsWith("Chrome_WidgetWin_")) candidates.Add(h);
                return true;
            }, IntPtr.Zero);
            return candidates.FirstOrDefault(h => Edge.HasProfile(h, Program.AppProfile));
        }

        // 用存著舊收藏的瀏覽器設定檔開一次管理介面（頁面會把收藏搬到播放器）；沒有舊收藏就回傳 false
        public static bool LaunchLegacyForMigration(string url)
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string chrome = ChromePath(), edge = File.Exists(Edge.ExePath()) ? Edge.ExePath() : null;
            var cands = new List<KeyValuePair<string, string>>();
            if (chrome != null) cands.Add(new KeyValuePair<string, string>(chrome, Path.Combine(local, @"Google\Chrome\User Data")));
            if (edge != null) cands.Add(new KeyValuePair<string, string>(edge, Path.Combine(local, @"Microsoft\Edge\User Data")));
            if (DefaultBrowserProgId().StartsWith("MSEdgeHTM", StringComparison.OrdinalIgnoreCase)) cands.Reverse();
            foreach (var c in cands)
            {
                string profile = ProfileWithData(c.Value);
                if (profile == null) continue;
                Process.Start(new ProcessStartInfo(c.Key, "--profile-directory=\"" + profile + "\" --app=\"" + url + "\"") { UseShellExecute = true });
                Program.Log("open manager in " + Path.GetFileName(c.Key) + " (" + profile + ") to move saved items");
                return true;
            }
            return false;
        }

        static string DefaultBrowserProgId()
        {
            try
            {
                // 由系統解析 http 的預設程式（新版 Windows 的 UserChoiceLatest 也算在內）
                var sb = new StringBuilder(256);
                uint n = 256;
                if (AssocQueryString(0x1000 /* ASSOCF_IS_PROTOCOL */, 20 /* ASSOCSTR_PROGID */, "http", null, sb, ref n) == 0 && sb.Length > 0) return sb.ToString();
            }
            catch (Exception) { }
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"))
                    if (k != null && k.GetValue("ProgId") != null) return k.GetValue("ProgId").ToString();
            }
            catch (Exception) { }
            return "";
        }

        static string ChromePath()
        {
            string p = AppPath("chrome.exe");
            if (p != null) return p;
            foreach (var root in new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.LocalApplicationData })
            {
                string c = Path.Combine(Environment.GetFolderPath(root), @"Google\Chrome\Application\chrome.exe");
                if (File.Exists(c)) return c;
            }
            return null;
        }

        static string AppPath(string exe)
        {
            foreach (var root in new[] { Registry.CurrentUser, Registry.LocalMachine })
            {
                try
                {
                    using (var k = root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                        if (k != null && k.GetValue(null) != null && File.Exists(k.GetValue(null).ToString().Trim('"'))) return k.GetValue(null).ToString().Trim('"');
                }
                catch (Exception) { }
            }
            return null;
        }

        // 哪個設定檔真的存著管理介面的資料（IndexedDB）：以資料量判斷（只開過頁面、沒存東西的空資料庫不算），
        // 一樣多時用最近寫入的；都沒有就不指定，由瀏覽器用上次使用的設定檔
        static string ProfileWithData(string userData)
        {
            try
            {
                if (!Directory.Exists(userData)) return null;
                string origin = "http_127.0.0.1_" + Program.Port + ".indexeddb";
                string best = null;
                long bestScore = 16 * 1024;
                DateTime bestTime = DateTime.MinValue;
                foreach (var d in Directory.GetDirectories(userData))
                {
                    string name = Path.GetFileName(d);
                    if (name != "Default" && !name.StartsWith("Profile ")) continue;
                    long score = 0;
                    DateTime t = DateTime.MinValue;
                    foreach (var part in new[] { ".blob", ".leveldb" })
                    {
                        var dir = new DirectoryInfo(Path.Combine(d, "IndexedDB", origin + part));
                        if (!dir.Exists) continue;
                        foreach (var f in dir.EnumerateFiles("*", SearchOption.AllDirectories))
                        {
                            // leveldb 只算資料檔（*.ldb、編號的 *.log），不算 LOG、MANIFEST 這些每次開啟都會改的檔案
                            if (part == ".leveldb" && !(f.Extension.Equals(".ldb", StringComparison.OrdinalIgnoreCase) || f.Extension.Equals(".log", StringComparison.OrdinalIgnoreCase))) continue;
                            score += f.Length;
                            if (f.LastWriteTimeUtc > t) t = f.LastWriteTimeUtc;
                        }
                    }
                    if (score > bestScore || (best != null && score == bestScore && t > bestTime)) { best = name; bestScore = score; bestTime = t; }
                }
                return best;
            }
            catch (Exception) { return null; }
        }
    }

    // ───────────────────────── 工作列身分 ─────────────────────────
    // 管理介面視窗是瀏覽器開的：把它的工作列身分（AppUserModelID）改成我們自己的，並設定「重新啟動指令」。
    // 這樣釘選到工作列時，按下去啟動的是播放器（/open，播放器沒在執行也會一起啟動），
    // 而且和桌面 / 開始功能表的捷徑歸在同一個工作列按鈕
    static class TaskbarId
    {
        public const string AppId = "ASCIIWallpaper.Manager";
        static Thread pending;
        static readonly object stampLock = new object();

        // 名稱在鎖裡面才讀：背景的 StampWhenReady 和換語言時的重新設定同時發生，也不會讓舊語言的名稱蓋掉新的
        public static void Stamp(IntPtr h)
        {
            try
            {
                lock (stampLock)
                {
                    string exe = Application.ExecutablePath;
                    Shell.SetWindowProps(h, new[] {
                        new KeyValuePair<Shell.PROPERTYKEY, string>(Shell.PKEY_RelaunchCommand, "\"" + exe + "\" /open"),
                        new KeyValuePair<Shell.PROPERTYKEY, string>(Shell.PKEY_RelaunchDisplayName, Program.ManagerTitle),
                        new KeyValuePair<Shell.PROPERTYKEY, string>(Shell.PKEY_RelaunchIcon, exe + ",0"),
                        new KeyValuePair<Shell.PROPERTYKEY, string>(Shell.PKEY_AppUserModelId, AppId),
                    });
                }
            }
            catch (Exception e) { Program.Log("taskbar id failed: " + e.Message); }
        }

        // 剛啟動的視窗要等網頁載入、標題出現才找得到：在背景等最多 15 秒
        public static void StampWhenReady()
        {
            var t = new Thread(() =>
            {
                for (int i = 0; i < 50; i++)
                {
                    Thread.Sleep(300);
                    IntPtr h = Browser.FindManagerWindow();
                    if (h != IntPtr.Zero) { Stamp(h); Native.BringToFront(h); return; }
                }
            }) { IsBackground = true, Name = "taskbar-id" };
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
            pending = t;
        }

        public static void WaitPending(int ms) { var t = pending; if (t != null) t.Join(ms); }
        public static bool Launching { get { var t = pending; return t != null && t.IsAlive; } }
    }

    // 桌面與開始功能表的「ASCII 動態桌布」捷徑（帶 /open，並使用同一個工作列身分）。
    // 名稱跟著介面語言（英文是「ASCII Live Wallpaper」）；同一個資料夾裡另一種語言的舊捷徑
    // 如果也指向這個播放器就移除，換語言後重新建立不會留下兩個
    static class Shortcuts
    {
        public static string Create()
        {
            return CreateIn(new[] { Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Environment.GetFolderPath(Environment.SpecialFolder.Programs) });
        }

        public static string CreateIn(IEnumerable<string> dirs)
        {
            try
            {
                string exe = Application.ExecutablePath, name = Program.ManagerTitle;
                foreach (var dir in dirs)
                {
                    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) continue;
                    Shell.CreateLink(Path.Combine(dir, name + ".lnk"), exe, "/open", Path.GetDirectoryName(exe), exe, 0,
                        I18n.T("ASCII 動態桌布：挑選、轉換動態桌布並放到桌面", "ASCII Live Wallpaper: pick or convert live wallpapers and put them on your desktop"), TaskbarId.AppId);
                    foreach (var other in Program.ManagerTitles)
                    {
                        if (other == name) continue;
                        string old = Path.Combine(dir, other + ".lnk");
                        try { if (File.Exists(old) && SamePath(Shell.LinkTarget(old), exe)) { File.Delete(old); Program.Log("removed old shortcut " + old); } }
                        catch (Exception e) { Program.Log("remove old shortcut failed: " + e.Message); }
                    }
                }
                Program.Log("shortcuts created");
                return null;
            }
            catch (Exception e) { Program.Log("shortcuts failed: " + e); return e.Message; }
        }

        static bool SamePath(string a, string b)
        {
            try { return !string.IsNullOrEmpty(a) && string.Equals(Path.GetFullPath(a), Path.GetFullPath(b), StringComparison.OrdinalIgnoreCase); }
            catch (Exception) { return false; }
        }
    }

    // Shell 屬性與捷徑的 COM 介面（不需要額外的組件）
    static class Shell
    {
        [StructLayout(LayoutKind.Sequential, Pack = 4)]
        public struct PROPERTYKEY { public Guid fmtid; public uint pid; public PROPERTYKEY(Guid g, uint p) { fmtid = g; pid = p; } }
        [StructLayout(LayoutKind.Explicit, Size = 24)]
        struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr p; }

        static readonly Guid AUMID = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
        public static readonly PROPERTYKEY PKEY_AppUserModelId = new PROPERTYKEY(AUMID, 5);
        public static readonly PROPERTYKEY PKEY_RelaunchCommand = new PROPERTYKEY(AUMID, 2);
        public static readonly PROPERTYKEY PKEY_RelaunchIcon = new PROPERTYKEY(AUMID, 3);
        public static readonly PROPERTYKEY PKEY_RelaunchDisplayName = new PROPERTYKEY(AUMID, 4);

        [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IPropertyStore
        {
            [PreserveSig] int GetCount(out uint c);
            [PreserveSig] int GetAt(uint i, out PROPERTYKEY k);
            [PreserveSig] int GetValue(ref PROPERTYKEY k, IntPtr pv);
            [PreserveSig] int SetValue(ref PROPERTYKEY k, ref PROPVARIANT pv);
            [PreserveSig] int Commit();
        }

        [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder file, int cch, IntPtr fd, uint flags);
            void GetIDList(out IntPtr pidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder name, int cch);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder dir, int cch);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string dir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder args, int cch);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string args);
            void GetHotkey(out short key);
            void SetHotkey(short key);
            void GetShowCmd(out int cmd);
            void SetShowCmd(int cmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int cch, out int index);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string rel, uint reserved);
            void Resolve(IntPtr hwnd, uint flags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string file);
        }

        [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
        class CShellLink { }

        [DllImport("shell32.dll")]
        static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore store);
        [DllImport("ole32.dll")]
        static extern int PropVariantClear(ref PROPVARIANT pv);

        static void SetString(IPropertyStore st, PROPERTYKEY key, string value)
        {
            var pv = new PROPVARIANT { vt = 31 /* VT_LPWSTR */, p = Marshal.StringToCoTaskMemUni(value) };
            try { Marshal.ThrowExceptionForHR(st.SetValue(ref key, ref pv)); }
            finally { PropVariantClear(ref pv); }
        }

        public static void SetWindowProps(IntPtr hwnd, KeyValuePair<PROPERTYKEY, string>[] props)
        {
            Guid iid = typeof(IPropertyStore).GUID;
            IPropertyStore st;
            Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref iid, out st));
            try { foreach (var kv in props) SetString(st, kv.Key, kv.Value); st.Commit(); }
            finally { Marshal.ReleaseComObject(st); }
        }

        public static void CreateLink(string path, string target, string args, string workDir, string icon, int iconIndex, string desc, string appId)
        {
            var link = (IShellLinkW)new CShellLink();
            try
            {
                link.SetPath(target);
                link.SetArguments(args);
                link.SetWorkingDirectory(workDir);
                link.SetIconLocation(icon, iconIndex);
                link.SetDescription(desc);
                var st = (IPropertyStore)link;
                SetString(st, PKEY_AppUserModelId, appId);
                Marshal.ThrowExceptionForHR(st.Commit());
                ((System.Runtime.InteropServices.ComTypes.IPersistFile)link).Save(path, true);
            }
            finally { Marshal.ReleaseComObject(link); }
        }

        // 捷徑指向的程式
        public static string LinkTarget(string path)
        {
            var link = (IShellLinkW)new CShellLink();
            try
            {
                ((System.Runtime.InteropServices.ComTypes.IPersistFile)link).Load(path, 0 /* STGM_READ */);
                var sb = new StringBuilder(1024);
                link.GetPath(sb, sb.Capacity, IntPtr.Zero, 0);
                return sb.ToString();
            }
            finally { Marshal.ReleaseComObject(link); }
        }
    }

    // ───────────────────────── 桌面嵌入 ─────────────────────────
    static class Desktop
    {
        static DateTime lastSpawn = DateTime.MinValue;

        // 請 Progman 建立放桌布用的 WorkerW。只在啟動、explorer 重啟、或找不到時送（重送會讓整個桌面閃一下）
        public static void SpawnLayer(bool force)
        {
            if (!force && (DateTime.Now - lastSpawn).TotalSeconds < 10) return;
            lastSpawn = DateTime.Now;
            IntPtr progman = Native.FindWindow("Progman", null), r;
            if (progman != IntPtr.Zero) Native.SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(0x1), Native.SMTO_NORMAL, 1000, out r);
        }

        // 找桌布層（在桌面圖示後面）；還沒準備好就回傳 0，絕不退而求其次放錯地方
        public static IntPtr FindLayer()
        {
            IntPtr progman = Native.FindWindow("Progman", null);
            if (progman == IntPtr.Zero) return IntPtr.Zero;
            // Windows 11 24H2 之後：圖示（SHELLDLL_DefView）和 WorkerW 都是 Progman 的子視窗，WorkerW 在圖示下面
            if (Native.FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero)
                return Native.FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
            // 舊版 Windows：含有 SHELLDLL_DefView 的頂層視窗，後面緊接著的 WorkerW
            IntPtr legacy = IntPtr.Zero;
            Native.EnumWindows((top, l) =>
            {
                if (top != progman && Native.FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero)
                    legacy = Native.FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
                return legacy == IntPtr.Zero;
            }, IntPtr.Zero);
            return legacy;
        }

        public static bool Embed(Surface s)
        {
            IntPtr layer = FindLayer();
            if (layer == IntPtr.Zero) { SpawnLayer(false); layer = FindLayer(); }
            if (layer == IntPtr.Zero || s.Hwnd == IntPtr.Zero) return false;
            if (!s.HostAlive) s.Host = new HostWindow(layer);
            IntPtr host = s.Host.Handle;
            if (Native.GetAncestor(host, 1 /* GA_PARENT */) != layer) Native.SetParent(host, layer);
            var pt = new Native.POINT { X = s.Mon.Bounds.X, Y = s.Mon.Bounds.Y };
            Native.MapWindowPoints(IntPtr.Zero, layer, ref pt, 1);
            Native.SetWindowPos(host, IntPtr.Zero, pt.X, pt.Y, s.Mon.Bounds.Width, s.Mon.Bounds.Height, Native.SWP_NOACTIVATE | Native.SWP_NOZORDER);

            IntPtr hwnd = s.Hwnd;
            long style = Native.GetWindowLongPtr(hwnd, Native.GWL_STYLE).ToInt64();
            style &= ~(long)(Native.WS_CAPTION | Native.WS_THICKFRAME | Native.WS_POPUP | Native.WS_SYSMENU | Native.WS_MINIMIZEBOX | Native.WS_MAXIMIZEBOX | Native.WS_MINIMIZE | Native.WS_MAXIMIZE);
            style |= Native.WS_CHILD | Native.WS_CLIPSIBLINGS;
            Native.SetWindowLongPtr(hwnd, Native.GWL_STYLE, new IntPtr(style));
            long ex = Native.GetWindowLongPtr(hwnd, Native.GWL_EXSTYLE).ToInt64();
            ex &= ~(long)(Native.WS_EX_APPWINDOW | Native.WS_EX_WINDOWEDGE | Native.WS_EX_CLIENTEDGE | Native.WS_EX_DLGMODALFRAME | Native.WS_EX_TOPMOST);
            ex |= Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE | Native.WS_EX_NOPARENTNOTIFY;
            Native.SetWindowLongPtr(hwnd, Native.GWL_EXSTYLE, new IntPtr(ex));
            if (Native.GetAncestor(hwnd, 1) != host) Native.SetParent(hwnd, host);
            Native.SetWindowPos(hwnd, IntPtr.Zero, 0, 0, s.Mon.Bounds.Width, s.Mon.Bounds.Height, Native.SWP_NOACTIVATE | Native.SWP_NOZORDER | Native.SWP_FRAMECHANGED);
            Fit(s);
            return Native.GetAncestor(hwnd, 1) == host && Native.GetAncestor(host, 1) == layer;
        }

        // 容器還在桌布層裡、位置大小也正確嗎（顯示設定或 explorer 變動後可能跑掉）
        public static bool InPlace(Surface s)
        {
            if (!s.HostAlive) return false;
            IntPtr layer = FindLayer();
            if (layer == IntPtr.Zero || Native.GetAncestor(s.Host.Handle, 1) != layer || Native.GetAncestor(s.Hwnd, 1) != s.Host.Handle) return false;
            Native.RECT r;
            return Native.GetWindowRect(s.Host.Handle, out r) && Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom) == s.Mon.Bounds;
        }

        // 容器和 Edge 視窗本身是不是「顯示」狀態（只看它們自己的 WS_VISIBLE，不受桌面上層視窗影響）
        public static bool Shown(Surface s)
        {
            if (!s.HostAlive || s.Hwnd == IntPtr.Zero) return true;
            return (Native.GetWindowLongPtr(s.Hwnd, Native.GWL_STYLE).ToInt64() & Native.WS_VISIBLE) != 0
                && (Native.GetWindowLongPtr(s.Host.Handle, Native.GWL_STYLE).ToInt64() & Native.WS_VISIBLE) != 0;
        }

        // Edge 在視窗頂端自己畫標題列、四周有邊框：量出網頁內容區的位移，把整個視窗往左上推並放大，
        // 讓內容區剛好等於螢幕，多出來的標題列和邊框被容器裁掉
        // 網頁內容區相對於 Edge 視窗左上角的位移。優先用頁面自己回報的（outerWidth/innerWidth 算出來，最準）；
        // 還沒回報時才量 Chrome_RenderWidgetHostHWND（這個無障礙子視窗有時位置不對，例如 100% 的螢幕上多算了 26 px）
        public static void Fit(Surface s)
        {
            if (!s.HostAlive || s.Hwnd == IntPtr.Zero) return;
            Native.RECT outer, hostR;
            if (!Native.GetWindowRect(s.Hwnd, out outer) || !Native.GetWindowRect(s.Host.Handle, out hostR)) return;
            int left, top;
            if (s.FitLeft >= 0 && s.FitTop >= 0)
            {
                double scale = Native.MonitorScale(s.Mon.Bounds); // 放進桌面後 GetDpiForWindow 會回報主螢幕的 DPI，要用螢幕本身的
                left = (int)Math.Round(s.FitLeft * scale); top = (int)Math.Round(s.FitTop * scale);
                int w0 = s.Mon.Bounds.Width + 2 * left, h0 = s.Mon.Bounds.Height + top + left;
                if (outer.Left == hostR.Left - left && outer.Top == hostR.Top - top && outer.Right - outer.Left == w0 && outer.Bottom - outer.Top == h0) return;
                Native.SetWindowPos(s.Hwnd, IntPtr.Zero, -left, -top, w0, h0, Native.SWP_NOACTIVATE | Native.SWP_NOZORDER | Native.SWP_ASYNCWINDOWPOS);
                Program.Log("fit " + s.Mon.Id + " inset left=" + left + " top=" + top + "（頁面回報）");
                return;
            }
            IntPtr content = Native.FindWindowEx(s.Hwnd, IntPtr.Zero, "Chrome_RenderWidgetHostHWND", null);
            if (content == IntPtr.Zero) return;
            Native.RECT inner;
            if (!Native.GetWindowRect(content, out inner)) return;
            left = inner.Left - outer.Left; top = inner.Top - outer.Top;
            if (left < 0 || top < 0 || left > 64 || top > 200) return;
            int w = s.Mon.Bounds.Width + 2 * left, h = s.Mon.Bounds.Height + top + left;
            if (inner.Left == hostR.Left && inner.Top == hostR.Top && outer.Right - outer.Left == w && outer.Bottom - outer.Top == h) return;
            Native.SetWindowPos(s.Hwnd, IntPtr.Zero, -left, -top, w, h, Native.SWP_NOACTIVATE | Native.SWP_NOZORDER | Native.SWP_ASYNCWINDOWPOS);
            Program.Log("fit " + s.Mon.Id + " inset left=" + left + " top=" + top);
        }
    }

    // 黑色的容器視窗（每個螢幕一個），建立時先隱藏，Edge 放好後才顯示
    class HostWindow : NativeWindow
    {
        public HostWindow(IntPtr parent)
        {
            CreateHandle(new CreateParams
            {
                ClassName = "STATIC",
                Caption = "ASCIIWP-Host",
                Style = unchecked((int)(Native.WS_CHILD | Native.WS_CLIPCHILDREN | Native.WS_CLIPSIBLINGS | 0x4L /* SS_BLACKRECT */)),
                ExStyle = (int)(Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE | Native.WS_EX_NOPARENTNOTIFY),
                Parent = parent,
                X = 0, Y = 0, Width = 16, Height = 16,
            });
        }
    }

    // ───────────────────────── 滑鼠轉送（互動桌布） ─────────────────────────
    // 桌布在桌面圖示後面，收不到滑鼠。游標在桌面上（不是在其他視窗上）時，把移動、左鍵、滾輪轉送給那個螢幕的桌布，
    // 互動桌布（小遊戲）才玩得到。用 Raw Input（RIDEV_INPUTSINK）在自己的執行緒接收：
    // 只是「旁聽」滑鼠，不像全域滑鼠掛鉤那樣會在播放器忙的時候拖慢整個系統的滑鼠
    static class InputForward
    {
        public class Target { public Rectangle Bounds; public IntPtr Hwnd; }
        static volatile Target[] targets = new Target[0];
        public static void SetTargets(IEnumerable<Target> t) { targets = t.ToArray(); }

        const int WM_INPUT = 0x00FF, WM_MOUSEMOVE = 0x0200, WM_LBUTTONDOWN = 0x0201, WM_LBUTTONUP = 0x0202, WM_MOUSEWHEEL = 0x020A;
        const int MK_LBUTTON = 0x0001;
        static Target downTarget;            // 左鍵在哪個桌布上按下（放開時一定送回同一個，拖到別的視窗上放開也一樣）
        static Point lastPos = new Point(int.MinValue, int.MinValue);
        static int lastMoveAt;

        public static void Start()
        {
            var t = new Thread(() =>
            {
                try
                {
                    var w = new Sink();
                    var dev = new RAWINPUTDEVICE[] { new RAWINPUTDEVICE { usUsagePage = 0x01, usUsage = 0x02, dwFlags = 0x00000100 /* RIDEV_INPUTSINK */, hwndTarget = w.Handle } };
                    if (!RegisterRawInputDevices(dev, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)))) { Program.Log("raw input register failed: " + Marshal.GetLastWin32Error()); return; }
                    Application.Run();
                }
                catch (Exception e) { Program.Log("input thread failed: " + e); }
            }) { IsBackground = true, Name = "input" };
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
        }

        // 只收訊息的隱藏視窗
        class Sink : NativeWindow
        {
            public Sink() { CreateHandle(new CreateParams { Parent = new IntPtr(-3) /* HWND_MESSAGE */ }); }
            protected override void WndProc(ref Message m)
            {
                if (m.Msg == WM_INPUT) { try { OnRawInput(m.LParam); } catch (Exception) { } }
                base.WndProc(ref m);
            }
        }

        static readonly byte[] buf = new byte[64];
        static void OnRawInput(IntPtr hRaw)
        {
            uint size = (uint)buf.Length;
            var h = GCHandle.Alloc(buf, GCHandleType.Pinned);
            try
            {
                if (GetRawInputData(hRaw, 0x10000003 /* RID_INPUT */, h.AddrOfPinnedObject(), ref size, (uint)(IntPtr.Size == 8 ? 24 : 16)) == unchecked((uint)-1)) return;
            }
            finally { h.Free(); }
            if (BitConverter.ToUInt32(buf, 0) != 0 /* RIM_TYPEMOUSE */) return;
            int hdr = IntPtr.Size == 8 ? 24 : 16;
            ushort btn = BitConverter.ToUInt16(buf, hdr + 4);
            short wheel = BitConverter.ToInt16(buf, hdr + 6);
            Point p;
            if (!GetCursorPos(out p)) return;
            if ((btn & 0x0001) != 0) Send("down", p, 0);           // RI_MOUSE_LEFT_BUTTON_DOWN
            if ((btn & 0x0002) != 0) Send("up", p, 0);             // RI_MOUSE_LEFT_BUTTON_UP
            if ((btn & 0x0400) != 0) Send("wheel", p, wheel);      // RI_MOUSE_WHEEL
            if (p != lastPos && unchecked(Environment.TickCount - lastMoveAt) >= 8) { lastPos = p; lastMoveAt = Environment.TickCount; Send("move", p, 0); }
        }

        // 測試用：把指定的螢幕座標當成游標位置送一次（不檢查游標底下是不是桌面）
        public static bool Inject(string type, int x, int y)
        {
            var p = new Point(x, y);
            var t = TargetAt(p);
            if (t == null) return false;
            Post(t, type == "down" ? WM_LBUTTONDOWN : type == "up" ? WM_LBUTTONUP : WM_MOUSEMOVE, type == "down" ? MK_LBUTTON : 0, p);
            return true;
        }

        static Target TargetAt(Point p)
        {
            foreach (var t in targets) if (t.Bounds.Contains(p) && IsWindow(t.Hwnd)) return t;
            return null;
        }

        // 游標底下是桌面（桌面圖示層或桌布層），不是其他程式的視窗
        static bool OverDesktop(Point p)
        {
            IntPtr w = WindowFromPoint(p);
            if (w == IntPtr.Zero) return false;
            IntPtr root = Native.GetAncestor(w, 2 /* GA_ROOT */);
            string cls = Native.ClassOf(root == IntPtr.Zero ? w : root);
            return cls == "Progman" || cls == "WorkerW";
        }

        static void Send(string type, Point p, int wheel)
        {
            if (type == "up")
            {
                var d = downTarget;
                downTarget = null;
                if (d != null && IsWindow(d.Hwnd)) Post(d, WM_LBUTTONUP, 0, p);
                return;
            }
            if (!OverDesktop(p)) return;
            var t = TargetAt(p);
            if (t == null) return;
            if (type == "down") { downTarget = t; Post(t, WM_LBUTTONDOWN, MK_LBUTTON, p); }
            else if (type == "wheel")
            {
                // WM_MOUSEWHEEL 的座標是螢幕座標
                PostMessage(t.Hwnd, WM_MOUSEWHEEL, new IntPtr((wheel << 16) | (downTarget != null ? MK_LBUTTON : 0)), new IntPtr(((p.Y & 0xFFFF) << 16) | (p.X & 0xFFFF)));
            }
            else Post(t, WM_MOUSEMOVE, downTarget != null ? MK_LBUTTON : 0, p);
        }

        // 座標是 Edge 視窗用戶區的實際像素（Edge 自己會依螢幕縮放比例換算；實測 200% 的螢幕也正確）
        static void Post(Target t, int msg, int keys, Point screen)
        {
            var pt = new Native.POINT { X = screen.X, Y = screen.Y };
            if (!ScreenToClient(t.Hwnd, ref pt)) return;
            PostMessage(t.Hwnd, msg, new IntPtr(keys), new IntPtr(((pt.Y & 0xFFFF) << 16) | (pt.X & 0xFFFF)));
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTDEVICE { public ushort usUsagePage, usUsage; public uint dwFlags; public IntPtr hwndTarget; }
        [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] devs, uint n, uint size);
        [DllImport("user32.dll")] static extern uint GetRawInputData(IntPtr hRaw, uint cmd, IntPtr data, ref uint size, uint headerSize);
        [DllImport("user32.dll")] static extern bool GetCursorPos(out Point p);
        [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
        [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr h, ref Native.POINT p);
        [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    }

    // ───────────────────────── 我的收藏 ─────────────────────────
    // 存在 %LOCALAPPDATA%\ASCIIWallpaper\saved：每個收藏一個 .json（名稱、設定、縮圖）和一個 .bin（原始圖片 / GIF / 影片）。
    // 不放在瀏覽器裡：換瀏覽器、清除瀏覽資料都不會不見
    static class Saved
    {
        static readonly object gate = new object();

        public static byte[] ListJson()
        {
            lock (gate)
            {
                Directory.CreateDirectory(Program.SavedDir);
                var parts = new List<string>();
                var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                foreach (var f in Directory.GetFiles(Program.SavedDir, "*.json"))
                {
                    // 壞掉的檔案（例如當機留下的空檔）略過就好，不能讓整個清單讀不出來
                    try
                    {
                        string t = File.ReadAllText(f, Encoding.UTF8).Trim();
                        var o = js.DeserializeObject(t) as Dictionary<string, object>;
                        object oid;
                        if (o != null && o.TryGetValue("id", out oid) && (oid as string) == Path.GetFileNameWithoutExtension(f)) parts.Add(t);
                        else Program.Log("skip saved " + Path.GetFileName(f) + "：內容不對");
                    }
                    catch (Exception e) { Program.Log("skip saved " + Path.GetFileName(f) + "：" + e.Message); }
                }
                return Encoding.UTF8.GetBytes("[" + string.Join(",", parts) + "]");
            }
        }

        static string BadFormat { get { return I18n.T("收藏格式錯誤", "Invalid saved item format"); } }

        // 內容：4 位元組（little-endian）的 JSON 長度 + JSON（收藏資料，不含檔案）+ 檔案本身
        public static string Put(string id, byte[] body)
        {
            if (body.Length < 4) return BadFormat;
            int n = BitConverter.ToInt32(body, 0);
            if (n <= 0 || n > body.Length - 4) return BadFormat;
            string json = Encoding.UTF8.GetString(body, 4, n);
            try
            {
                var o = new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.DeserializeObject(json) as Dictionary<string, object>;
                object oid;
                if (o == null || !o.TryGetValue("id", out oid) || (oid as string) != id) return BadFormat;
            }
            catch (Exception) { return BadFormat; }
            lock (gate)
            {
                Directory.CreateDirectory(Program.SavedDir);
                string bin = Path.Combine(Program.SavedDir, id + ".bin"), meta = Path.Combine(Program.SavedDir, id + ".json");
                bool hadMeta = File.Exists(meta);
                int blobLen = body.Length - 4 - n;
                if (blobLen > 0) Files.WriteAtomic(bin, body, 4 + n, blobLen);
                else if (File.Exists(bin)) File.Delete(bin);
                try { Files.WriteAtomic(meta, Encoding.UTF8.GetBytes(json)); }
                catch (Exception) { if (!hadMeta) { try { File.Delete(bin); } catch (Exception) { } } throw; } // 沒寫成功就別留下看不到的大檔
            }
            return null;
        }

        public static byte[] Blob(string id, out string mime)
        {
            mime = "application/octet-stream";
            lock (gate)
            {
                string bin = Path.Combine(Program.SavedDir, id + ".bin"), meta = Path.Combine(Program.SavedDir, id + ".json");
                if (!File.Exists(bin)) return null;
                try
                {
                    var o = new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.DeserializeObject(File.ReadAllText(meta, Encoding.UTF8)) as Dictionary<string, object>;
                    object t;
                    if (o != null && o.TryGetValue("blobType", out t) && t is string && System.Text.RegularExpressions.Regex.IsMatch((string)t, @"^[A-Za-z0-9.+/-]{1,100}$")) mime = (string)t;
                }
                catch (Exception) { }
                return Files.ReadShared(bin);
            }
        }

        public static void Delete(string id)
        {
            lock (gate)
            {
                // 先刪大檔（檔案被別的程式暫時鎖住時重試），最後才刪 .json：失敗的話收藏還看得到、可以再刪一次
                foreach (var ext in new[] { ".bin", ".json" })
                {
                    string p = Path.Combine(Program.SavedDir, id + ext);
                    for (int i = 0; File.Exists(p); i++)
                    {
                        try { File.Delete(p); }
                        catch (IOException) { if (i >= 8) throw; Thread.Sleep(120); }
                        catch (UnauthorizedAccessException) { if (i >= 8) throw; Thread.Sleep(120); }
                    }
                }
            }
        }
    }

    // ───────────────────────── 暫停狀態（長輪詢） ─────────────────────────
    // 每個螢幕「該不該暫停」、桌布音效開關和介面語言：UI 執行緒更新，HTTP 執行緒在 /api/wait 等它改變
    static class Hub
    {
        static readonly object gate = new object();
        static Dictionary<string, bool> paused = new Dictionary<string, bool>();
        static HashSet<string> hush = new HashSet<string>(); // 被視窗蓋住、但沒暫停的螢幕（自動暫停關掉時）：照常播放、不發聲
        static bool sound = true;   // 桌布音效開關（所有螢幕共用）
        static string lang = "zh";  // 實際的介面語言（zh / en），桌布上畫的文字跟著它

        public static void SetSound(bool on)
        {
            lock (gate)
            {
                if (sound == on) return;
                sound = on;
                Monitor.PulseAll(gate); // 同 Poke：叫醒等待中的頁面
            }
        }

        // 只有實際語言改變才叫醒等待中的頁面（設成一樣的值不會）
        public static void SetLang(string l)
        {
            lock (gate)
            {
                if (lang == l) return;
                lang = l;
                Monitor.PulseAll(gate);
            }
        }

        public static void Publish(Dictionary<string, bool> next, HashSet<string> nextHush)
        {
            lock (gate)
            {
                if (next.Count == paused.Count && next.All(kv => { bool v; return paused.TryGetValue(kv.Key, out v) && v == kv.Value; }) && nextHush.SetEquals(hush)) return;
                paused = next;
                hush = nextHush;
                Monitor.PulseAll(gate);
            }
        }

        public static void Poke() { lock (gate) Monitor.PulseAll(gate); }

        // 版本（換了桌布）、暫停狀態、音效開關或介面語言和頁面目前知道的不同時立刻回覆，否則等到改變或逾時。
        // 音效開關是每個螢幕各自的：總開關打開、而且沒有被視窗蓋住。
        // s = null / l = null：舊版頁面沒有送音效開關 / 語言，當作一樣（不會因此一直立刻回覆、空轉）
        public static Dictionary<string, object> Wait(string mon, string v, bool p, bool? s, string l, int timeoutMs)
        {
            int start = Environment.TickCount;
            lock (gate)
            {
                while (true)
                {
                    // 版本也在鎖裡讀：Poke 要拿同一把鎖，「讀完版本、還沒開始等」之間的通知就不會漏掉
                    string cur = Files.Version(mon);
                    bool cp;
                    paused.TryGetValue(mon, out cp);
                    bool cs = sound && !hush.Contains(mon);
                    int left = timeoutMs - unchecked(Environment.TickCount - start);
                    if (cur != v || cp != p || (s.HasValue && s.Value != cs) || (l != null && l != lang) || left <= 0)
                        return new Dictionary<string, object> { { "v", cur }, { "p", cp }, { "s", cs }, { "l", lang } };
                    Monitor.Wait(gate, left);
                }
            }
        }
    }

    // ───────────────────────── 本機 HTTP 伺服器 ─────────────────────────
    class HttpServer
    {
        readonly PlayerApp app;
        TcpListener listener;
        volatile bool stopped;
        const long MaxWallpaperBytes = 380L * 1024 * 1024, MaxSmallBody = 64 * 1024;
        static readonly string[] Hosts = { "127.0.0.1:" + Program.Port, "localhost:" + Program.Port };
        static readonly string[] Origins = { Program.Origin, "http://localhost:" + Program.Port };

        public HttpServer(PlayerApp app) { this.app = app; }

        public bool Start()
        {
            try { listener = new TcpListener(IPAddress.Loopback, Program.Port); listener.Start(); }
            catch (SocketException e) { Program.Log("listen failed: " + e.Message); return false; }
            try { Native.SetHandleInformation(listener.Server.Handle, 1 /* HANDLE_FLAG_INHERIT */, 0); } catch (Exception) { }
            var t = new Thread(AcceptLoop) { IsBackground = true, Name = "http" };
            t.Start();
            Program.Log("listening on " + Program.Origin);
            return true;
        }

        public void Stop() { stopped = true; try { listener.Stop(); } catch (Exception) { } }

        void AcceptLoop()
        {
            while (!stopped)
            {
                TcpClient c;
                try { c = listener.AcceptTcpClient(); } catch (Exception) { if (stopped) return; continue; }
                ThreadPool.QueueUserWorkItem(_ => Handle(c));
            }
        }

        class Req { public string Method, Path, Query, Origin; public long Length; public Dictionary<string, string> Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); public byte[] Body = new byte[0]; }
        class Res
        {
            public int Status = 200; public string Type = "application/json; charset=utf-8";
            public List<ArraySegment<byte>> Parts = new List<ArraySegment<byte>>();
            public Dictionary<string, string> Headers = new Dictionary<string, string>();
            public Res Add(byte[] b) { Parts.Add(new ArraySegment<byte>(b)); return this; }
            public Res Add(byte[] b, int off, int len) { Parts.Add(new ArraySegment<byte>(b, off, len)); return this; }
        }

        void Handle(TcpClient c)
        {
            try
            {
                using (c)
                using (var ns = c.GetStream())
                {
                    ns.ReadTimeout = 10000;
                    ns.WriteTimeout = 120000;
                    var req = ReadHead(ns);
                    if (req == null) return;
                    Res res;
                    try
                    {
                        res = Check(req);
                        if (res == null)
                        {
                            long max = req.Method == "POST" && (req.Path == "/api/apply" || req.Path == "/api/saved/put") ? MaxWallpaperBytes : MaxSmallBody;
                            if (req.Length > max) res = Error(413, I18n.T("桌布檔太大（上限約 380 MB），請換小一點的檔案", "The wallpaper file is too large (limit about 380 MB), please use a smaller file"));
                            else
                            {
                                string expect;
                                if (req.Length > 0 && req.Headers.TryGetValue("Expect", out expect) && expect.Equals("100-continue", StringComparison.OrdinalIgnoreCase))
                                {
                                    var cont = Encoding.ASCII.GetBytes("HTTP/1.1 100 Continue\r\n\r\n");
                                    ns.Write(cont, 0, cont.Length);
                                }
                                ns.ReadTimeout = 120000;
                                if (!ReadBody(ns, req)) return;
                                res = Route(req);
                            }
                        }
                    }
                    catch (Exception e) { Program.Log("request " + req.Method + " " + req.Path + " failed: " + e.Message); res = Error(500, e.Message); }
                    Write(ns, res, req.Method == "HEAD");
                }
            }
            catch (IOException) { } // 瀏覽器關掉或重新載入時中斷的連線（例如等待中的 /api/wait），不必記錄
            catch (Exception e) { Program.Log("http error: " + e.Message); }
        }

        static Req ReadHead(Stream s)
        {
            var head = new List<byte>(1024);
            int b, state = 0;
            while ((b = s.ReadByte()) >= 0)
            {
                head.Add((byte)b);
                state = (b == '\r' && (state == 0 || state == 2)) ? state + 1 : (b == '\n' && (state == 1 || state == 3)) ? state + 1 : 0;
                if (state == 4) break;
                if (head.Count > 32768) return null;
            }
            if (state != 4) return null;
            var lines = Encoding.ASCII.GetString(head.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
            var first = lines[0].Split(' ');
            if (first.Length < 2) return null;
            var req = new Req { Method = first[0].ToUpperInvariant() };
            string target = first[1];
            int qi = target.IndexOf('?');
            try { req.Path = Uri.UnescapeDataString(qi >= 0 ? target.Substring(0, qi) : target); } catch (Exception) { return null; }
            req.Query = qi >= 0 ? target.Substring(qi + 1) : "";
            for (int i = 1; i < lines.Length; i++)
            {
                int ci = lines[i].IndexOf(':');
                if (ci > 0) req.Headers[lines[i].Substring(0, ci).Trim()] = lines[i].Substring(ci + 1).Trim();
            }
            string v;
            if (req.Headers.TryGetValue("Content-Length", out v)) { long len; if (!long.TryParse(v, out len) || len < 0) return null; req.Length = len; }
            if (req.Headers.ContainsKey("Transfer-Encoding")) return null; // 瀏覽器送的都有 Content-Length
            req.Headers.TryGetValue("Origin", out req.Origin);
            return req;
        }

        static bool ReadBody(Stream s, Req req)
        {
            if (req.Length == 0) return true;
            req.Body = new byte[req.Length];
            long off = 0;
            while (off < req.Length) { int n = s.Read(req.Body, (int)off, (int)Math.Min(req.Length - off, 1 << 20)); if (n <= 0) return false; off += n; }
            return true;
        }

        static void Write(Stream s, Res r, bool headOnly)
        {
            long len = r.Parts.Sum(p => (long)p.Count);
            var sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(r.Status).Append(' ').Append(StatusText(r.Status)).Append("\r\n");
            sb.Append("Content-Type: ").Append(r.Type).Append("\r\n");
            sb.Append("Content-Length: ").Append(len).Append("\r\n");
            sb.Append("Cache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n");
            if (r.Type.StartsWith("text/html")) sb.Append("X-Frame-Options: DENY\r\nContent-Security-Policy: frame-ancestors 'none'\r\n");
            foreach (var kv in r.Headers) sb.Append(kv.Key).Append(": ").Append(kv.Value).Append("\r\n");
            sb.Append("\r\n");
            var head = Encoding.ASCII.GetBytes(sb.ToString());
            s.Write(head, 0, head.Length);
            if (!headOnly) foreach (var p in r.Parts) if (p.Count > 0) s.Write(p.Array, p.Offset, p.Count);
            s.Flush();
        }

        static string StatusText(int s)
        {
            switch (s) { case 200: return "OK"; case 204: return "No Content"; case 400: return "Bad Request"; case 403: return "Forbidden"; case 404: return "Not Found"; case 405: return "Method Not Allowed"; case 413: return "Payload Too Large"; default: return "Error"; }
        }

        static string Q(Req r, string key)
        {
            foreach (var part in r.Query.Split('&'))
            {
                int i = part.IndexOf('=');
                try { if (i > 0 && Uri.UnescapeDataString(part.Substring(0, i)) == key) return Uri.UnescapeDataString(part.Substring(i + 1).Replace('+', ' ')); }
                catch (Exception) { return null; }
            }
            return null;
        }

        static bool IsId(string id) { return id.Length > 0 && id.Length <= 40 && id.All(ch => ch < 128 && char.IsLetterOrDigit(ch)); }

        static Res Json(object o, int status = 200)
        {
            var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            return new Res { Status = status }.Add(Encoding.UTF8.GetBytes(js.Serialize(o)));
        }
        static Res Error(int status, string msg) { return Json(new Dictionary<string, object> { { "ok", false }, { "error", msg } }, status); }
        static Res Html(byte[] body, int status = 200) { return new Res { Status = status, Type = "text/html; charset=utf-8" }.Add(body); }

        bool SameOrigin(Req r) { return r.Origin == null || Origins.Contains(r.Origin, StringComparer.OrdinalIgnoreCase); }

        // 收藏只給播放器自己的頁面讀（其他網站就算猜到網址，瀏覽器送來的請求也會被擋下）
        bool PrivateRead(Req r)
        {
            if (!SameOrigin(r)) return false;
            string site;
            return !r.Headers.TryGetValue("Sec-Fetch-Site", out site) || site == "same-origin" || site == "none";
        }

        // 在讀取內容之前先檢查：不對的請求直接拒絕，不浪費記憶體
        Res Check(Req r)
        {
            string host;
            if (!r.Headers.TryGetValue("Host", out host) || !Hosts.Contains(host, StringComparer.OrdinalIgnoreCase)) return Error(403, "bad host");
            if (r.Method == "OPTIONS")
            {
                var pre = new Res { Status = 204 };
                if (r.Origin != null && SameOrigin(r))
                {
                    pre.Headers["Access-Control-Allow-Origin"] = r.Origin;
                    pre.Headers["Access-Control-Allow-Methods"] = "GET, POST";
                    pre.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-ASCII-WP, X-WP-Title, X-WP-Title-En";
                }
                return pre;
            }
            if (r.Method == "POST")
            {
                // 只接受來自播放器本身管理介面的請求（其他網站無法更改你的桌布）
                if (!SameOrigin(r) || !r.Headers.ContainsKey("X-ASCII-WP")) return Error(403, "forbidden");
                return null;
            }
            if (r.Method == "GET" || r.Method == "HEAD") return null;
            return Error(405, "method not allowed");
        }

        Res Route(Req r)
        {
            if (r.Method == "GET" || r.Method == "HEAD")
            {
                if (r.Path == "/" || r.Path == "/index.html")
                {
                    string f = Path.Combine(Program.AppDir, Program.ManagerFile);
                    if (!File.Exists(f)) return Html(Encoding.UTF8.GetBytes("<meta charset=utf-8><p style='font:16px sans-serif'>" + I18n.T("找不到「" + Program.ManagerFile + "」，請把它放在播放器的同一個資料夾。",
                        "Cannot find \"" + Program.ManagerFile + "\". Please put it in the same folder as the player.") + "</p>"), 404);
                    return Html(Files.ReadShared(f));
                }
                if (r.Path.StartsWith("/w/"))
                {
                    string id = r.Path.Substring(3);
                    if (!IsId(id)) return Error(404, "not found");
                    return Wallpaper(id);
                }
                if (r.Path == "/api/status")
                {
                    // 完整狀態（螢幕排列、桌布名稱）只給播放器自己的頁面；其他來源只知道播放器在執行
                    bool full = SameOrigin(r);
                    var res = Json(app.Ui(() => app.Status(full)));
                    if (r.Origin != null && (full || r.Origin == "null")) res.Headers["Access-Control-Allow-Origin"] = r.Origin;
                    return res;
                }
                if (r.Path == "/api/saved")
                {
                    if (!PrivateRead(r)) return Error(403, "forbidden");
                    return new Res().Add(Saved.ListJson());
                }
                if (r.Path == "/api/saved/blob")
                {
                    if (!PrivateRead(r)) return Error(403, "forbidden");
                    string id = Q(r, "id") ?? "";
                    if (!IsId(id)) return Error(400, "bad id");
                    string mime;
                    byte[] data = Saved.Blob(id, out mime);
                    if (data == null) return Error(404, "not found");
                    return new Res { Type = mime }.Add(data);
                }
                if (r.Path == "/api/wait")
                {
                    // 桌布頁面的長輪詢（只接受播放器自己的頁面）：換桌布、暫停狀態或音效開關改變時立刻回覆，否則最多等 25 秒
                    if (!SameOrigin(r)) return Error(403, "forbidden");
                    string mon = Q(r, "mon") ?? "";
                    if (!IsId(mon)) return Error(400, "bad id");
                    string sq = Q(r, "s"); // 頁面目前知道的音效開關；舊版頁面沒有這個參數
                    bool? s = sq == "1" ? true : sq == "0" ? (bool?)false : null;
                    string lq = Q(r, "l"); // 頁面目前知道的介面語言；舊版頁面沒有（不認得的值也當作沒送，免得空轉）
                    string l = lq == "zh" || lq == "en" ? lq : null;
                    return Json(Hub.Wait(mon, Q(r, "v") ?? "", Q(r, "p") == "1", s, l, 25000));
                }
                if (r.Path == "/api/version")
                {
                    string mon = Q(r, "mon") ?? "";
                    if (!IsId(mon)) return Error(400, "bad id");
                    return Json(new Dictionary<string, object> { { "v", Files.Version(mon) } });
                }
                if (r.Path == "/favicon.ico")
                {
                    byte[] ico = AppIcon();
                    if (ico == null) return new Res { Status = 204 };
                    var res = new Res { Type = "image/x-icon" }.Add(ico);
                    return res;
                }
                return Error(404, "not found");
            }

            Res ok = Json(new Dictionary<string, object> { { "ok", true } });
            if (r.Origin != null) ok.Headers["Access-Control-Allow-Origin"] = r.Origin;
            string err;
            switch (r.Path)
            {
                case "/api/apply":
                    {
                        // 標題放在標頭裡（URL 編碼）：X-WP-Title 中文標題、X-WP-Title-En 英文標題（可省略）
                        string mon = Q(r, "mon"), title = "", titleEn = "", th;
                        if (r.Headers.TryGetValue("X-WP-Title", out th)) { try { title = Uri.UnescapeDataString(th); } catch (Exception) { } }
                        if (r.Headers.TryGetValue("X-WP-Title-En", out th)) { try { titleEn = Uri.UnescapeDataString(th); } catch (Exception) { } }
                        if (string.IsNullOrEmpty(mon) || (mon != "all" && !IsId(mon)) || r.Body.Length == 0) return Error(400, I18n.T("缺少螢幕或桌布內容", "Missing monitor or wallpaper content"));
                        var ids = app.Ui(() => app.ResolveTargets(mon));
                        if (ids.Count == 0) return Error(400, I18n.T("找不到這個螢幕", "Monitor not found"));
                        foreach (var id in ids) Files.WriteAtomic(Files.WallPath(id), r.Body); // 大檔案在這裡寫，不卡住 UI
                        Hub.Poke();
                        err = app.Ui(() => app.Applied(ids, title, titleEn));
                        break;
                    }
                case "/api/clear":
                    {
                        string mon = Q(r, "mon") ?? "all";
                        if (mon != "all" && !IsId(mon)) return Error(400, "bad id");
                        err = app.Ui(() => app.Clear(mon));
                        break;
                    }
                case "/api/pause": err = app.Ui(() => { app.SetPaused(true); return (string)null; }); break;
                case "/api/resume": err = app.Ui(() => { app.SetPaused(false); return (string)null; }); break;
                case "/api/sound":
                    {
                        string on = Q(r, "on");
                        if (on != "0" && on != "1") return Error(400, I18n.T("on 必須是 0 或 1", "on must be 0 or 1"));
                        err = app.Ui(() => { app.SetSound(on == "1"); return (string)null; });
                        break;
                    }
                case "/api/lang":
                    {
                        // 介面語言：v = auto（跟著 Windows）/ zh / en
                        string pref = I18n.ParsePref(Q(r, "v"));
                        if (pref == null) return Error(400, I18n.T("v 必須是 auto、zh 或 en", "v must be auto, zh or en"));
                        app.Ui(() => { app.SetLang(pref); return (string)null; });
                        var res = Json(new Dictionary<string, object> { { "ok", true }, { "lang", I18n.Lang }, { "langPref", I18n.PrefName } });
                        if (r.Origin != null) res.Headers["Access-Control-Allow-Origin"] = r.Origin;
                        return res;
                    }
                case "/api/quit": app.QuitSoon(); err = null; break;
                case "/api/open": err = app.Ui(() => { app.OpenManager(); return (string)null; }); break;
                case "/api/fit":
                    {
                        string mon = Q(r, "mon") ?? "";
                        double l, t;
                        if (!IsId(mon) || !double.TryParse(Q(r, "l"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out l)
                            || !double.TryParse(Q(r, "t"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out t)) return Error(400, "bad fit");
                        err = app.Ui(() => app.ReportFit(mon, l, t));
                        break;
                    }
                case "/api/debug/input":
                    {
                        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASCIIWP_DEBUG_PORT"))) return Error(404, "not found");
                        int x, y;
                        if (!int.TryParse(Q(r, "x"), out x) || !int.TryParse(Q(r, "y"), out y)) return Error(400, "x, y");
                        err = InputForward.Inject(Q(r, "type") ?? "move", x, y) ? null : "no wallpaper at that point";
                        break;
                    }
                case "/api/saved/put":
                    {
                        string id = Q(r, "id") ?? "";
                        if (!IsId(id)) return Error(400, "bad id");
                        err = Saved.Put(id, r.Body);
                        break;
                    }
                case "/api/saved/delete":
                    {
                        string id = Q(r, "id") ?? "";
                        if (!IsId(id)) return Error(400, "bad id");
                        Saved.Delete(id);
                        err = null;
                        break;
                    }
                case "/api/saved/migrated": err = app.Ui(() => app.MigrationDone()); break;
                default: return Error(404, "not found");
            }
            return err == null ? ok : Error(400, err);
        }

        // 桌布檔裡存的是當時的完整網頁。送出時只取出它的桌布設定，放進目前版本的管理介面，
        // 這樣更新程式之後舊桌布也會用到最新的繪圖引擎。全程以位元組處理，不複製整份大檔。
        // 同時把視窗標題設成識別碼、附上檔案版本，頁面不必等腳本執行完才能被找到。
        static readonly byte[] ConfigOpen = Encoding.ASCII.GetBytes("<script id=\"wp-config\" type=\"application/json\">"),
            ScriptClose = Encoding.ASCII.GetBytes("</script>"), Placeholder = Encoding.ASCII.GetBytes("<!--WP-CONFIG-->"),
            TitleOpen = Encoding.ASCII.GetBytes("<title>"), TitleClose = Encoding.ASCII.GetBytes("</title>");

        static Res Wallpaper(string id)
        {
            string wall = Files.WallPath(id), token = "ASCIIWP-" + id;
            if (!File.Exists(wall))
                return Html(Encoding.UTF8.GetBytes("<!doctype html><meta charset=utf-8><title>" + token + "</title><meta http-equiv=refresh content=3><body style='background:#000'>"), 404);
            string version = Files.Version(id);
            byte[] raw = Files.ReadShared(wall);
            string mgrPath = Path.Combine(Program.AppDir, Program.ManagerFile);
            byte[] mgr = File.Exists(mgrPath) ? Files.ReadShared(mgrPath) : null;
            int a = Find(raw, ConfigOpen, 0), b = a < 0 ? -1 : Find(raw, ScriptClose, a);
            int p = mgr == null ? -1 : Find(mgr, Placeholder, 0);
            var res = new Res { Type = "text/html; charset=utf-8" };
            if (a < 0 || b < 0 || p < 0) return res.Add(raw); // 舊格式或管理介面不見了：原樣送出
            int t0 = Find(mgr, TitleOpen, 0), t1 = t0 < 0 ? -1 : Find(mgr, TitleClose, t0);
            if (t0 >= 0 && t1 > t0 && t1 < p) res.Add(mgr, 0, t0 + TitleOpen.Length).Add(Encoding.ASCII.GetBytes(token)).Add(mgr, t1, p - t1);
            else res.Add(mgr, 0, p);
            res.Add(Encoding.ASCII.GetBytes("<meta name=\"wp-version\" content=\"" + version + "\">"));
            res.Add(raw, a, b + ScriptClose.Length - a).Add(mgr, p + Placeholder.Length, mgr.Length - p - Placeholder.Length);
            return res;
        }

        static byte[] appIcon;
        static byte[] AppIcon()
        {
            if (appIcon != null) return appIcon;
            try
            {
                using (var st = typeof(HttpServer).Assembly.GetManifestResourceStream("app.ico"))
                {
                    if (st == null) return null;
                    var ms = new MemoryStream();
                    st.CopyTo(ms);
                    return appIcon = ms.ToArray();
                }
            }
            catch (Exception) { return null; }
        }

        static int Find(byte[] hay, byte[] needle, int start)
        {
            for (int i = start, last = hay.Length - needle.Length; i <= last; i++)
            {
                if (hay[i] != needle[0]) continue;
                int k = 1;
                while (k < needle.Length && hay[i + k] == needle[k]) k++;
                if (k == needle.Length) return i;
            }
            return -1;
        }
    }

    // ───────────────────────── Win32 ─────────────────────────
    static class Native
    {
        public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct DISPLAY_DEVICE
        {
            public int cb;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
            public int StateFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
        }

        public const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
        public const long WS_CHILD = 0x40000000L, WS_CLIPCHILDREN = 0x02000000L, WS_CLIPSIBLINGS = 0x04000000L, WS_POPUP = 0x80000000L,
            WS_CAPTION = 0x00C00000L, WS_THICKFRAME = 0x00040000L, WS_SYSMENU = 0x00080000L, WS_MINIMIZEBOX = 0x00020000L, WS_MAXIMIZEBOX = 0x00010000L,
            WS_MINIMIZE = 0x20000000L, WS_MAXIMIZE = 0x01000000L;
        public const long WS_EX_APPWINDOW = 0x40000L, WS_EX_WINDOWEDGE = 0x100L, WS_EX_CLIENTEDGE = 0x200L, WS_EX_DLGMODALFRAME = 0x1L,
            WS_EX_TOPMOST = 0x8L, WS_EX_TOOLWINDOW = 0x80L, WS_EX_NOACTIVATE = 0x08000000L, WS_EX_TRANSPARENT = 0x20L, WS_EX_LAYERED = 0x80000L, WS_EX_NOPARENTNOTIFY = 0x4L;
        public const long WS_VISIBLE = 0x10000000L;
        public const uint EVENT_SYSTEM_FOREGROUND = 0x0003, EVENT_SYSTEM_MOVESIZEEND = 0x000B, EVENT_SYSTEM_MINIMIZESTART = 0x0016, EVENT_SYSTEM_MINIMIZEEND = 0x0017,
            EVENT_OBJECT_SHOW = 0x8002, EVENT_OBJECT_HIDE = 0x8003,
            EVENT_OBJECT_CLOAKED = 0x8017, EVENT_OBJECT_UNCLOAKED = 0x8018,
            WINEVENT_OUTOFCONTEXT = 0x0, WINEVENT_SKIPOWNPROCESS = 0x2;
        public delegate void WinEventProc(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
        public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10, SWP_FRAMECHANGED = 0x20, SWP_ASYNCWINDOWPOS = 0x4000;
        public const int SW_HIDE = 0, SW_SHOWNA = 8;
        public const uint SMTO_NORMAL = 0x0;
        public const uint WM_CLOSE = 0x0010;
        public const int WM_WTSSESSION_CHANGE = 0x02B1, WM_POWERBROADCAST = 0x0218;
        public const long PBT_POWERSETTINGCHANGE = 0x8013;
        public static readonly Guid GUID_CONSOLE_DISPLAY_STATE = new Guid("6FE69556-704A-47A0-8F24-C28D936FDA47");
        [StructLayout(LayoutKind.Sequential, Pack = 4)] public struct POWERBROADCAST_SETTING { public Guid PowerSetting; public uint DataLength; public uint Data; }
        [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr RegisterPowerSettingNotification(IntPtr hRecipient, ref Guid powerSettingGuid, int flags);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool UnregisterPowerSettingNotification(IntPtr handle);
        [DllImport("wtsapi32.dll", SetLastError = true)] public static extern bool WTSRegisterSessionNotification(IntPtr hWnd, int flags);
        [DllImport("wtsapi32.dll", SetLastError = true)] public static extern bool WTSUnRegisterSessionNotification(IntPtr hWnd);
        [DllImport("wtsapi32.dll", SetLastError = true)] static extern bool WTSQuerySessionInformationW(IntPtr server, int sessionId, int infoClass, out IntPtr buffer, out int bytes);
        [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr p);

        // 這個工作階段現在是不是「沒人在看」：已鎖定，或連線中斷（切換到別的使用者、遠端斷線）。查不到就回傳 null
        public static bool? SessionAway()
        {
            IntPtr buf; int n;
            if (!WTSQuerySessionInformationW(IntPtr.Zero /* 本機 */, -1 /* 目前的工作階段 */, 25 /* WTSSessionInfoEx */, out buf, out n) || buf == IntPtr.Zero) return null;
            try
            {
                // WTSINFOEXW：Level（= 1），接著是對齊 8 bytes 的 WTSINFOEX_LEVEL1_W：SessionId、SessionState、SessionFlags…
                if (n < 20 || Marshal.ReadInt32(buf, 0) != 1) return null;
                int state = Marshal.ReadInt32(buf, 12), flags = Marshal.ReadInt32(buf, 16);
                if (state != 0 /* WTSActive */) return true;
                if (flags == 0 /* WTS_SESSIONSTATE_LOCK */) return true;
                if (flags == 1 /* WTS_SESSIONSTATE_UNLOCK */) return false;
                return null;
            }
            finally { WTSFreeMemory(buf); }
        }

        [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] public static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr hmod, WinEventProc proc, uint pid, uint tid, uint flags);
        [DllImport("user32.dll")] public static extern bool UnhookWinEvent(IntPtr hook);
        [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
        [DllImport("user32.dll")] static extern bool GetLayeredWindowAttributes(IntPtr h, out uint key, out byte alpha, out uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int n);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
        [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern int MapWindowPoints(IntPtr from, IntPtr to, ref POINT pt, uint n);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int idx);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int idx, IntPtr v);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll", EntryPoint = "GetWindowThreadProcessId")] static extern uint GetWindowThread(IntPtr h, IntPtr pid);
        [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int RegisterWindowMessage(string name);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool EnumDisplayDevices(string device, uint devNum, ref DISPLAY_DEVICE dd, uint flags);
        [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
        [DllImport("kernel32.dll")] public static extern bool SetHandleInformation(IntPtr h, int mask, int flags);
        [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);
        [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmGetWindowRect(IntPtr h, int attr, out RECT value, int size);

        public static string ClassOf(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
        public static string TextOf(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }

        public static uint ShellPid()
        {
            uint pid;
            GetWindowThreadProcessId(FindWindow("Shell_TrayWnd", null), out pid);
            return pid;
        }

        // 視窗是不是掛在桌面（Progman）底下：我們的桌布、桌面圖示都是
        public static bool IsUnderDesktop(IntPtr h)
        {
            if (h == IntPtr.Zero) return false;
            IntPtr root = GetAncestor(h, 2 /* GA_ROOT */);
            return root != IntPtr.Zero && root != h && ClassOf(root) == "Progman";
        }

        public static void BringToFront(IntPtr h)
        {
            if (IsIconic(h)) ShowWindowAsync(h, 9 /* SW_RESTORE */); // 非同步：對方程式卡住時也不會拖住播放器
            if (!SetForegroundWindow(h)) GiveFocusTo(h);
        }

        [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(Point p, uint flags);
        [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr mon, int type, out uint dpiX, out uint dpiY);
        // 螢幕的縮放比例（100% = 1、200% = 2）
        public static double MonitorScale(Rectangle bounds)
        {
            try
            {
                IntPtr m = MonitorFromPoint(new Point(bounds.X + bounds.Width / 2, bounds.Y + bounds.Height / 2), 2 /* MONITOR_DEFAULTTONEAREST */);
                uint dx, dy;
                if (m != IntPtr.Zero && GetDpiForMonitor(m, 0 /* MDT_EFFECTIVE_DPI */, out dx, out dy) == 0 && dx > 0) return dx / 96.0;
            }
            catch (Exception) { }
            return 1;
        }

        [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
        [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int cls, IntPtr buf, int len, out int retLen);
        // 行程的命令列；讀不到（行程已結束、沒有權限）回傳 null
        public static string CommandLine(uint pid)
        {
            IntPtr h = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
            if (h == IntPtr.Zero) return null;
            try
            {
                int len;
                NtQueryInformationProcess(h, 60 /* ProcessCommandLineInformation */, IntPtr.Zero, 0, out len);
                if (len <= 0 || len > 1 << 20) len = 65536;
                IntPtr buf = Marshal.AllocHGlobal(len);
                try
                {
                    if (NtQueryInformationProcess(h, 60, buf, len, out len) != 0) return null;
                    int bytes = Marshal.ReadInt16(buf) & 0xFFFF;                 // UNICODE_STRING.Length
                    IntPtr text = Marshal.ReadIntPtr(buf, IntPtr.Size);           // UNICODE_STRING.Buffer
                    return text == IntPtr.Zero ? "" : Marshal.PtrToStringUni(text, bytes / 2);
                }
                finally { Marshal.FreeHGlobal(buf); }
            }
            finally { CloseHandle(h); }
        }

        public static bool IsShellWindow(IntPtr h)
        {
            IntPtr root = GetAncestor(h, 2);
            return ShellClasses.Contains(ClassOf(root == IntPtr.Zero ? h : root));
        }

        // 記錄檔用的視窗描述：程式名稱和視窗類別（不記標題，避免把其他程式的內容寫進記錄檔）
        public static string Describe(IntPtr h)
        {
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            string pn = "?";
            try { using (var p = Process.GetProcessById((int)pid)) pn = p.ProcessName; } catch (Exception) { }
            return pn + " " + ClassOf(h) + (IsZoomed(h) ? " 最大化" : "");
        }

        // 把焦點還給指定視窗（暫時連接到目前前景執行緒的輸入佇列，系統才會允許）
        public static void GiveFocusTo(IntPtr target)
        {
            uint fgThread = GetWindowThread(GetForegroundWindow(), IntPtr.Zero), me = GetCurrentThreadId();
            bool attached = fgThread != 0 && fgThread != me && AttachThreadInput(me, fgThread, true);
            SetForegroundWindow(target);
            if (attached) AttachThreadInput(me, fgThread, false);
        }

        static readonly HashSet<string> ShellClasses = new HashSet<string> {
            "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow",
            "XamlExplorerHostIslandWindow", "TopLevelWindowForOverflowXamlIsland", "NotifyIconOverflowWindow", "ForegroundStaging" };

        // 哪些螢幕被視窗完全蓋住（最大化、全螢幕、或幾乎蓋滿可用區域）。by 記錄是哪個視窗蓋住的。
        // 使用者正在看桌面（點了桌面或按 Win+D）時一律當作沒被蓋住。拿不準的視窗（半透明、去背）一律不算蓋住。
        public static HashSet<string> CoveredMonitors(List<Mon> mons, Dictionary<string, IntPtr> by)
        {
            var covered = new HashSet<string>();
            IntPtr fg = GetForegroundWindow();
            if (fg != IntPtr.Zero)
            {
                IntPtr root = GetAncestor(fg, 2);
                string rc = ClassOf(root == IntPtr.Zero ? fg : root);
                if (rc == "Progman" || rc == "WorkerW") return covered;
            }
            EnumWindows((h, l) =>
            {
                if (covered.Count >= mons.Count) return false; // 全部螢幕都蓋住了，不用再看
                if (!IsWindowVisible(h) || IsIconic(h)) return true;
                long ex = GetWindowLongPtr(h, GWL_EXSTYLE).ToInt64();
                if ((ex & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT)) != 0) return true;
                Rectangle wr;
                if (!FrameRect(h, out wr)) return true;
                bool zoomed = IsZoomed(h);
                List<Mon> hits = null;
                foreach (var m in mons)
                    if (!covered.Contains(m.Id) && Covers(wr, zoomed, m)) (hits ?? (hits = new List<Mon>())).Add(m);
                if (hits == null) return true;
                // 只對「大到能蓋住螢幕」的視窗做下面這些比較慢的檢查
                int cloaked;
                if (DwmGetWindowAttribute(h, 14 /* DWMWA_CLOAKED */, out cloaked, 4) == 0 && cloaked != 0) return true;
                if ((ex & WS_EX_LAYERED) != 0 && !LayeredOpaque(h)) return true;
                if (ShellClasses.Contains(ClassOf(h)) || TextOf(h).StartsWith("ASCIIWP-")) return true;
                foreach (var m in hits) { covered.Add(m.Id); if (by != null) by[m.Id] = h; }
                return true;
            }, IntPtr.Zero);
            return covered;
        }

        // 某個之前蓋住螢幕的視窗現在還蓋著嗎（給 250 ms 的快速檢查用，只看這一個視窗）
        public static bool StillCovers(IntPtr h, Mon m)
        {
            if (!IsWindow(h) || !IsWindowVisible(h) || IsIconic(h)) return false;
            int cloaked;
            if (DwmGetWindowAttribute(h, 14 /* DWMWA_CLOAKED */, out cloaked, 4) == 0 && cloaked != 0) return false;
            Rectangle wr;
            return FrameRect(h, out wr) && Covers(wr, IsZoomed(h), m);
        }

        static bool FrameRect(IntPtr h, out Rectangle wr)
        {
            RECT r;
            wr = Rectangle.Empty;
            if (DwmGetWindowRect(h, 9 /* DWMWA_EXTENDED_FRAME_BOUNDS */, out r, Marshal.SizeOf(typeof(RECT))) != 0 && !GetWindowRect(h, out r)) return false;
            wr = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            return wr.Width > 0 && wr.Height > 0;
        }

        // 最大化而且佔了一半以上，或幾乎蓋滿（95%）扣掉工作列的範圍
        static bool Covers(Rectangle wr, bool zoomed, Mon m)
        {
            var inter = Rectangle.Intersect(wr, m.Work);
            long area = (long)inter.Width * inter.Height, need = (long)m.Work.Width * m.Work.Height;
            return need > 0 && ((zoomed && area > need / 2) || area >= need * 95 / 100);
        }

        // 分層視窗是否完全不透明：只有整體 alpha = 255 又沒有去背色才算。
        // 逐像素透明（UpdateLayeredWindow）的視窗查不到，可能是透明的覆蓋層，當作會透出桌布
        static bool LayeredOpaque(IntPtr h)
        {
            uint key, flags; byte alpha;
            if (!GetLayeredWindowAttributes(h, out key, out alpha, out flags)) return false;
            if ((flags & 0x1 /* LWA_COLORKEY */) != 0) return false;
            return (flags & 0x2 /* LWA_ALPHA */) == 0 || alpha == 255;
        }
    }
}
