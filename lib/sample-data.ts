// Front-end sample data for the Guidoo UI.
//
// These screens are built from the Figma mockups only. The backend does not
// yet expose GET endpoints for the dashboard task list, the calendar, the
// chat conversation list, or the note history, so the pages render from the
// fixtures below. Swap each `SAMPLE_*` export for a real `fetch(...)` once the
// corresponding route exists.

export type TeacherIdentity = {
  name: string;
  initial: string;
  year: string; // 學年
  className: string; // 班級
  studentCount: number;
};

export const SAMPLE_TEACHER: TeacherIdentity = {
  name: "王小美 老師",
  initial: "王",
  year: "116 學年",
  className: "三年 2 班",
  studentCount: 25,
};

export type ParentIdentity = {
  name: string; // e.g. 徐晨哲 家長
  childName: string;
  className: string;
  teacherName: string;
  teacherInitial: string;
  teacherReplyHint: string;
};

export const SAMPLE_PARENT: ParentIdentity = {
  name: "徐晨哲 家長",
  childName: "徐晨哲",
  className: "三年 2 班",
  teacherName: "王小美 老師",
  teacherInitial: "王",
  teacherReplyHint: "通常 1 小時內回覆",
};

/* ------------------------------------------------------------------ */
/* Dashboard — 今日待處理                                             */
/* ------------------------------------------------------------------ */

export type TaskPriority = "urgent" | "watch" | "info";

export type DashboardTask = {
  id: string;
  studentName: string;
  summary: string;
  time: string;
  priority: TaskPriority;
  done: boolean;
  conversationId: string; // which chat thread this card opens
};

export const SAMPLE_TASKS: DashboardTask[] = [
  {
    id: "t1",
    studentName: "徐晨哲",
    summary: "午休衝突後需與家長聯繫",
    time: "10:24",
    priority: "urgent",
    done: false,
    conversationId: "c1",
  },
  {
    id: "t2",
    studentName: "邱品諺",
    summary: "連續三天未交數學作業",
    time: "08:27",
    priority: "urgent",
    done: false,
    conversationId: "c2",
  },
  {
    id: "t3",
    studentName: "林子晴",
    summary: "午餐幾乎未進食，需觀察",
    time: "09:56",
    priority: "watch",
    done: false,
    conversationId: "c3",
  },
  {
    id: "t4",
    studentName: "曾若瑄",
    summary: "數學小考進步 15 分",
    time: "昨天",
    priority: "info",
    done: false,
    conversationId: "c5",
  },
  {
    id: "t5",
    studentName: "郭冠霖",
    summary: "校外教學同意書尚未回收",
    time: "昨天",
    priority: "info",
    done: false,
    conversationId: "c6",
  },
  {
    id: "t6",
    studentName: "蘇宥勳",
    summary: "多次上學遲到",
    time: "昨天",
    priority: "info",
    done: true,
    conversationId: "c4",
  },
];

/* ------------------------------------------------------------------ */
/* Dashboard — 行事曆                                                 */
/* ------------------------------------------------------------------ */

export type CalendarEvent = {
  date: string; // ISO yyyy-mm-dd
  label: string; // 9/9
  title: string;
  detail?: string;
};

export const SAMPLE_CALENDAR_MONTH = { year: 2026, month: 9 }; // 2026 年 9 月

export const SAMPLE_EVENTS: CalendarEvent[] = [
  { date: "2026-09-09", label: "9/9", title: "班親會", detail: "19:00 教室" },
  { date: "2026-09-15", label: "9/15", title: "校外教學 · 同意書回收" },
  { date: "2026-09-22", label: "9/22", title: "期中考週" },
];

/* ------------------------------------------------------------------ */
/* Chatroom — conversation list + threads                             */
/* ------------------------------------------------------------------ */

export type ChatAuthor = "parent" | "agent" | "teacher";

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  text: string;
  time: string;
  read?: boolean; // show 已讀 under the latest outgoing message
};

export type Conversation = {
  id: string;
  parentName: string; // 徐晨哲 媽媽
  initial: string;
  className: string;
  lastReplyTime: string;
  preview: string;
  time: string;
  urgent: boolean;
  messages: ChatMessage[];
};

export const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    parentName: "徐晨哲 媽媽",
    initial: "徐",
    className: "三年 2 班",
    lastReplyTime: "10:24",
    preview: "老師好，我下午三點後有空…",
    time: "10:24",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師好，晨哲昨天回家有提到午休的事。", time: "10:18" },
      {
        id: "m2",
        author: "agent",
        text: "媽媽好，今天午休時和同學有口角，我已經陪兩個孩子談過，情緒都平穩了。",
        time: "10:20",
        read: true,
      },
      { id: "m3", author: "parent", text: "謝謝老師，我下午三點後有空，可以聊 5 分鐘嗎？", time: "10:22" },
      {
        id: "m4",
        author: "teacher",
        text: "沒問題，我三點半打給您，先跟您約在電話上。",
        time: "10:24",
      },
    ],
  },
  {
    id: "c2",
    parentName: "邱品諺 爸爸",
    initial: "邱",
    className: "三年 2 班",
    lastReplyTime: "09:12",
    preview: "作業的部分我會盯著他…",
    time: "09:12",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師，品諺這週的數學作業狀況如何？", time: "09:05" },
      {
        id: "m2",
        author: "agent",
        text: "爸爸好，品諺這三天有兩次未交作業，今天已經和他確認過原因。",
        time: "09:08",
        read: true,
      },
      { id: "m3", author: "parent", text: "作業的部分我會盯著他，謝謝老師提醒。", time: "09:12" },
    ],
  },
  {
    id: "c3",
    parentName: "林子晴 媽媽",
    initial: "林",
    className: "三年 2 班",
    lastReplyTime: "昨天",
    preview: "她最近腸胃不太好…",
    time: "昨天",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師，子晴這兩天午餐吃得很少。", time: "昨天 12:40" },
      { id: "m2", author: "parent", text: "她最近腸胃不太好，麻煩老師多留意一下。", time: "昨天 12:41" },
      {
        id: "m3",
        author: "teacher",
        text: "好的，我今天午餐會特別注意，觀察兩天後再跟您回報。",
        time: "昨天 13:05",
        read: true,
      },
    ],
  },
  {
    id: "c4",
    parentName: "蘇宥勳 媽媽",
    initial: "蘇",
    className: "三年 2 班",
    lastReplyTime: "昨天",
    preview: "早上出門會再提早 10 分鐘",
    time: "昨天",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師，宥勳這週遲到兩次，我們會調整作息。", time: "昨天 08:20" },
      {
        id: "m2",
        author: "agent",
        text: "媽媽好，謝謝配合，早自習前到校對他銜接課程會順很多。",
        time: "昨天 08:25",
        read: true,
      },
      { id: "m3", author: "parent", text: "早上出門會再提早 10 分鐘。", time: "昨天 08:31" },
    ],
  },
  {
    id: "c5",
    parentName: "曾若瑄 媽媽",
    initial: "曾",
    className: "三年 2 班",
    lastReplyTime: "9/3",
    preview: "太好了，會鼓勵她！",
    time: "9/3",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師好，想問若瑄最近數學的狀況。", time: "9/3 14:50" },
      {
        id: "m2",
        author: "agent",
        text: "媽媽好，若瑄這次數學小考進步了 15 分，想跟您分享這個好消息。",
        time: "9/3 15:10",
        read: true,
      },
      { id: "m3", author: "parent", text: "太好了，會鼓勵她！", time: "9/3 15:22" },
    ],
  },
  {
    id: "c6",
    parentName: "郭冠霖 媽媽",
    initial: "郭",
    className: "三年 2 班",
    lastReplyTime: "9/2",
    preview: "同意書我明天讓他帶去",
    time: "9/2",
    urgent: false,
    messages: [
      { id: "m1", author: "parent", text: "老師好，校外教學的同意書是不是還沒交？", time: "9/2 16:20" },
      {
        id: "m2",
        author: "agent",
        text: "媽媽好，是的還沒收到，麻煩這週回傳。",
        time: "9/2 16:40",
        read: true,
      },
      { id: "m3", author: "parent", text: "同意書我明天讓他帶去。", time: "9/2 17:02" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Parent chat — the parent's single thread with the teacher          */
/* ------------------------------------------------------------------ */

export const SAMPLE_PARENT_THREAD: ChatMessage[] = [
  {
    id: "p1",
    author: "teacher",
    text: "媽媽好，今天午休晨哲和同學有口角，我已陪兩個孩子談過，情緒平穩了。",
    time: "10:20",
  },
  { id: "p2", author: "teacher", text: "想跟您約 5 分鐘電話，聊聊他最近的情緒。", time: "10:21" },
  { id: "p3", author: "parent", text: "好的老師，我下午三點後有空。", time: "10:24", read: true },
];

/* ------------------------------------------------------------------ */
/* Notes — 記錄學校事項                                               */
/* ------------------------------------------------------------------ */

export type Student = { seat: string; name: string; gender?: "男" | "女" };

export const SAMPLE_STUDENTS: Student[] = [
  { seat: "01", name: "陳品睿", gender: "男" },
  { seat: "02", name: "黃宥廷", gender: "男" },
  { seat: "03", name: "李宇翔", gender: "男" },
  { seat: "04", name: "蔡承翰", gender: "男" },
  { seat: "05", name: "許博凱", gender: "男" },
  { seat: "06", name: "謝佑安", gender: "男" },
  { seat: "07", name: "郭冠霖" },
  { seat: "08", name: "邱品諺" },
  { seat: "09", name: "廖恩宇" },
  { seat: "10", name: "徐晨哲" },
  { seat: "11", name: "葉秉修" },
  { seat: "12", name: "蘇宥勳" },
  { seat: "13", name: "呂政宏" },
  { seat: "14", name: "林子晴" },
  { seat: "15", name: "張語桐" },
  { seat: "16", name: "吳沛恩" },
  { seat: "17", name: "楊沐晴" },
  { seat: "18", name: "鄭羽涵" },
  { seat: "19", name: "洪采葳" },
  { seat: "20", name: "曾若瑄" },
  { seat: "21", name: "賴可歆" },
  { seat: "22", name: "周芯伃" },
  { seat: "23", name: "莊喬安" },
  { seat: "24", name: "潘芷瑩" },
  { seat: "25", name: "蕭安妤" },
];

export type NoteRecord = {
  id: string;
  time: string;
  studentName: string;
  body: string;
};

export const SAMPLE_NOTE_HISTORY: NoteRecord[] = [
  {
    id: "n1",
    time: "09/04",
    studentName: "邱品諺",
    body: "連續三天未交數學作業，已與學生確認原因。",
  },
  {
    id: "n2",
    time: "09/03",
    studentName: "林子晴",
    body: "午餐幾乎未進食，觀察兩天。",
  },
];
