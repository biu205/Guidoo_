// Front-end sample data for the Guidoo UI.
//
// Only the calendar still renders from a fixture here (no backend endpoint
// exists for it yet). Login, both chat rooms, the dashboard task list and the
// notes form are all wired to the live API. `ChatMessage` / `ChatAuthor` stay
// as the shared message shape the chat components use.

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
/* Chat — shared message shape used by both chat rooms (data is live)  */
/* ------------------------------------------------------------------ */

export type ChatAuthor = "parent" | "agent" | "teacher";

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  text: string;
  time: string;
  read?: boolean; // show 已讀 under the latest outgoing message
};

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
